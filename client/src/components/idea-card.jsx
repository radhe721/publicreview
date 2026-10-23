import React from 'react';
import { IdeaRow } from './idea-row';

export { IdeaRow };

// Backwards compatibility for any components still importing IdeaCard
export function IdeaCard({ idea, rank, showRank, isFocused, className }) {
  return (
    <IdeaRow
      idea={idea}
      rank={rank}
      showRank={showRank}
      isFocused={isFocused}
      className={className}
    />
  );
}
