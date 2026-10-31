import React from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';

// Ready-made posts for X, LinkedIn, Reddit and WhatsApp (spec 9.2).
export function shareLinks(idea, url) {
  const ask = `Would you pay for this? Vote here: ${idea.title}`;
  const long = `I'm testing an idea before I build it: ${idea.title}. ${idea.pitch} Would you pay for it? Vote in 2 taps:`;
  return [
    { id: 'x', label: 'X', href: `https://twitter.com/intent/tweet?text=${encodeURIComponent(ask)}&url=${encodeURIComponent(url)}` },
    { id: 'linkedin', label: 'LinkedIn', href: `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}` },
    { id: 'reddit', label: 'Reddit', href: `https://www.reddit.com/submit?url=${encodeURIComponent(url)}&title=${encodeURIComponent(`Would you pay for this? ${idea.title}`)}` },
    { id: 'whatsapp', label: 'WhatsApp', href: `https://wa.me/?text=${encodeURIComponent(`${long} ${url}`)}` },
    { id: 'copy', label: 'Copy message', text: `${long} ${url}` },
  ];
}

export function ShareKit({ idea, title = 'Get your first votes' }) {
  const url = `${window.location.origin}/ideas/${idea.id}`;
  return (
    <section className="p-5 rounded-[12px] border border-accent-strong bg-accent-soft space-y-3" aria-label="Share your idea">
      <div>
        <h2 className="text-sm font-bold text-ink">{title}</h2>
        <p className="text-xs text-ink-muted">Share your link. People can vote in 2 taps, and sign in after voting.</p>
      </div>
      <div className="flex flex-wrap gap-2">
        {shareLinks(idea, url).map((l) => l.href ? (
          <a key={l.id} href={l.href} target="_blank" rel="noopener noreferrer">
            <Button size="sm" variant="secondary" className="rounded-[8px] h-9">{l.label}</Button>
          </a>
        ) : (
          <Button key={l.id} size="sm" variant="secondary" className="rounded-[8px] h-9"
            onClick={() => { navigator.clipboard.writeText(l.text); toast.success('Message copied.'); }}>
            {l.label}
          </Button>
        ))}
      </div>
    </section>
  );
}
