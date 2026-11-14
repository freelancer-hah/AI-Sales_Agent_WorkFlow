import React, { useEffect, useState } from 'react';
import Cal, { getCalApi } from '@calcom/embed-react';
import { X, ExternalLink, Calendar, CheckCircle2, Sparkles, Building2, User, Mail } from 'lucide-react';
import { api } from '../services/api';

export interface CalBookingModalProps {
  isOpen: boolean;
  onClose: () => void;
  contact?: {
    name?: string;
    email?: string;
  };
  company?: {
    companyName?: string;
  };
  onBookingSuccess?: () => void;
}

export const CalBookingModal: React.FC<CalBookingModalProps> = ({
  isOpen,
  onClose,
  contact,
  company,
  onBookingSuccess,
}) => {
  const [calConfig, setCalConfig] = useState<{
    calOrigin: string;
    closerSlug: string;
    eventSlug: string;
    defaultCalLink: string;
  }>({
    calOrigin: 'https://cal.com',
    closerSlug: 'abdulhannan-digitalsofts',
    eventSlug: '30min',
    defaultCalLink: 'abdulhannan-digitalsofts/30min',
  });

  const [bookingSuccess, setBookingSuccess] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setBookingSuccess(false);
      api.getCalConfig()
        .then((res) => {
          if (res.success && res.data) {
            setCalConfig(res.data);
          }
        })
        .catch(() => {
          // Defaults are already set
        });
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;

    (async function initCal() {
      try {
        const cal = await getCalApi();
        if (cal) {
          cal('ui', {
            theme: 'light',
            styles: { branding: { brandColor: '#4f46e5' } },
            hideEventTypeDetails: false,
            layout: 'month_view',
          });
          cal('on', {
            action: 'bookingSuccessful',
            callback: () => {
              setBookingSuccess(true);
              if (onBookingSuccess) {
                onBookingSuccess();
              }
              setTimeout(() => {
                onClose();
              }, 2500);
            },
          });
        }
      } catch (err) {
        console.warn('Cal embed init warning:', err);
      }
    })();
  }, [isOpen, calConfig.calOrigin, onBookingSuccess, onClose]);

  if (!isOpen) return null;

  const calLink = calConfig.defaultCalLink || `${calConfig.closerSlug}/${calConfig.eventSlug}`;
  
  // Construct direct link for opening in a new browser tab
  const standaloneUrl = new URL(`${calConfig.calOrigin.replace(/\/+$/, '')}/${calLink}`);
  if (contact?.name) standaloneUrl.searchParams.set('name', contact.name);
  if (contact?.email) standaloneUrl.searchParams.set('email', contact.email);
  if (company?.companyName) standaloneUrl.searchParams.set('notes', `Company: ${company.companyName}`);

  const calConfigProps: Record<string, string> = {
    layout: 'month_view',
  };
  if (contact?.name) calConfigProps.name = contact.name;
  if (contact?.email) calConfigProps.email = contact.email;
  if (company?.companyName) calConfigProps.notes = `Company: ${company.companyName}`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs transition-opacity animate-fade-in"
        onClick={onClose}
      />

      {/* Modal Dialog */}
      <div className="relative w-full max-w-4xl bg-surface rounded-2xl shadow-2xl border border-border flex flex-col max-h-[92vh] overflow-hidden z-10 animate-scale-up">
        {/* Header */}
        <div className="px-6 py-4 border-b border-border flex items-center justify-between bg-surface-raised/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-accent/10 border border-accent/20 flex items-center justify-center text-accent">
              <Calendar className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-text">
                  Cal.diy Live Scheduler
                </h3>
                <span className="px-2 py-0.5 text-[10px] font-bold uppercase rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                  100% Open Source (MIT)
                </span>
              </div>
              <p className="text-xs text-text-secondary mt-0.5">
                Two-way Google Calendar synchronization • Instant Google Meet room generation
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <a
              href={standaloneUrl.toString()}
              target="_blank"
              rel="noopener noreferrer"
              className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-text-secondary hover:text-text bg-surface hover:bg-border/40 border border-border rounded-lg transition-colors"
              title="Open full booking page in a new browser window"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span>Full Page</span>
            </a>
            <button
              onClick={onClose}
              className="p-1.5 text-muted hover:text-text rounded-lg hover:bg-border/30 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Prospect Metadata Strip (if booking for a specific lead) */}
        {(contact?.name || contact?.email || company?.companyName) && (
          <div className="px-6 py-2 bg-accent/5 border-b border-accent/10 flex flex-wrap items-center gap-4 text-xs text-text">
            <span className="text-[11px] font-bold text-accent uppercase tracking-wider flex items-center gap-1">
              <Sparkles className="w-3 h-3" /> Booking For:
            </span>
            {company?.companyName && (
              <span className="flex items-center gap-1 font-medium text-text">
                <Building2 className="w-3.5 h-3.5 text-text-secondary" />
                {company.companyName}
              </span>
            )}
            {contact?.name && (
              <span className="flex items-center gap-1 font-medium text-text">
                <User className="w-3.5 h-3.5 text-text-secondary" />
                {contact.name}
              </span>
            )}
            {contact?.email && (
              <span className="flex items-center gap-1 text-text-secondary font-mono text-[11px]">
                <Mail className="w-3.5 h-3.5 text-text-secondary" />
                {contact.email}
              </span>
            )}
          </div>
        )}

        {/* Success Toast Banner */}
        {bookingSuccess && (
          <div className="mx-6 mt-4 p-4 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center gap-3 animate-fade-in">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            <div>
              <p className="text-xs font-bold text-emerald-900">
                Meeting Confirmed via Cal.diy!
              </p>
              <p className="text-[11px] text-emerald-700">
                Google Meet link generated and synced with Cybells CRM. Gemini AI is compiling the closer dossier...
              </p>
            </div>
          </div>
        )}

        {/* Cal Component Container */}
        <div className="flex-1 p-2 sm:p-4 min-h-[520px] max-h-[640px] overflow-y-auto bg-surface">
          <Cal
            calOrigin={calConfig.calOrigin}
            calLink={calLink}
            style={{ width: '100%', height: '100%', minHeight: '520px', border: 'none' }}
            config={calConfigProps}
          />
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-border bg-surface-raised/30 flex items-center justify-between text-[11px] text-text-secondary">
          <div className="flex items-center gap-2">
            <span className="inline-block w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>Webhook live at: <code className="font-mono text-[10px] bg-border/40 px-1 py-0.5 rounded">/api/webhooks/cal</code></span>
          </div>
          <div>
            Closer Handle: <strong className="text-text font-mono">@{calConfig.closerSlug}</strong>
          </div>
        </div>
      </div>
    </div>
  );
};
