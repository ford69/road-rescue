import * as React from 'react';
import {
  CheckCircle2,
  AlertCircle,
  Info,
  Bell,
  CheckCheck,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/empty-state';
import { useNavigate } from 'react-router-dom';
import { useNotifications } from '@/hooks/useApi';
import { useAuth } from '@/context/auth-context';
import type { NotificationDto } from '@/api/types';

const iconMap: Record<NotificationDto['type'], React.ReactNode> = {
  success: <CheckCircle2 className="h-5 w-5 text-success" />,
  info: <Info className="h-5 w-5 text-primary" />,
  warning: <AlertCircle className="h-5 w-5 text-warning" />,
  critical: <AlertCircle className="h-5 w-5 text-critical" />,
};

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const minutes = Math.max(1, Math.round(diff / 60000));
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

export function Notifications() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { data, loading, error, reload, markAllRead } = useNotifications();
  const unreadCount = data.filter((n) => !n.read).length;

  const openNotification = (n: NotificationDto) => {
    if (n.meta?.requestId || /confirm|completion|issue/i.test(`${n.title} ${n.body}`)) {
      if (user?.role === 'mechanic') {
        navigate('/mechanic/track');
        return;
      }
      if (user?.role === 'customer') {
        navigate('/customer/tracking');
      }
    }
  };

  const onMarkAll = async () => {
    await markAllRead();
    await reload();
  };

  if (loading) {
    return <p className="text-sm text-muted-foreground py-8 text-center">Loading notifications…</p>;
  }

  if (error) {
    return (
      <EmptyState
        icon={<Bell className="h-10 w-10" />}
        title="Could not load notifications"
        description={error}
      />
    );
  }

  return (
    <div className="space-y-4 pb-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-display text-xl font-bold tracking-tight">Notifications</h2>
          {unreadCount > 0 && (
            <p className="text-sm text-muted-foreground mt-0.5">{unreadCount} unread</p>
          )}
        </div>
        {unreadCount > 0 && (
          <Button variant="ghost" size="sm" onClick={() => void onMarkAll()}>
            <CheckCheck className="h-4 w-4" />
            Mark all read
          </Button>
        )}
      </div>

      {data.length === 0 ? (
        <EmptyState
          icon={<Bell className="h-10 w-10" />}
          title="No notifications"
          description="You're all caught up. New alerts will appear here."
        />
      ) : (
        <div className="space-y-2">
          {data.map((n) => (
            <Card
              key={n._id}
              interactive
              className={cn(!n.read && 'border-primary-200 dark:border-primary-900/40')}
              onClick={() => openNotification(n)}
            >
              <div className="p-4 flex items-start gap-3">
                <div
                  className={cn(
                    'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl',
                    !n.read ? 'bg-accent' : 'bg-transparent',
                  )}
                >
                  {iconMap[n.type]}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-semibold text-sm">{n.title}</p>
                    {!n.read && <span className="h-2 w-2 rounded-full bg-primary shrink-0" />}
                  </div>
                  <p className="text-sm text-muted-foreground mt-0.5">{n.body}</p>
                  <p className="text-xs text-muted-foreground mt-1.5">{relativeTime(n.createdAt)}</p>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
