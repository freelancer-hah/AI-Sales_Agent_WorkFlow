import React from 'react';
import { AlertCircle, X } from 'lucide-react';

interface ErrorAlertProps {
  message: string;
  onDismiss?: () => void;
  title?: string;
}

export const ErrorAlert: React.FC<ErrorAlertProps> = ({
  message,
  onDismiss,
  title = 'Something went wrong',
}) => {
  return (
    <div className="bg-rose-50 border border-rose-200 text-rose-800 rounded-xl p-4 flex items-start gap-3 my-4">
      <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
      <div className="flex-1">
        <h4 className="text-sm font-semibold text-rose-900">{title}</h4>
        <p className="text-xs text-rose-700 mt-0.5">{message}</p>
      </div>
      {onDismiss && (
        <button
          onClick={onDismiss}
          className="text-rose-400 hover:text-rose-600 transition-colors p-1"
        >
          <X className="w-4 h-4" />
        </button>
      )}
    </div>
  );
};
