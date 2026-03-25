'use client';

import { useState, useEffect, type FormEvent } from 'react';
import { useSearchParams } from 'next/navigation';
import { MessageSquare, Send, Pin } from 'lucide-react';
import { useTranslations } from '@/hooks/useTranslations';

export default function DiscussionsPage() {
  const { t } = useTranslations();
  const searchParams = useSearchParams();
  const [discussions, setDiscussions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  // FIX P2-08: Read courseId from URL query param instead of empty state
  const [courseId, setCourseId] = useState(searchParams?.get('courseId') ?? '');
  const [newTitle, setNewTitle] = useState('');
  const [newContent, setNewContent] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!courseId) { setLoading(false); return; }
    fetch(`/api/lms/discussions?courseId=${encodeURIComponent(courseId)}`)
      .then(r => r.json())
      .then(d => setDiscussions(d.data ?? []))
      .catch(() => setDiscussions([]))
      .finally(() => setLoading(false));
  }, [courseId]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!courseId || !newTitle.trim()) return;
    setSubmitting(true);
    try {
      await fetch('/api/lms/discussions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ courseId, title: newTitle, content: newContent }),
      });
      setNewTitle(''); setNewContent('');
      // Refresh
      const res = await fetch(`/api/lms/discussions?courseId=${encodeURIComponent(courseId)}`);
      const data = await res.json();
      setDiscussions(data.data ?? []);
    } catch { /* */ }
    finally { setSubmitting(false); }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-12">
      <h1 className="text-3xl font-bold mb-2 flex items-center gap-3">
        <MessageSquare className="h-8 w-8 text-blue-500" /> {t('lms.discussions.title')}
      </h1>
      <p className="text-muted-foreground mb-8">{t('lms.discussions.subtitle')}</p>

      {!courseId && (
        <div className="text-center py-12">
          <p className="text-muted-foreground mb-4">{t('lms.discussions.enterCourseId')}</p>
          <div className="flex gap-2 max-w-md mx-auto">
            <input type="text" placeholder={t('lms.discussions.courseIdPlaceholder')} className="flex-1 rounded-md border px-3 py-2 text-sm"
              onKeyDown={(e) => { if (e.key === 'Enter') setCourseId((e.target as HTMLInputElement).value); }} />
            <button onClick={() => {}} className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium">{t('lms.discussions.load')}</button>
          </div>
        </div>
      )}

      {courseId && (
        <>
          <form onSubmit={handleSubmit} className="rounded-xl border p-4 mb-6 space-y-3">
            <input type="text" placeholder={t('lms.discussions.titlePlaceholder')} value={newTitle} onChange={(e) => setNewTitle(e.target.value)} className="w-full rounded-md border px-3 py-2 text-sm" required />
            <textarea placeholder={t('lms.discussions.messagePlaceholder')} value={newContent} onChange={(e) => setNewContent(e.target.value)} className="w-full rounded-md border px-3 py-2 text-sm min-h-[80px]" required />
            <button type="submit" disabled={submitting} className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium">
              <Send className="h-4 w-4" /> {submitting ? t('lms.discussions.publishing') : t('lms.discussions.publish')}
            </button>
          </form>

          {loading ? (
            <div className="text-center py-8 text-muted-foreground">{t('lms.discussions.loading')}</div>
          ) : discussions.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">{t('lms.discussions.empty')}</div>
          ) : (
            <div className="space-y-3">
              {discussions.map((d: any) => (
                <div key={d.id} className="rounded-lg border p-4 hover:border-primary/30 transition-colors">
                  <div className="flex items-start gap-2">
                    {d.isPinned && <Pin className="h-4 w-4 text-amber-500 flex-shrink-0 mt-1" />}
                    <div className="flex-1">
                      <h3 className="font-medium">{d.title}</h3>
                      <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{d.content}</p>
                      <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                        <span>{d.replyCount} {t('lms.discussions.replies')}</span>
                        <span>{new Date(d.createdAt).toLocaleDateString('fr-CA')}</span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
