import { useState } from 'react';
import { Bell, Trophy, Swords, Clock, Wallet } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';

interface Notification {
  id: string;
  type: 'wager_joined' | 'wager_won' | 'wager_lost' | 'wager_created' | 'payment';
  title: string;
  message: string;
  timestamp: Date;
  read: boolean;
}

// Placeholder notifications - in a real app these would come from the database
const placeholderNotifications: Notification[] = [];

export function NotificationsDropdown() {
  const [notifications] = useState<Notification[]>(placeholderNotifications);
  const unreadCount = notifications.filter(n => !n.read).length;

  const getNotificationIcon = (type: Notification['type']) => {
    switch (type) {
      case 'wager_won':
        return <Trophy className="h-4 w-4 text-success" />;
      case 'wager_lost':
        return <Swords className="h-4 w-4 text-destructive" />;
      case 'wager_joined':
        return <Swords className="h-4 w-4 text-primary" />;
      case 'wager_created':
        return <Clock className="h-4 w-4 text-accent" />;
      case 'payment':
        return <Wallet className="h-4 w-4 text-success" />;
      default:
        return <Bell className="h-4 w-4" />;
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-destructive animate-pulse" />
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent 
        align="end" 
        className="w-80 p-0 bg-card border-border"
      >
        <div className="p-4 border-b border-border">
          <div className="flex items-center justify-between">
            <h3 className="font-gaming text-sm">Notifications</h3>
            {unreadCount > 0 && (
              <span className="text-xs text-muted-foreground">
                {unreadCount} unread
              </span>
            )}
          </div>
        </div>
        
        <div className="max-h-80 overflow-y-auto">
          {notifications.length > 0 ? (
            <div className="divide-y divide-border">
              {notifications.map((notification) => (
                <div
                  key={notification.id}
                  className={cn(
                    "p-4 hover:bg-muted/50 cursor-pointer transition-colors",
                    !notification.read && "bg-primary/5"
                  )}
                >
                  <div className="flex gap-3">
                    <div className="flex-shrink-0 mt-0.5">
                      {getNotificationIcon(notification.type)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium">{notification.title}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {notification.message}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {formatTimeAgo(notification.timestamp)}
                      </p>
                    </div>
                    {!notification.read && (
                      <div className="h-2 w-2 rounded-full bg-primary flex-shrink-0" />
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="py-12 px-4 text-center">
              <div className="w-12 h-12 rounded-full bg-muted/50 flex items-center justify-center mx-auto mb-3">
                <Bell className="h-6 w-6 text-muted-foreground" />
              </div>
              <p className="text-sm font-medium mb-1">No notifications yet</p>
              <p className="text-xs text-muted-foreground">
                You'll see updates about your wagers here
              </p>
            </div>
          )}
        </div>
        
        {notifications.length > 0 && (
          <div className="p-2 border-t border-border">
            <Button variant="ghost" size="sm" className="w-full text-xs">
              Mark all as read
            </Button>
          </div>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function formatTimeAgo(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  return `${diffDays}d ago`;
}
