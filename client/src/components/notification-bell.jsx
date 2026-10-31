import React from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import api from '@/api/client';
import { Bell } from 'lucide-react';

export function NotificationBell() {
  const { data } = useQuery({
    queryKey: ['notifications-count'],
    queryFn: () => api.get('/notifications'),
    refetchInterval: 60000,
  });
  const unread = data?.data?.unread || 0;
  return (
    <Link
      to="/notifications"
      className="relative w-9 h-9 rounded-[8px] flex items-center justify-center text-ink-muted hover:text-ink hover:bg-surface-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
      aria-label={unread ? `Notifications, ${unread} unread` : 'Notifications'}
    >
      <Bell className="w-4 h-4" />
      {unread > 0 && (
        <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 rounded-full bg-accent-strong text-accent-ink text-[10px] font-bold flex items-center justify-center tabular-nums">
          {unread > 9 ? '9+' : unread}
        </span>
      )}
    </Link>
  );
}
