'use client';

import { Bell, Trophy, Swords, Clock, Wallet, CheckCheck, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { useNotifications } from '@/hooks/useNotifications';
import type { AppNotification } from '@/hooks/useNotifications';
import Link from 'next/link';

export function NotificationsDropdown() {
  const { notifications, unreadCount, markAllRead, markRead } = useNotifications();

  const getNotificationIcon = (type: AppNotification['type']) => {
    switch (type) {
      case 'wager_won':
        return <Trophy className="h-4 w-4 text-yellow-400" />;
      case 'wager_lost':
        return <Swords className="h-4 w-4 text-destructive" />;
      case 'wager_joined':
        return <Swords className="h-4 w-4 text-primary" />;
      case 'game_started':
        return <Clock className="h-4 w-4 text-green-400" />;
      case 'wager_draw':
        return <Wallet className="h-4 w-4 text-muted-foreground" />;
      case 'wager_cancelled':
        return <Wallet className="h-4 w-4 text-orange-400" />;
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
            <span className="absolute -top-0.5 -right-0.5 h-4 w-4 rounded-full bg-destructive flex items-center justify-center">
              <span className="text-[9px] font-bold text-white leading-none">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            </span>
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
              <button
                onClick={markAllRead}
                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                <CheckCheck className="h-3 w-3" />
                Mark all read
              </button>
            )}
          </div>
        </div>

        <div className="max-h-80 overflow-y-auto">
          {notifications.length > 0 ? (
            <div className="divide-y divide-border">
              {notifications.map((notification) => (
                <div
                  key={notification.id}
                  onClick={() => !notification.read && markRead(notification.id)}
                  className={cn(
                    "p-4 hover:bg-muted/50 cursor-pointer transition-colors",
                    !notification.read && "bg-primary/5 border-l-2 border-l-primary"
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
                      <div className="flex items-center justify-between mt-1">
                        <p className="text-xs text-muted-foreground">
                          {formatTimeAgo(notification.created_at)}
                        </p>
                        {notification.wager_id && (
                          <Link
                            href="/my-wagers"
                            onClick={(e) => e.stopPropagation()}
                            className="text-[10px] text-primary hover:underline flex items-center gap-0.5"
                          >
                            View wager
                            <ExternalLink className="h-2.5 w-2.5" />
                          </Link>
                        )}
                      </div>
                    </div>
                    {!notification.read && (
                      <div className="h-2 w-2 rounded-full bg-primary flex-shrink-0 mt-1" />
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
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function formatTimeAgo(dateStr: string): string {
  const now = new Date();
  const date = new Date(dateStr);
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  return `${diffDays}d ago`;
}