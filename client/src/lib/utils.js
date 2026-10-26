import { clsx } from 'clsx';
import { extendTailwindMerge } from 'tailwind-merge';

const customTwMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      'font-size': [
        'text-11',
        'text-12',
        'text-13',
        'text-14',
        'text-15',
        'text-18',
        'text-20',
        'text-24',
        'text-28',
        'text-32',
        'text-40',
        'text-48',
        'text-72',
      ],
    },
  },
});

export function cn(...inputs) {
  return customTwMerge(clsx(inputs));
}

// SQLite's CURRENT_TIMESTAMP is UTC but has no zone marker ("2026-01-31 17:00:00"), which
// browsers would otherwise read as local time and shift by the viewer's UTC offset.
export function parseDate(dateString) {
  if (typeof dateString === 'string' && /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}(:\d{2}(\.\d+)?)?$/.test(dateString)) {
    return new Date(`${dateString.replace(' ', 'T')}Z`);
  }
  return new Date(dateString);
}

export function formatDate(dateString) {
  if (!dateString) return '';
  const date = parseDate(dateString);
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  }).format(date);
}

export function formatRelativeTime(dateString) {
  if (!dateString) return '';
  const date = parseDate(dateString);
  const now = new Date();
  const diffInSeconds = Math.floor((now - date) / 1000);

  if (diffInSeconds < 60) return 'just now';
  const diffInMinutes = Math.floor(diffInSeconds / 60);
  if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
  const diffInHours = Math.floor(diffInMinutes / 60);
  if (diffInHours < 24) return `${diffInHours}h ago`;
  const diffInDays = Math.floor(diffInHours / 24);
  if (diffInDays < 30) return `${diffInDays}d ago`;

  return formatDate(dateString);
}
