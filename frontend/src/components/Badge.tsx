import React from 'react';

interface BadgeProps {
  children: React.ReactNode;
  variant?: 'default' | 'success' | 'warning' | 'danger' | 'info' | 'purple' | 'slate';
  size?: 'sm' | 'md';
  className?: string;
}

export const Badge: React.FC<BadgeProps> = ({
  children,
  variant = 'default',
  size = 'md',
  className = '',
}) => {
  const variantStyles = {
    default: 'bg-track text-text-secondary border-border',
    success: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    warning: 'bg-amber-50 text-amber-700 border-amber-200',
    danger: 'bg-rose-50 text-rose-700 border-rose-200',
    info: 'bg-sky-50 text-sky-700 border-sky-200',
    purple: 'bg-accent-soft text-accent border-accent/20',
    slate: 'bg-track text-muted border-border',
  };

  const sizeStyles = {
    sm: 'text-xs px-2 py-0.5',
    md: 'text-xs px-2.5 py-1 font-medium',
  };

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border ${variantStyles[variant]} ${sizeStyles[size]} ${className}`}
    >
      {children}
    </span>
  );
};

export const ScoreBadge: React.FC<{ score: number }> = ({ score }) => {
  let variant: 'success' | 'warning' | 'danger' | 'purple' = 'danger';
  if (score >= 80) variant = 'success';
  else if (score >= 60) variant = 'purple';
  else if (score >= 40) variant = 'warning';

  return (
    <Badge variant={variant} className="font-semibold tabular-nums">
      {score}/100
    </Badge>
  );
};
