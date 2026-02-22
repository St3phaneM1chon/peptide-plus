'use client';

import { useState, useEffect, useRef } from 'react';
import {
  ArrowLeft, Save, Send, Eye, Code, Bold, Italic, Underline,
  Type, Heading1, List, Link2, Variable,
} from 'lucide-react';
import { useI18n } from '@/i18n/client';
import { toast } from 'sonner';
import DOMPurify from 'dompurify';

interface CampaignEditorProps {
  campaignId: string;
  onBack: () => void;
}

export default function CampaignEditor({ campaignId, onBack }: CampaignEditorProps) {
  const { t, locale } = useI18n();
  const [name, setName] = useState('');
  const [subject, setSubject] = useState('');
  const [htmlContent, setHtmlContent] = useState('');
  const [textContent, setTextContent] = useState('');
  const [segmentQuery, setSegmentQuery] = useState<Record<string, unknown> | null>(null);
  const [status, setStatus] = useState('DRAFT');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [mode, setMode] = useState<'visual' | 'code' | 'preview'>('visual');
  const [previewHtml, setPreviewHtml] = useState('');
  const [previewSubject, setPreviewSubject] = useState('');
  const [availableVars, setAvailableVars] = useState<string[]>([]);
  const editorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchCampaign();
  }, [campaignId]);

  const fetchCampaign = async () => {
    try {
      const res = await fetch(`/api/admin/emails/campaigns/${campaignId}`);
      if (!res.ok) { toast.error(t('common.errorOccurred')); return; }
      const data = await res.json();
      const c = data.campaign;
      setName(c.name || '');
      setSubject(c.subject || '');
      setHtmlContent(c.htmlContent || '');
      setTextContent(c.textContent || '');
      setSegmentQuery(c.segmentQuery || null);
      setStatus(c.status || 'DRAFT');
    } catch {
      toast.error(t('common.errorOccurred'));
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!name.trim() || !subject.trim()) {
      toast.error(t('admin.emailComposer.fillRequired'));
      return;
    }
    setSaving(true);
    try {
      // Sync visual editor content back to htmlContent
      if (mode === 'visual' && editorRef.current) {
        setHtmlContent(editorRef.current.innerHTML);
      }

      const res = await fetch(`/api/admin/emails/campaigns/${campaignId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          subject,
          htmlContent: mode === 'visual' && editorRef.current ? editorRef.current.innerHTML : htmlContent,
          textContent: textContent || undefined,
          segmentQuery: segmentQuery || undefined,
        }),
      });
      if (res.ok) {
        toast.success(t('common.saved'));
      } else {
        const data = await res.json();
        toast.error(data.error || t('common.errorOccurred'));
      }
    } catch {
      toast.error(t('common.errorOccurred'));
    } finally {
      setSaving(false);
    }
  };

  const fetchPreview = async () => {
    // Save first, then preview
    if (mode === 'visual' && editorRef.current) {
      const current = editorRef.current.innerHTML;
      if (current !== htmlContent) {
        setHtmlContent(current);
        // Quick save
        await fetch(`/api/admin/emails/campaigns/${campaignId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ htmlContent: current }),
        });
      }
    }
    try {
      const res = await fetch(`/api/admin/emails/campaigns/${campaignId}/preview`);
      if (res.ok) {
        const data = await res.json();
        setPreviewHtml(data.html);
        setPreviewSubject(data.subject);
        setAvailableVars(data.variables || []);
        setMode('preview');
      }
    } catch {
      toast.error(t('common.errorOccurred'));
    }
  };

  const execCommand = (cmd: string, value?: string) => {
    document.execCommand(cmd, false, value);
    editorRef.current?.focus();
  };

  const insertVariable = (varName: string) => {
    if (mode === 'visual' && editorRef.current) {
      document.execCommand('insertText', false, `{{${varName}}}`);
      editorRef.current.focus();
    } else if (mode === 'code') {
      setHtmlContent(prev => prev + `{{${varName}}}`);
    }
  };

  const handleSend = async () => {
    if (!confirm(t('admin.emails.campaigns.confirmSend'))) return;
    await handleSave();
    try {
      const res = await fetch(`/api/admin/emails/campaigns/${campaignId}/send`, { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        toast.success(`${t('admin.emailComposer.sent')} (${data.stats?.sent || 0} emails)`);
        onBack();
      } else {
        const data = await res.json();
        toast.error(data.error || t('common.errorOccurred'));
      }
    } catch {
      toast.error(t('common.errorOccurred'));
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64" role="status" aria-label="Loading">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-sky-500" />
        <span className="sr-only">Loading...</span>
      </div>
    );
  }

  const isEditable = status === 'DRAFT' || status === 'FAILED';

  return (
    <div className="flex flex-col h-full bg-white">
      {/* Top bar */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-200 bg-slate-50 flex-shrink-0">
        <button onClick={onBack} className="p-1.5 hover:bg-slate-200 rounded">
          <ArrowLeft className="h-4 w-4 text-slate-600" />
        </button>
        <div className="flex-1 min-w-0">
          {isEditable ? (
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="text-sm font-semibold text-slate-900 bg-transparent border-0 focus:ring-0 p-0 w-full"
              placeholder={t('admin.emails.campaigns.campaignPrefix')}
            />
          ) : (
            <span className="text-sm font-semibold text-slate-900">{name}</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={fetchPreview}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50"
          >
            <Eye className="h-3.5 w-3.5" /> {t('admin.emails.campaigns.preview')}
          </button>
          {isEditable && (
            <>
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-sky-500 rounded-lg hover:bg-sky-600 disabled:opacity-50"
              >
                <Save className="h-3.5 w-3.5" /> {saving ? t('admin.emails.flows.saving') : t('admin.emails.flows.save')}
              </button>
              <button
                onClick={handleSend}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-green-500 rounded-lg hover:bg-green-600"
              >
                <Send className="h-3.5 w-3.5" /> {t('admin.emails.campaigns.send')}
              </button>
            </>
          )}
        </div>
      </div>

      {/* Subject line */}
      <div className="px-4 py-2 border-b border-slate-200 flex-shrink-0">
        <div className="flex items-center gap-2">
          <label className="text-xs font-medium text-slate-500 w-16">{t('admin.emailComposer.subject')}:</label>
          {isEditable ? (
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="flex-1 text-sm border-0 focus:ring-0 px-0 py-1 text-slate-900 placeholder:text-slate-400"
              placeholder={t('admin.emailComposer.subjectPlaceholder')}
            />
          ) : (
            <span className="text-sm text-slate-900">{subject}</span>
          )}
        </div>
      </div>

      {/* Mode tabs + toolbar */}
      {isEditable && mode !== 'preview' && (
        <div className="flex items-center gap-1 px-4 py-1.5 border-b border-slate-100 flex-shrink-0">
          {/* Mode toggle */}
          <button
            onClick={() => {
              if (mode === 'visual' && editorRef.current) {
                setHtmlContent(editorRef.current.innerHTML);
              }
              setMode(mode === 'visual' ? 'code' : 'visual');
            }}
            className={`px-2 py-1 text-[10px] font-medium rounded ${mode === 'code' ? 'bg-slate-200 text-slate-700' : 'text-slate-500 hover:bg-slate-100'}`}
          >
            <Code className="h-3 w-3 inline mr-1" />{mode === 'code' ? 'HTML' : 'Visual'}
          </button>
          <div className="w-px h-4 bg-slate-200 mx-1" />

          {mode === 'visual' && (
            <>
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
              <button type="button" onClick={() => execCommand('formatBlock', 'h1')} className="p-1.5 rounded hover:bg-slate-100" title="Heading">
                <Heading1 className="w-3.5 h-3.5 text-slate-600" />
              </button>
              <button type="button" onClick={() => execCommand('insertUnorderedList')} className="p-1.5 rounded hover:bg-slate-100" title="List">
                <List className="w-3.5 h-3.5 text-slate-600" />
              </button>
              <button type="button" onClick={() => {
                const url = prompt('URL:');
                if (url) execCommand('createLink', url);
              }} className="p-1.5 rounded hover:bg-slate-100" title="Link">
                <Link2 className="w-3.5 h-3.5 text-slate-600" />
              </button>
            </>
          )}

          <div className="flex-1" />

          {/* Variable insertion */}
          <div className="relative group">
            <button className="flex items-center gap-1 px-2 py-1 text-[10px] font-medium text-sky-600 hover:bg-sky-50 rounded">
              <Variable className="h-3 w-3" /> Variables
            </button>
            <div className="absolute right-0 top-full mt-1 bg-white border border-slate-200 rounded-lg shadow-lg hidden group-hover:block z-10 min-w-[140px]">
              {['prenom', 'email', 'nom', 'company'].map(v => (
                <button
                  key={v}
                  onClick={() => insertVariable(v)}
                  className="block w-full text-left px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-50"
                >
                  {`{{${v}}}`}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Editor area */}
      <div className="flex-1 overflow-y-auto">
        {mode === 'visual' && (
          <div
            ref={editorRef}
            contentEditable={isEditable}
            suppressContentEditableWarning
            className="h-full px-6 py-4 text-sm text-slate-900 focus:outline-none prose prose-sm max-w-none"
            dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(htmlContent) }}
          />
        )}

        {mode === 'code' && (
          <textarea
            value={htmlContent}
            onChange={(e) => setHtmlContent(e.target.value)}
            className="w-full h-full px-4 py-3 text-xs font-mono text-slate-800 bg-slate-50 border-0 focus:ring-0 resize-none"
            spellCheck={false}
            readOnly={!isEditable}
          />
        )}

        {mode === 'preview' && (
          <div className="p-4">
            <div className="max-w-2xl mx-auto">
              <div className="bg-slate-100 rounded-t-lg p-3 flex items-center justify-between">
                <div>
                  <span className="text-[10px] text-slate-400 block">{t('admin.emailComposer.subject')}:</span>
                  <span className="text-sm font-medium text-slate-900">{previewSubject || subject}</span>
                </div>
                <button
                  onClick={() => setMode('visual')}
                  className="text-xs text-sky-600 hover:underline"
                >
                  {t('admin.emails.inbox.cancel')}
                </button>
              </div>
              {availableVars.length > 0 && (
                <div className="bg-sky-50 px-3 py-1.5 text-[10px] text-sky-700 border-x border-sky-100">
                  Variables: {availableVars.map(v => `{{${v}}}`).join(', ')}
                </div>
              )}
              <div className="border border-slate-200 rounded-b-lg bg-white">
                <iframe
                  srcDoc={DOMPurify.sanitize(previewHtml || htmlContent)}
                  className="w-full min-h-[400px] border-0"
                  sandbox="allow-same-origin"
                  title="Campaign preview"
                />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Text content (optional) */}
      {isEditable && mode !== 'preview' && (
        <div className="border-t border-slate-200 bg-slate-50 px-4 py-2 flex-shrink-0">
          <details className="text-xs">
            <summary className="cursor-pointer text-slate-500 font-medium">
              <Type className="h-3 w-3 inline mr-1" />
              {t('admin.emails.campaigns.textVersion')}
            </summary>
            <textarea
              value={textContent}
              onChange={(e) => setTextContent(e.target.value)}
              className="w-full mt-2 p-2 text-xs border border-slate-200 rounded bg-white resize-none focus:ring-1 focus:ring-sky-400"
              rows={4}
              placeholder={t('admin.emails.campaigns.textVersionPlaceholder')}
            />
          </details>
        </div>
      )}
    </div>
  );
}
