import React from 'react';
import { LucideIcon, Inbox } from 'lucide-react';

interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon: Icon = Inbox,
  title,
  description,
  actionLabel,
  onAction,
}) => {
  return (
    <div className="bg-card rounded-2xl border border-dashed border-border p-10 text-center flex flex-col items-center justify-center my-4 shadow-xs">
      <div className="w-14 h-14 bg-accent-soft text-accent rounded-2xl flex items-center justify-center mb-4">
        <Icon className="w-7 h-7" />
      </div>
      <h3 className="text-base font-bold text-text mb-1">{title}</h3>
      <p className="text-xs text-text-secondary max-w-md mb-6 leading-relaxed">{description}</p>
      {actionLabel && onAction && (
        <button
          onClick={onAction}
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-accent hover:bg-accent-hover text-on-accent text-xs font-semibold rounded-xl transition-all shadow-xs shadow-accent/20 active:scale-98"
        >
          {actionLabel}
        </button>
      )}
    </div>
  );
};
