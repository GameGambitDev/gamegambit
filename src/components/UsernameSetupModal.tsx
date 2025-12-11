import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, User, AlertCircle, Shield } from 'lucide-react';
import { useUpdatePlayer } from '@/hooks/usePlayer';
import { toast } from 'sonner';
import { triggerCelebration } from '@/lib/confetti';

interface UsernameSetupModalProps {
  open: boolean;
  onSuccess: () => void;
}

export function UsernameSetupModal({ open, onSuccess }: UsernameSetupModalProps) {
  const [username, setUsername] = useState('');
  const [error, setError] = useState('');
  const updatePlayer = useUpdatePlayer();

  const validateUsername = (value: string): string | null => {
    if (value.length < 3) return 'Username must be at least 3 characters';
    if (value.length > 20) return 'Username must be less than 20 characters';
    if (!/^[a-zA-Z0-9_]+$/.test(value)) return 'Only letters, numbers, and underscores allowed';
    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const validationError = validateUsername(username);
    if (validationError) {
      setError(validationError);
      return;
    }

    try {
      await updatePlayer.mutateAsync({ username: username.trim() });
      triggerCelebration();
      toast.success('Username set successfully! Welcome to the arena!');
      onSuccess();
    } catch (err: any) {
      if (err.message?.includes('duplicate') || err.message?.includes('unique') || err.message?.includes('already')) {
        setError('This username is already taken');
      } else {
        setError(err.message || 'Failed to set username');
      }
    }
  };

  return (
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent 
        className="sm:max-w-md border-primary/30 bg-card" 
        onPointerDownOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        <DialogHeader className="text-center">
          <div className="mx-auto w-16 h-16 rounded-full bg-primary/20 flex items-center justify-center mb-4">
            <User className="h-8 w-8 text-primary" />
          </div>
          <DialogTitle className="text-2xl font-gaming text-center">
            Choose Your Username
          </DialogTitle>
          <DialogDescription className="text-center">
            This is your identity on the platform. Choose wisely - other players will see this name.
          </DialogDescription>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-6 mt-4">
          <div className="space-y-2">
            <Label htmlFor="username" className="text-sm font-medium">
              Username
            </Label>
            <Input
              id="username"
              placeholder="Enter username (3-20 characters)"
              value={username}
              onChange={(e) => {
                setUsername(e.target.value);
                setError('');
              }}
              className="bg-background border-border h-12 text-lg"
              autoFocus
              disabled={updatePlayer.isPending}
              autoComplete="off"
            />
            {error && (
              <div className="flex items-center gap-2 text-sm text-destructive">
                <AlertCircle className="h-4 w-4 flex-shrink-0" />
                <span>{error}</span>
              </div>
            )}
            <p className="text-xs text-muted-foreground">
              Letters, numbers, and underscores only
            </p>
          </div>
          
          <div className="flex items-start gap-3 p-3 rounded-lg bg-primary/10 border border-primary/20">
            <Shield className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
            <p className="text-xs text-muted-foreground">
              You must set a username before you can create or join wagers. This cannot be changed later without contacting support.
            </p>
          </div>
          
          <Button 
            type="submit" 
            variant="neon"
            className="w-full h-12 text-lg font-gaming" 
            disabled={updatePlayer.isPending || !username.trim()}
          >
            {updatePlayer.isPending ? (
              <>
                <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                Setting up...
              </>
            ) : (
              'Set Username'
            )}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
