'use client';

import { useState, useRef, useMemo, useCallback } from 'react';
import { Send, X, Save, File } from 'lucide-react';
import { toast } from 'sonner';
import DOMPurify from 'dompurify';
import { useI18n } from '@/i18n/client';
import { Button } from '@/components/admin';
import { EmailToolbar } from '@/components/admin/EmailToolbar';
import { addCSRFHeader } from '@/lib/csrf';

interface EmailComposerProps {
  onClose: () => void;
  replyTo?: { to: string; subject: string; body: string } | null;
}

interface Attachment {
  filename: string;
  content: string; // base64
  contentType: string;
  size: number;
}

const ALLOWED_EXTENSIONS = ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'csv', 'png', 'jpg', 'jpeg', 'gif'];
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB per file
const MAX_TOTAL_SIZE = 25 * 1024 * 1024; // 25 MB total

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getFileExtension(filename: string): string {
  return (filename.split('.').pop() || '').toLowerCase();
}

export default function EmailComposer({ onClose, replyTo }: EmailComposerProps) {
  const { t } = useI18n();
  const [to, setTo] = useState(replyTo?.to ?? '');
  const [cc, setCc] = useState('');
  const [subject, setSubject] = useState(replyTo ? `Re: ${replyTo.subject}` : '');
  const [showCc, setShowCc] = useState(false);
  const [sending, setSending] = useState(false);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [uploading, setUploading] = useState(false);
  const bodyRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Sanitize replyTo body to prevent XSS
  const sanitizedReplyHtml = useMemo(() => {
    if (!replyTo?.body) return undefined;
    const cleanBody = DOMPurify.sanitize(replyTo.body, {
      ALLOWED_TAGS: ['p', 'br', 'b', 'i', 'u', 'strong', 'em', 'a', 'span', 'div', 'ul', 'ol', 'li', 'blockquote', 'h1', 'h2', 'h3', 'h4', 'img', 'table', 'tr', 'td', 'th', 'thead', 'tbody'],
      ALLOWED_ATTR: ['href', 'src', 'alt', 'style', 'class', 'target'],
      ALLOW_DATA_ATTR: false,
    });
    const dateStr = new Date().toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });
    const safeFrom = DOMPurify.sanitize(replyTo.to);
    return `<br/><br/><div style="border-left:2px solid #94a3b8;padding-left:12px;color:#64748b;margin-top:16px"><p>${dateStr}, ${safeFrom}:</p>${cleanBody}</div>`;
  }, [replyTo]);

  const totalAttachmentSize = useMemo(() => {
    return attachments.reduce((sum, a) => sum + a.size, 0);
  }, [attachments]);

  const handleFileSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    // Validate files before uploading
    const filesToUpload: File[] = [];
    let newTotalSize = totalAttachmentSize;

    for (const file of Array.from(files)) {
      const ext = getFileExtension(file.name);
      if (!ALLOWED_EXTENSIONS.includes(ext)) {
        toast.error(`"${file.name}": type .${ext} non autorise. Types acceptes: ${ALLOWED_EXTENSIONS.join(', ')}`);
        continue;
      }
      if (file.size > MAX_FILE_SIZE) {
        toast.error(`"${file.name}" depasse la limite de 10 MB (${formatFileSize(file.size)})`);
        continue;
      }
      newTotalSize += file.size;
      if (newTotalSize > MAX_TOTAL_SIZE) {
        toast.error(`Taille totale des pieces jointes depasse 25 MB`);
        break;
      }
      filesToUpload.push(file);
    }

    if (filesToUpload.length === 0) {
      // Reset the input so the same file can be re-selected
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    setUploading(true);
    try {
      const formData = new FormData();
      filesToUpload.forEach(f => formData.append('files', f));

      const csrfHeaders = addCSRFHeader();
      // Remove Content-Type so browser sets multipart/form-data with boundary
      const headers: Record<string, string> = {};
      if (csrfHeaders && typeof csrfHeaders === 'object') {
        for (const [k, v] of Object.entries(csrfHeaders)) {
          if (k.toLowerCase() !== 'content-type') {
            headers[k] = v as string;
          }
        }
      }

      const res = await fetch('/api/admin/emails/attachments', {
        method: 'POST',
        headers,
        body: formData,
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Upload failed');
      }

      const data = await res.json();
      const newAttachments: Attachment[] = (data.attachments || []).map((a: Attachment) => ({
        filename: a.filename,
        content: a.content,
        contentType: a.contentType,
        size: a.size,
      }));

      setAttachments(prev => [...prev, ...newAttachments]);
      toast.success(`${newAttachments.length} fichier(s) attache(s)`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erreur lors de l\'upload');
    } finally {
      setUploading(false);
      // Reset the file input so the same file can be selected again
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }, [totalAttachmentSize]);

  const removeAttachment = useCallback((filename: string) => {
    setAttachments(prev => prev.filter(a => a.filename !== filename));
  }, []);

  const handleSend = async () => {
    if (!to || !subject) {
      toast.error(t('admin.emailComposer.fillRequired'));
      return;
    }

    setSending(true);
    try {
      const textBody = bodyRef.current?.innerText ?? '';
      const htmlBody = bodyRef.current?.innerHTML ?? '';

      const payload: Record<string, unknown> = {
        to,
        cc: cc || undefined,
        subject,
        textBody,
        htmlBody,
      };

      // Include attachments if any
      if (attachments.length > 0) {
        payload.attachments = attachments.map(a => ({
          filename: a.filename,
          content: a.content,
          contentType: a.contentType,
        }));
      }

      const res = await fetch('/api/admin/emails/send', {
        method: 'POST',
        headers: addCSRFHeader({ 'Content-Type': 'application/json' }),
        body: JSON.stringify(payload),
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

  // SECURITY WARNING (#23): Email drafts are stored in plaintext localStorage.
  // localStorage is accessible to any JS running on the same origin (XSS risk).
  // Mitigation: drafts auto-expire after 24h on load, and are cleared on logout.
  // For higher-sensitivity environments, consider encrypting draft content or
  // storing drafts server-side behind authentication.

  const handleSaveDraft = () => {
    const draft = {
      to, cc, subject,
      body: bodyRef.current?.innerHTML ?? '',
      savedAt: new Date().toISOString(),
    };
    let drafts: unknown[];
    try { drafts = JSON.parse(localStorage.getItem('emailDrafts') || '[]'); } catch { drafts = []; }
    if (!Array.isArray(drafts)) drafts = [];
    drafts.push(draft);
    // Keep only the 10 most recent drafts to prevent localStorage bloat
    if (drafts.length > 10) drafts = drafts.slice(-10);
    localStorage.setItem('emailDrafts', JSON.stringify(drafts));
    toast.success(t('admin.emailComposer.draftSaved'));
  };

  /**
   * Clear all email drafts from localStorage.
   * Call this on logout to prevent drafts from persisting after session ends.
   */
  const clearDraftsOnLogout = () => {
    localStorage.removeItem('emailDrafts');
  };

  // Expose clearDraftsOnLogout on window for the auth/logout flow to call.
  // Usage in logout handler: window.__clearEmailDrafts?.()
  if (typeof window !== 'undefined') {
    (window as unknown as Record<string, unknown>).__clearEmailDrafts = clearDraftsOnLogout;
  }

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
        <button type="button" onClick={onClose} aria-label="Close email composer" className="p-1.5 rounded hover:bg-slate-200 text-slate-500">
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
            aria-label="Recipient email address"
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
              aria-label="CC email address"
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
            aria-label="Email subject"
            required
          />
        </div>
      </div>

      {/* Formatting toolbar */}
      <EmailToolbar
        editorRef={bodyRef}
        onAttach={() => fileInputRef.current?.click()}
        uploading={uploading}
        trailing={attachments.length > 0 ? (
          <span className="text-[10px] text-slate-400 ml-1">
            {attachments.length} fichier(s) - {formatFileSize(totalAttachmentSize)}
          </span>
        ) : undefined}
      />
      <input
        ref={fileInputRef}
        type="file"
        className="hidden"
        aria-label="Attach file"
        multiple
        accept=".pdf,.doc,.docx,.xls,.xlsx,.csv,.png,.jpg,.jpeg,.gif"
        onChange={handleFileSelect}
      />

      {/* Attachment chips */}
      {attachments.length > 0 && (
        <div className="px-4 py-2 border-b border-slate-100 flex-shrink-0 flex flex-wrap gap-2">
          {attachments.map((att) => (
            <div
              key={att.filename}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-slate-100 border border-slate-200 rounded-lg text-xs text-slate-700 max-w-[200px]"
            >
              <File className="w-3 h-3 flex-shrink-0 text-slate-400" />
              <span className="truncate" title={att.filename}>{att.filename}</span>
              <span className="text-slate-400 flex-shrink-0">({formatFileSize(att.size)})</span>
              <button
                type="button"
                onClick={() => removeAttachment(att.filename)}
                className="flex-shrink-0 p-0.5 rounded hover:bg-slate-200 text-slate-400 hover:text-red-500"
                aria-label={`Remove ${att.filename}`}
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Body (contentEditable) */}
      <div
        ref={bodyRef}
        contentEditable
        suppressContentEditableWarning
        role="textbox"
        aria-label="Email body"
        aria-multiline="true"
        className="flex-1 px-4 py-3 text-sm text-slate-900 overflow-y-auto focus:outline-none"
        data-placeholder={t('admin.emailComposer.bodyPlaceholder')}
        dangerouslySetInnerHTML={sanitizedReplyHtml ? { __html: sanitizedReplyHtml } : undefined}
      />
    </div>
  );
}
