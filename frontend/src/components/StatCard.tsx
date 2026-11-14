import React from 'react';
import { LucideIcon } from 'lucide-react';

interface StatCardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  description?: string;
  iconColor?: string;
  bgColor?: string;
  trend?: string;
}

export const StatCard: React.FC<StatCardProps> = ({
  title,
  value,
  icon: Icon,
  description,
  iconColor = 'text-accent',
  bgColor = 'bg-accent-soft',
  trend,
}) => {
  return (
    <div className="rounded-2xl p-5 bg-card border border-border shadow-[0_1px_2px_rgba(28,25,23,0.04)] hover:shadow-md hover:border-[#D6CEBE] transition-all">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-muted mb-1">{title}</p>
          <p className="text-2xl font-bold text-text tracking-tight tabular-nums">{value}</p>
        </div>
        <div className={`p-3 rounded-xl ${bgColor}`}>
          <Icon className={`w-6 h-6 ${iconColor}`} />
        </div>
      </div>
      {(description || trend) && (
        <div className="mt-3 pt-3 border-t border-border flex items-center justify-between text-xs text-text-secondary">
          <span>{description}</span>
          {trend && <span className="font-semibold text-success">{trend}</span>}
        </div>
      )}
    </div>
  );
};
