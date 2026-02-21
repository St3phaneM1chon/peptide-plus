'use client';

import { useState, useRef } from 'react';
import { Send, Paperclip, X, Bold, Italic, Underline, Save } from 'lucide-react';
import { toast } from 'sonner';
import { useI18n } from '@/i18n/client';
import { Button } from '@/components/admin';

interface EmailComposerProps {
  onClose: () => void;
  replyTo?: { to: string; subject: string; body: string } | null;
}

export default function EmailComposer({ onClose, replyTo }: EmailComposerProps) {
  const { t } = useI18n();
  const [to, setTo] = useState(replyTo?.to ?? '');
  const [cc, setCc] = useState('');
  const [subject, setSubject] = useState(replyTo ? `Re: ${replyTo.subject}` : '');
  const [showCc, setShowCc] = useState(false);
  const [sending, setSending] = useState(false);
  const bodyRef = useRef<HTMLDivElement>(null);

  const execCommand = (cmd: string) => {
    document.execCommand(cmd, false);
    bodyRef.current?.focus();
  };

  const handleSend = async () => {
    if (!to || !subject) {
      toast.error(t('admin.emailComposer.fillRequired'));
      return;
    }

    setSending(true);
    try {
      const textBody = bodyRef.current?.innerText ?? '';
      const htmlBody = bodyRef.current?.innerHTML ?? '';

      const res = await fetch('/api/admin/emails/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ to, cc: cc || undefined, subject, textBody, htmlBody }),
      });

      const data = await res.json();
      if (data.success) {
        toast.success(t('admin.emailComposer.sent'));
        onClose();
      } else {
        toast.error(data.error || t('common.errorOccurred'));
      }
    } catch {
      toast.error(t('common.errorOccurred'));
    } finally {
      setSending(false);
    }
  };

  const handleSaveDraft = () => {
    const draft = {
      to, cc, subject,
      body: bodyRef.current?.innerHTML ?? '',
      savedAt: new Date().toISOString(),
    };
    const drafts = JSON.parse(localStorage.getItem('emailDrafts') || '[]');
    drafts.push(draft);
    localStorage.setItem('emailDrafts', JSON.stringify(drafts));
    toast.success(t('admin.emailComposer.draftSaved'));
  };

  return (
    <div className="flex flex-col h-full bg-white">
      {/* Toolbar */}
      <div className="flex items-center gap-2 px-4 py-2 border-b border-slate-200 bg-slate-50 flex-shrink-0">
        <Button variant="primary" icon={Send} onClick={handleSend} disabled={sending}>
          {sending ? t('admin.emailComposer.sending') : t('admin.emailComposer.send')}
        </Button>
        <Button variant="secondary" icon={Save} onClick={handleSaveDraft}>
          {t('admin.emailComposer.saveDraft')}
        </Button>
        <div className="flex-1" />
        <button type="button" onClick={onClose} className="p-1.5 rounded hover:bg-slate-200 text-slate-500">
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Fields */}
      <div className="px-4 py-2 space-y-2 border-b border-slate-200 flex-shrink-0">
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium text-slate-500 w-12">{t('admin.emailComposer.to')}:</label>
          <input
            type="email"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            className="flex-1 text-sm border-0 focus:ring-0 px-0 py-1 text-slate-900 placeholder:text-slate-400"
            placeholder={t('admin.emailComposer.toPlaceholder')}
            required
          />
          {!showCc && (
            <button type="button" onClick={() => setShowCc(true)} className="text-xs text-sky-600 hover:underline">
              Cc
            </button>
          )}
        </div>
        {showCc && (
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium text-slate-500 w-12">Cc:</label>
            <input
              type="email"
              value={cc}
              onChange={(e) => setCc(e.target.value)}
              className="flex-1 text-sm border-0 focus:ring-0 px-0 py-1 text-slate-900 placeholder:text-slate-400"
              placeholder={t('admin.emailComposer.ccPlaceholder')}
            />
          </div>
        )}
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium text-slate-500 w-12">{t('admin.emailComposer.subject')}:</label>
          <input
            type="text"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            className="flex-1 text-sm border-0 focus:ring-0 px-0 py-1 text-slate-900 placeholder:text-slate-400"
            placeholder={t('admin.emailComposer.subjectPlaceholder')}
            required
          />
        </div>
      </div>

      {/* Formatting toolbar */}
      <div className="flex items-center gap-1 px-4 py-1.5 border-b border-slate-100 flex-shrink-0">
        <button type="button" onClick={() => execCommand('bold')} className="p-1.5 rounded hover:bg-slate-100" title="Bold">
          <Bold className="w-3.5 h-3.5 text-slate-600" />
        </button>
        <button type="button" onClick={() => execCommand('italic')} className="p-1.5 rounded hover:bg-slate-100" title="Italic">
          <Italic className="w-3.5 h-3.5 text-slate-600" />
        </button>
        <button type="button" onClick={() => execCommand('underline')} className="p-1.5 rounded hover:bg-slate-100" title="Underline">
          <Underline className="w-3.5 h-3.5 text-slate-600" />
        </button>
        <div className="w-px h-4 bg-slate-200 mx-1" />
        <label className="p-1.5 rounded hover:bg-slate-100 cursor-pointer" title={t('admin.emailComposer.attachment')}>
          <Paperclip className="w-3.5 h-3.5 text-slate-600" />
          <input type="file" className="hidden" onChange={() => toast.info(t('admin.emailComposer.attachmentNote'))} />
        </label>
      </div>

      {/* Body (contentEditable) */}
      <div
        ref={bodyRef}
        contentEditable
        suppressContentEditableWarning
        className="flex-1 px-4 py-3 text-sm text-slate-900 overflow-y-auto focus:outline-none"
        data-placeholder={t('admin.emailComposer.bodyPlaceholder')}
        dangerouslySetInnerHTML={replyTo ? {
          __html: `<br/><br/><div style="border-left:2px solid #94a3b8;padding-left:12px;color:#64748b;margin-top:16px"><p>Le ${new Date().toLocaleDateString()}, ${replyTo.to} a écrit :</p>${replyTo.body}</div>`
        } : undefined}
      />
    </div>
  );
}
