// src/hooks/useFriends.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { getSupabaseClient } from '@/integrations/supabase/client';
import { useWallet } from '@solana/wallet-adapter-react';
import type { Tables } from '@/integrations/supabase/types';

export type Friendship = Tables<'friendships'>;
export type DirectMessage = Tables<'direct_messages'>;

export type FriendshipStatus = 'none' | 'pending_sent' | 'pending_received' | 'friends' | 'blocked';

// ── Deterministic channel ID — always same regardless of who initiates ────────
export function getDmChannelId(walletA: string, walletB: string): string {
  return [walletA, walletB].sort().join('__');
}

// ── useFriends ────────────────────────────────────────────────────────────────
export function useFriends() {
  const { publicKey } = useWallet();
  const walletAddress = publicKey?.toBase58() ?? null;
  const queryClient = useQueryClient();
  const supabase = getSupabaseClient();

  // ── Friends list (accepted) ────────────────────────────────────────────────
  const { data: friendships = [], isLoading: friendsLoading } = useQuery({
    queryKey: ['friendships', walletAddress],
    enabled: !!walletAddress,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('friendships')
        .select('*')
        .or(`requester_wallet.eq.${walletAddress},recipient_wallet.eq.${walletAddress}`)
        .eq('status', 'accepted');
      if (error) throw error;
      return (data ?? []) as Friendship[];
    },
  });

  // Flatten to a list of the other wallet address
  const friendWallets: string[] = friendships.map((f) =>
    f.requester_wallet === walletAddress ? f.recipient_wallet : f.requester_wallet,
  );

  // ── Pending requests (incoming only) ──────────────────────────────────────
  const { data: pendingRequests = [], isLoading: pendingLoading } = useQuery({
    queryKey: ['friendships_pending', walletAddress],
    enabled: !!walletAddress,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('friendships')
        .select('*')
        .eq('recipient_wallet', walletAddress)
        .eq('status', 'pending');
      if (error) throw error;
      return (data ?? []) as Friendship[];
    },
  });

  // ── All friendships (for status lookup) ───────────────────────────────────
  const { data: allFriendships = [] } = useQuery({
    queryKey: ['friendships_all', walletAddress],
    enabled: !!walletAddress,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('friendships')
        .select('*')
        .or(`requester_wallet.eq.${walletAddress},recipient_wallet.eq.${walletAddress}`);
      if (error) throw error;
      return (data ?? []) as Friendship[];
    },
  });

  // ── Get friendship status with a specific wallet ───────────────────────────
  function getFriendshipStatus(targetWallet: string): FriendshipStatus {
    if (!walletAddress || targetWallet === walletAddress) return 'none';
    const match = allFriendships.find(
      (f) =>
        (f.requester_wallet === walletAddress && f.recipient_wallet === targetWallet) ||
        (f.recipient_wallet === walletAddress && f.requester_wallet === targetWallet),
    );
    if (!match) return 'none';
    if (match.status === 'accepted') return 'friends';
    if (match.status === 'blocked') return 'blocked';
    if (match.status === 'pending') {
      return match.requester_wallet === walletAddress ? 'pending_sent' : 'pending_received';
    }
    return 'none';
  }

  function getFriendship(targetWallet: string): Friendship | undefined {
    return allFriendships.find(
      (f) =>
        (f.requester_wallet === walletAddress && f.recipient_wallet === targetWallet) ||
        (f.recipient_wallet === walletAddress && f.requester_wallet === targetWallet),
    );
  }

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['friendships'] });
    queryClient.invalidateQueries({ queryKey: ['friendships_pending'] });
    queryClient.invalidateQueries({ queryKey: ['friendships_all'] });
  };

  // ── Send request ───────────────────────────────────────────────────────────
  const sendRequest = useMutation({
    mutationFn: async (targetWallet: string) => {
      if (!walletAddress) throw new Error('Wallet not connected');
      const { error } = await supabase.from('friendships').insert({
        requester_wallet: walletAddress,
        recipient_wallet: targetWallet,
        status: 'pending',
      });
      if (error) throw error;
      // Notify the recipient — actor_wallet = who sent the request
      await supabase.from('notifications').insert({
        player_wallet: targetWallet,
        type: 'friend_request',
        title: 'Friend Request',
        message: 'Someone sent you a friend request.',
        actor_wallet: walletAddress,
      });
    },
    onSuccess: invalidate,
  });

  // ── Accept request ─────────────────────────────────────────────────────────
  const acceptRequest = useMutation({
    mutationFn: async (friendshipId: string) => {
      // Fetch the friendship first so we know who the requester is
      const { data: friendship, error: fetchError } = await supabase
        .from('friendships')
        .select('requester_wallet, recipient_wallet')
        .eq('id', friendshipId)
        .single();
      if (fetchError) throw fetchError;

      const { error } = await supabase
        .from('friendships')
        .update({ status: 'accepted' })
        .eq('id', friendshipId);
      if (error) throw error;

      // Notify the original requester — actor_wallet = who accepted
      if (friendship) {
        await supabase.from('notifications').insert({
          player_wallet: friendship.requester_wallet,
          type: 'friend_accepted',
          title: 'Friend Request Accepted',
          message: 'Your friend request was accepted.',
          actor_wallet: friendship.recipient_wallet,
        });
      }
    },
    onSuccess: invalidate,
  });

  // ── Decline request ────────────────────────────────────────────────────────
  const declineRequest = useMutation({
    mutationFn: async (friendshipId: string) => {
      const { error } = await supabase
        .from('friendships')
        .delete()
        .eq('id', friendshipId);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  // ── Remove friend — FIXED: single .or() with compound and() conditions ─────
  const removeFriend = useMutation({
    mutationFn: async (targetWallet: string) => {
      if (!walletAddress) throw new Error('Wallet not connected');
      const { error } = await supabase
        .from('friendships')
        .delete()
        .or(
          `and(requester_wallet.eq.${walletAddress},recipient_wallet.eq.${targetWallet}),` +
          `and(requester_wallet.eq.${targetWallet},recipient_wallet.eq.${walletAddress})`
        );
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  // ── Realtime subscription ──────────────────────────────────────────────────
  useEffect(() => {
    if (!walletAddress) return;
    const channel = supabase
      .channel(`friendships:${walletAddress}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'friendships',
          filter: `recipient_wallet=eq.${walletAddress}`,
        },
        () => invalidate(),
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'friendships',
          filter: `requester_wallet=eq.${walletAddress}`,
        },
        () => invalidate(),
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [walletAddress]);

  return {
    friendWallets,
    friendships,
    pendingRequests,
    friendsLoading,
    pendingLoading,
    getFriendshipStatus,
    getFriendship,
    sendRequest,
    acceptRequest,
    declineRequest,
    removeFriend,
  };
}

// ── useDirectMessages ─────────────────────────────────────────────────────────
export function useDirectMessages(otherWallet: string | null) {
  const { publicKey } = useWallet();
  const walletAddress = publicKey?.toBase58() ?? null;
  const queryClient = useQueryClient();
  const supabase = getSupabaseClient();

  const channelId =
    walletAddress && otherWallet ? getDmChannelId(walletAddress, otherWallet) : null;

  // ── Fetch messages ─────────────────────────────────────────────────────────
  const { data: messages = [], isLoading } = useQuery({
    queryKey: ['dm', channelId],
    enabled: !!channelId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('direct_messages')
        .select('*')
        .eq('channel_id', channelId!)
        .order('created_at', { ascending: true });
      if (error) throw error;
      return (data ?? []) as DirectMessage[];
    },
  });

  // ── Send message ───────────────────────────────────────────────────────────
  const sendMessage = useMutation({
    mutationFn: async (text: string) => {
      if (!walletAddress || !channelId) throw new Error('Not ready');
      const { error } = await supabase.from('direct_messages').insert({
        channel_id: channelId,
        sender_wallet: walletAddress,
        message: text,
      });
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['dm', channelId] }),
  });

  // ── Mark messages as read ──────────────────────────────────────────────────
  const markRead = useMutation({
    mutationFn: async () => {
      if (!walletAddress || !channelId) return;
      const { error } = await supabase
        .from('direct_messages')
        .update({ read_at: new Date().toISOString() })
        .eq('channel_id', channelId)
        .neq('sender_wallet', walletAddress)
        .is('read_at', null);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dm', channelId] });
      queryClient.invalidateQueries({ queryKey: ['dm_unread'] });
    },
  });

  // ── Realtime subscription ──────────────────────────────────────────────────
  useEffect(() => {
    if (!channelId) return;
    const channel = supabase
      .channel(`dm:${channelId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'direct_messages',
          filter: `channel_id=eq.${channelId}`,
        },
        () => queryClient.invalidateQueries({ queryKey: ['dm', channelId] }),
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [channelId, queryClient, supabase]);

  return { messages, isLoading, sendMessage, markRead };
}

// ── useUnreadDmCount ──────────────────────────────────────────────────────────
export function useUnreadDmCount() {
  const { publicKey } = useWallet();
  const walletAddress = publicKey?.toBase58() ?? null;
  const supabase = getSupabaseClient();
  const queryClient = useQueryClient();

  const { data: unreadCount = 0 } = useQuery({
    queryKey: ['dm_unread', walletAddress],
    enabled: !!walletAddress,
    refetchInterval: 30_000,
    queryFn: async () => {
      const { count, error } = await supabase
        .from('direct_messages')
        .select('id', { count: 'exact', head: true })
        .neq('sender_wallet', walletAddress!)
        .is('read_at', null);
      if (error) throw error;
      return count ?? 0;
    },
  });

  // Realtime update for unread badge
  useEffect(() => {
    if (!walletAddress) return;
    const channel = supabase
      .channel(`dm_unread:${walletAddress}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'direct_messages' },
        () => queryClient.invalidateQueries({ queryKey: ['dm_unread', walletAddress] }),
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [walletAddress, queryClient, supabase]);

  return unreadCount;
}