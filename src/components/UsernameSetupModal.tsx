import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, User, AlertCircle } from 'lucide-react';
import { useUpdatePlayer } from '@/hooks/usePlayer';
import { toast } from 'sonner';

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
      toast.success('Username set successfully!');
      onSuccess();
    } catch (err: any) {
      if (err.message?.includes('duplicate') || err.message?.includes('unique')) {
        setError('This username is already taken');
      } else {
        setError(err.message || 'Failed to set username');
      }
    }
  };

  return (
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent className="sm:max-w-md" onPointerDownOutside={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <User className="h-5 w-5 text-primary" />
            Set Your Username
          </DialogTitle>
          <DialogDescription>
            Choose a unique username to get started. This will be visible to other players.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 mt-4">
          <div className="space-y-2">
            <Label htmlFor="username">Username</Label>
            <Input
              id="username"
              placeholder="Enter username (3-20 characters)"
              value={username}
              onChange={(e) => {
                setUsername(e.target.value);
                setError('');
              }}
              className="bg-card"
              autoFocus
              disabled={updatePlayer.isPending}
            />
            {error && (
              <div className="flex items-center gap-2 text-sm text-destructive">
                <AlertCircle className="h-4 w-4" />
                {error}
              </div>
            )}
            <p className="text-xs text-muted-foreground">
              Letters, numbers, and underscores only
            </p>
          </div>
          <Button 
            type="submit" 
            className="w-full" 
            disabled={updatePlayer.isPending || !username.trim()}
          >
            {updatePlayer.isPending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Setting up...
              </>
            ) : (
              'Continue'
            )}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
