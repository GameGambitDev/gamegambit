'use client';

/**
 * GameAccountCard.tsx
 *
 * Handles all non-chess game account binding:
 *   • PUBG Mobile  — verifies username via PUBG API on Search click
 *   • CODM         — manual bind, no API verification
 *   • Free Fire    — manual bind, no API verification
 *
 * Bind flow:
 *   1. Player types username → clicks Search
 *   2. Result shown (found / not found / manual confirm)
 *   3. Four consent checkboxes must all be ticked
 *   4. Confirm → calls onLink(username, accountId?)
 *      • If username already taken → enters appeal flow
 *
 * Already-linked flow:
 *   • Shows linked username
 *   • "Request Change" button opens the change-request form
 *     (does NOT allow direct editing)
 *
 * Appeal flow (username taken):
 *   • Explains situation, lets player submit appeal via onAppeal()
 *
 * Change-request flow:
 *   • Formal form with reason + category
 *   • Calls onChangeRequest() — goes to admin review queue
 */

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  CheckCircle, ExternalLink, Loader2, X, AlertCircle,
  FileText, ShieldAlert, ArrowRight, Search,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

// ── Types ─────────────────────────────────────────────────────────────────────

interface GameInfo {
  id: string;
  name: string;
  icon: string;
  platform: string;
  apiVerify: boolean;
  usernameKey: string;
  playerIdKey: string | null;
}

interface GameAccountCardProps {
  game: GameInfo;
  linkedUsername: string | null;
  /** Called when the player successfully confirms a bind. accountId is set for PUBG. */
  onLink: (username: string, accountId?: string) => Promise<void>;
  /** Called when the player submits an appeal for a taken username. */
  onAppeal: (game: string, username: string) => Promise<void>;
  /** Called when the player submits a formal change request. */
  onChangeRequest: (payload: ChangeRequestPayload) => Promise<void>;
  isPending?: boolean;
  isOwnProfile?: boolean;
}

export interface ChangeRequestPayload {
  game: string;
  oldUsername: string;
  newUsername: string;
  reason: string;
  reasonCategory: string;
}

// PUBG API search result shape (only what we use)
interface PubgVerifyResult {
  valid: boolean;
  accountId?: string;
  displayName?: string;
  error?: string;
}

type Mode =
  | 'idle'          // showing linked username or "Link Account" button
  | 'search'        // entering username + Search button
  | 'found'         // API confirmed / manual confirm — show consent checkboxes
  | 'not_found'     // API returned nothing
  | 'searching'     // spinner while API call in progress
  | 'taken'         // username already claimed by another player
  | 'appeal_sent'   // appeal submitted successfully
  | 'change_form'   // formal change-request form
  | 'change_sent';  // change request submitted

const REASON_CATEGORIES = [
  { value: 'name_changed', label: 'I changed my in-game username' },
  { value: 'account_banned_in_game', label: 'My original account was banned in-game' },
  { value: 'entry_error', label: 'I entered the wrong username when I linked' },
  { value: 'other', label: 'Other' },
] as const;

// ── Component ─────────────────────────────────────────────────────────────────

export function GameAccountCard({
  game,
  linkedUsername,
  onLink,
  onAppeal,
  onChangeRequest,
  isPending = false,
  isOwnProfile = true,
}: GameAccountCardProps) {
  // ── UI state ─────────────────────────────────────────────────────────────
  const [mode, setMode] = useState<Mode>('idle');
  const [username, setUsername] = useState('');
  const [foundName, setFoundName] = useState('');   // display name from API
  const [foundId, setFoundId] = useState('');   // accountId from PUBG API
  const [error, setError] = useState('');

  // Consent checkboxes
  const [consent1, setConsent1] = useState(false); // "This is my account"
  const [consent2, setConsent2] = useState(false); // "Linking someone else's = fraud"
  const [consent3, setConsent3] = useState(false); // "Changing requires review"
  const [consent4, setConsent4] = useState(false); // "Taken username → appeal"

  const allConsented = consent1 && consent2 && consent3 && consent4;

  // Change-request form
  const [changeNewUsername, setChangeNewUsername] = useState('');
  const [changeReason, setChangeReason] = useState('');
  const [changeCategory, setChangeCategory] = useState('');
  const [changePending, setChangePending] = useState(false);

  // Confirm / appeal pending
  const [confirmPending, setConfirmPending] = useState(false);
  const [appealPending, setAppealPending] = useState(false);

  // ── Helpers ───────────────────────────────────────────────────────────────

  const resetConsent = () => {
    setConsent1(false);
    setConsent2(false);
    setConsent3(false);
    setConsent4(false);
  };

  const resetAll = () => {
    setMode('idle');
    setUsername('');
    setFoundName('');
    setFoundId('');
    setError('');
    resetConsent();
    setChangeNewUsername('');
    setChangeReason('');
    setChangeCategory('');
  };

  // ── Search / verify ───────────────────────────────────────────────────────

  const handleSearch = async () => {
    const trimmed = username.trim();
    if (!trimmed) {
      setError('Please enter a username first.');
      return;
    }
    setError('');

    if (game.apiVerify) {
      // PUBG: call our API route which proxies to PUBG API
      setMode('searching');
      try {
        const res = await fetch('/api/pubg/verify-username', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username: trimmed }),
        });
        const json: PubgVerifyResult = await res.json();

        if (json.valid && json.accountId) {
          setFoundName(json.displayName || trimmed);
          setFoundId(json.accountId);
          resetConsent();
          setMode('found');
        } else {
          setMode('not_found');
        }
      } catch {
        setError('Could not reach the verification service. Please try again.');
        setMode('search');
      }
    } else {
      // CODM / Free Fire: no API, just show confirmation UI
      setFoundName(trimmed);
      setFoundId('');
      resetConsent();
      setMode('found');
    }
  };

  // ── Confirm bind ──────────────────────────────────────────────────────────

  const handleConfirm = async () => {
    if (!allConsented) return;
    setConfirmPending(true);
    setError('');
    try {
      await onLink(foundName, foundId || undefined);
      resetAll();
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Failed to link account';
      if (msg.toLowerCase().includes('taken') || msg.toLowerCase().includes('already')) {
        setMode('taken');
      } else {
        setError(msg);
      }
    } finally {
      setConfirmPending(false);
    }
  };

  // ── Appeal ────────────────────────────────────────────────────────────────

  const handleAppeal = async () => {
    setAppealPending(true);
    setError('');
    try {
      await onAppeal(game.id, foundName);
      setMode('appeal_sent');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to submit appeal');
    } finally {
      setAppealPending(false);
    }
  };

  // ── Change request ────────────────────────────────────────────────────────

  const handleChangeRequest = async () => {
    if (!changeNewUsername.trim() || !changeReason.trim() || !changeCategory) return;
    setChangePending(true);
    setError('');
    try {
      await onChangeRequest({
        game: game.id,
        oldUsername: linkedUsername!,
        newUsername: changeNewUsername.trim(),
        reason: changeReason.trim(),
        reasonCategory: changeCategory,
      });
      setMode('change_sent');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to submit request');
    } finally {
      setChangePending(false);
    }
  };

  // ── Render helpers ────────────────────────────────────────────────────────

  const renderConsentBox = (
    id: string,
    checked: boolean,
    onChecked: (v: boolean) => void,
    text: string,
  ) => (
    <div className="flex items-start gap-3">
      <Checkbox
        id={id}
        checked={checked}
        onCheckedChange={(v) => onChecked(Boolean(v))}
        className="mt-0.5 flex-shrink-0"
      />
      <Label htmlFor={id} className="text-xs text-muted-foreground leading-relaxed cursor-pointer">
        {text}
      </Label>
    </div>
  );

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <motion.div
      layout
      className="relative overflow-hidden rounded-lg bg-muted/30 border border-border/50 transition-all hover:border-primary/30"
    >
      <div className="p-4">

        {/* ── Header row: icon + name + action button ── */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <span className="text-2xl flex-shrink-0">{game.icon}</span>
            <div className="min-w-0">
              <div className="font-medium truncate">{game.name}</div>
              <div className="text-sm text-muted-foreground">{game.platform}</div>
            </div>
          </div>

          <AnimatePresence mode="wait">
            {/* Linked: show username + Request Change */}
            {linkedUsername && mode === 'idle' ? (
              <motion.div
                key="linked"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className="flex items-center gap-2 flex-shrink-0"
              >
                <CheckCircle className="h-4 w-4 text-success flex-shrink-0" />
                <span className="text-sm text-success">{linkedUsername}</span>
                {isOwnProfile && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-xs text-muted-foreground hover:text-foreground h-7 px-2"
                    onClick={() => setMode('change_form')}
                  >
                    <FileText className="h-3 w-3 mr-1" />
                    Request Change
                  </Button>
                )}
              </motion.div>
            ) : /* Not linked and idle: show Link Account */ !linkedUsername && mode === 'idle' ? (
              <motion.div
                key="not-linked"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
              >
                {isOwnProfile ? (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => { setMode('search'); setUsername(''); setError(''); }}
                  >
                    Link Account
                  </Button>
                ) : (
                  <Badge variant="outline">Not Linked</Badge>
                )}
              </motion.div>
            ) : null}
          </AnimatePresence>
        </div>

        {/* ── Expanded area ── */}
        <AnimatePresence>
          {mode !== 'idle' && isOwnProfile && (
            <motion.div
              key="expanded"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="mt-4 pt-4 border-t border-border/50 space-y-3"
            >

              {/* ── SEARCH MODE ── */}
              {(mode === 'search' || mode === 'searching' || mode === 'not_found') && (
                <div className="space-y-3">
                  <p className="text-xs text-muted-foreground">
                    {game.apiVerify
                      ? `Enter your full ${game.name} username, then tap Search. We'll confirm it exists before you link it.`
                      : `Enter your ${game.name} username or player ID exactly as it appears in-game, then tap Search.`
                    }
                  </p>

                  <div className="flex gap-2">
                    <Input
                      placeholder={`Your ${game.name} username`}
                      value={username}
                      onChange={(e) => { setUsername(e.target.value); setError(''); }}
                      className="bg-background/50"
                      onKeyDown={(e) => { if (e.key === 'Enter') handleSearch(); }}
                      autoFocus
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleSearch}
                      disabled={mode === 'searching' || !username.trim()}
                      className="flex-shrink-0"
                    >
                      {mode === 'searching'
                        ? <Loader2 className="h-4 w-4 animate-spin" />
                        : <><Search className="h-4 w-4 mr-1" /> Search</>
                      }
                    </Button>
                  </div>

                  {mode === 'not_found' && (
                    <div className="flex items-start gap-2 p-2 rounded bg-destructive/10 border border-destructive/20 text-xs text-destructive">
                      <AlertCircle className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" />
                      <span>
                        No {game.name} account found with that username.
                        Check for typos — usernames are case-sensitive.
                      </span>
                    </div>
                  )}

                  {error && (
                    <p className="text-xs text-destructive">{error}</p>
                  )}

                  <div className="flex justify-end">
                    <Button variant="ghost" size="sm" onClick={resetAll}>
                      <X className="h-4 w-4 mr-1" /> Cancel
                    </Button>
                  </div>
                </div>
              )}

              {/* ── FOUND / CONSENT MODE ── */}
              {mode === 'found' && (
                <div className="space-y-4">
                  {/* Result card */}
                  <div className="p-3 rounded-lg bg-success/10 border border-success/20 space-y-1">
                    <div className="flex items-center gap-2">
                      <CheckCircle className="h-4 w-4 text-success" />
                      <span className="text-sm font-medium text-success">
                        {game.apiVerify ? 'Account found' : 'Username entered'}
                      </span>
                    </div>
                    <p className="text-sm font-medium pl-6">{foundName}</p>
                    {foundId && (
                      <p className="text-xs text-muted-foreground pl-6">Player ID: {foundId}</p>
                    )}
                  </div>

                  {/* Is this you? */}
                  <p className="text-xs font-medium text-foreground">
                    Is this your account? Please confirm the following before linking:
                  </p>

                  {/* Consent checkboxes */}
                  <div className="space-y-3 p-3 rounded-lg bg-muted/40 border border-border/50">
                    {renderConsentBox(
                      `c1-${game.id}`,
                      consent1,
                      setConsent1,
                      `This is my personal ${game.name} account. I am the sole owner and have access to it.`,
                    )}
                    {renderConsentBox(
                      `c2-${game.id}`,
                      consent2,
                      setConsent2,
                      `I understand that linking someone else's username is treated as fraud and may result in account suspension.`,
                    )}
                    {renderConsentBox(
                      `c3-${game.id}`,
                      consent3,
                      setConsent3,
                      `I understand that changing a linked username requires submitting a formal request with valid reasons, and is subject to review.`,
                    )}
                    {renderConsentBox(
                      `c4-${game.id}`,
                      consent4,
                      setConsent4,
                      `I understand that if this username is already linked by another player, an appeal process will be started and both accounts will be reviewed.`,
                    )}
                  </div>

                  {error && (
                    <p className="text-xs text-destructive">{error}</p>
                  )}

                  <div className="flex gap-2">
                    <Button
                      variant="neon"
                      size="sm"
                      className="flex-1"
                      disabled={!allConsented || confirmPending || isPending}
                      onClick={handleConfirm}
                    >
                      {confirmPending
                        ? <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Linking…</>
                        : <><ArrowRight className="h-4 w-4 mr-2" /> Confirm & Link</>
                      }
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => { setMode('search'); resetConsent(); setError(''); }}
                    >
                      Back
                    </Button>
                  </div>
                </div>
              )}

              {/* ── TAKEN MODE ── */}
              {mode === 'taken' && (
                <div className="space-y-3">
                  <div className="flex items-start gap-2 p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/20">
                    <ShieldAlert className="h-4 w-4 text-yellow-500 flex-shrink-0 mt-0.5" />
                    <div className="space-y-1">
                      <p className="text-sm font-medium">This username is already linked</p>
                      <p className="text-xs text-muted-foreground">
                        Someone else on GameGambit has linked <span className="font-medium">{foundName}</span>.
                        If this is your account and someone has taken it, you can submit an appeal.
                        We'll notify the other account and give them a chance to respond.
                        If they can't prove ownership, it will be returned to you.
                      </p>
                    </div>
                  </div>

                  {error && <p className="text-xs text-destructive">{error}</p>}

                  <div className="flex gap-2">
                    <Button
                      variant="neon"
                      size="sm"
                      className="flex-1"
                      disabled={appealPending}
                      onClick={handleAppeal}
                    >
                      {appealPending
                        ? <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Submitting…</>
                        : 'Submit Appeal'
                      }
                    </Button>
                    <Button variant="ghost" size="sm" onClick={resetAll}>
                      Cancel
                    </Button>
                  </div>
                </div>
              )}

              {/* ── APPEAL SENT ── */}
              {mode === 'appeal_sent' && (
                <div className="space-y-3">
                  <div className="flex items-start gap-2 p-3 rounded-lg bg-success/10 border border-success/20">
                    <CheckCircle className="h-4 w-4 text-success flex-shrink-0 mt-0.5" />
                    <div className="space-y-1">
                      <p className="text-sm font-medium text-success">Appeal submitted</p>
                      <p className="text-xs text-muted-foreground">
                        The current account holder has been notified and has 48 hours to respond.
                        You'll receive a notification when they reply or when the review is complete.
                      </p>
                    </div>
                  </div>
                  <div className="flex justify-end">
                    <Button variant="ghost" size="sm" onClick={resetAll}>Done</Button>
                  </div>
                </div>
              )}

              {/* ── CHANGE REQUEST FORM ── */}
              {mode === 'change_form' && (
                <div className="space-y-4">
                  <div className="flex items-start gap-2 p-3 rounded-lg bg-primary/10 border border-primary/20">
                    <FileText className="h-4 w-4 text-primary flex-shrink-0 mt-0.5" />
                    <p className="text-xs text-muted-foreground">
                      Changing a linked username requires a review. Please provide your new username
                      and explain why you need to change it. Requests are typically reviewed within 30 minutes.
                      You may submit a maximum of 2 change requests per year.
                    </p>
                  </div>

                  <div className="space-y-1">
                    <Label className="text-xs">Current username</Label>
                    <p className="text-sm font-medium px-1">{linkedUsername}</p>
                  </div>

                  <div className="space-y-1">
                    <Label htmlFor={`new-username-${game.id}`} className="text-xs">
                      New username
                    </Label>
                    <Input
                      id={`new-username-${game.id}`}
                      placeholder={`Your new ${game.name} username`}
                      value={changeNewUsername}
                      onChange={(e) => { setChangeNewUsername(e.target.value); setError(''); }}
                      className="bg-background/50"
                    />
                  </div>

                  <div className="space-y-1">
                    <Label htmlFor={`change-category-${game.id}`} className="text-xs">
                      Reason category
                    </Label>
                    <Select value={changeCategory} onValueChange={setChangeCategory}>
                      <SelectTrigger id={`change-category-${game.id}`} className="bg-background/50">
                        <SelectValue placeholder="Select a reason…" />
                      </SelectTrigger>
                      <SelectContent>
                        {REASON_CATEGORIES.map((c) => (
                          <SelectItem key={c.value} value={c.value}>
                            {c.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1">
                    <Label htmlFor={`change-reason-${game.id}`} className="text-xs">
                      Explanation <span className="text-muted-foreground">(min 10 characters)</span>
                    </Label>
                    <Textarea
                      id={`change-reason-${game.id}`}
                      placeholder="e.g. I renamed my PUBG account to ProGamer_v2 last week and want to update it here."
                      value={changeReason}
                      onChange={(e) => { setChangeReason(e.target.value); setError(''); }}
                      className="bg-background/50 text-sm min-h-[80px] resize-none"
                      maxLength={500}
                    />
                    <p className="text-xs text-muted-foreground text-right">
                      {changeReason.length}/500
                    </p>
                  </div>

                  {error && <p className="text-xs text-destructive">{error}</p>}

                  <div className="flex gap-2">
                    <Button
                      variant="neon"
                      size="sm"
                      className="flex-1"
                      disabled={
                        changePending ||
                        !changeNewUsername.trim() ||
                        changeReason.trim().length < 10 ||
                        !changeCategory
                      }
                      onClick={handleChangeRequest}
                    >
                      {changePending
                        ? <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Submitting…</>
                        : 'Submit Request'
                      }
                    </Button>
                    <Button variant="ghost" size="sm" onClick={resetAll}>
                      Cancel
                    </Button>
                  </div>
                </div>
              )}

              {/* ── CHANGE SENT ── */}
              {mode === 'change_sent' && (
                <div className="space-y-3">
                  <div className="flex items-start gap-2 p-3 rounded-lg bg-success/10 border border-success/20">
                    <CheckCircle className="h-4 w-4 text-success flex-shrink-0 mt-0.5" />
                    <div className="space-y-1">
                      <p className="text-sm font-medium text-success">Request submitted</p>
                      <p className="text-xs text-muted-foreground">
                        Your username change request is under review. You'll be notified of the outcome.
                        Your current username remains active until the request is approved.
                      </p>
                    </div>
                  </div>
                  <div className="flex justify-end">
                    <Button variant="ghost" size="sm" onClick={resetAll}>Done</Button>
                  </div>
                </div>
              )}

            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}