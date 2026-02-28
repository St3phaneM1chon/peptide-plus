'use client';

import { useState } from 'react';
import { Calendar, Send, Clock, Instagram, Facebook, Twitter, Plus, Sparkles, Trash2 } from 'lucide-react';
import { useI18n } from '@/i18n/client';
import { toast } from 'sonner';

interface ScheduledPost {
  id: string;
  platform: 'instagram' | 'facebook' | 'twitter';
  content: string;
  imageUrl?: string;
  scheduledAt: Date;
  status: 'draft' | 'scheduled' | 'published' | 'failed';
}

const platformConfig = {
  instagram: { icon: Instagram, color: 'text-pink-600 bg-pink-100', label: 'Instagram', maxChars: 2200 },
  facebook: { icon: Facebook, color: 'text-blue-600 bg-blue-100', label: 'Facebook', maxChars: 63206 },
  twitter: { icon: Twitter, color: 'text-sky-500 bg-sky-100', label: 'X / Twitter', maxChars: 280 },
};

export default function SocialSchedulerPage() {
  const { t } = useI18n();
  const [posts, setPosts] = useState<ScheduledPost[]>([
    { id: '1', platform: 'instagram', content: '🧬 Nouveau lot de BPC-157 disponible! Pureté 99%+ certifiée. #peptides #research #biocycle', scheduledAt: new Date(Date.now() + 86400000), status: 'scheduled' },
    { id: '2', platform: 'facebook', content: 'Découvrez notre guide complet sur les peptides de recherche. Lien dans la bio!', scheduledAt: new Date(Date.now() + 172800000), status: 'scheduled' },
    { id: '3', platform: 'twitter', content: '🔬 New research: TB-500 shows promising results in tissue repair studies. Read more on our blog! #peptideresearch', scheduledAt: new Date(Date.now() + 259200000), status: 'draft' },
  ]);

  const [showComposer, setShowComposer] = useState(false);
  const [newPost, setNewPost] = useState({ platform: 'instagram' as const, content: '', scheduledAt: '' });

  const deletePost = (id: string) => {
    setPosts(prev => prev.filter(p => p.id !== id));
    toast.success(t('admin.media.socialScheduler.postDeleted'));
  };

  const publishNow = (id: string) => {
    setPosts(prev => prev.map(p => p.id === id ? { ...p, status: 'published' as const } : p));
    toast.success(t('admin.media.socialScheduler.postPublished'));
  };

  const generateCaption = () => {
    const captions = [
      '🧬 Peptides de recherche de qualité supérieure, maintenant disponibles chez BioCycle Peptides! Certificat d\'analyse inclus avec chaque commande. #peptides #research #quality',
      '🔬 Vous cherchez des peptides de recherche fiables? Notre laboratoire garantit une pureté de 98%+ sur chaque lot. Découvrez notre catalogue! #biocycle #science',
      '💎 Livraison gratuite sur les commandes de 150$+! Profitez de nos peptides certifiés avec analyse HPLC. biocyclepeptides.com #research #peptides',
    ];
    setNewPost(prev => ({ ...prev, content: captions[Math.floor(Math.random() * captions.length)] }));
    toast.success(t('admin.media.socialScheduler.aiCaptionGenerated'));
  };

  const createPost = () => {
    if (!newPost.content || !newPost.scheduledAt) {
      toast.error(t('admin.media.socialScheduler.contentDateRequired'));
      return;
    }
    const post: ScheduledPost = {
      id: Date.now().toString(36),
      platform: newPost.platform,
      content: newPost.content,
      scheduledAt: new Date(newPost.scheduledAt),
      status: 'scheduled',
    };
    setPosts(prev => [...prev, post]);
    setNewPost({ platform: 'instagram', content: '', scheduledAt: '' });
    setShowComposer(false);
    toast.success(t('admin.media.socialScheduler.postScheduled'));
  };

  const formatDate = (d: Date) => new Intl.DateTimeFormat('fr-CA', { dateStyle: 'medium', timeStyle: 'short' }).format(d);

  const statusBadge = (s: string) => {
    switch (s) {
      case 'published': return 'bg-green-100 text-green-700';
      case 'scheduled': return 'bg-blue-100 text-blue-700';
      case 'failed': return 'bg-red-100 text-red-700';
      default: return 'bg-slate-100 text-slate-600';
    }
  };

  const statusLabel = (s: string) => {
    switch (s) {
      case 'published': return t('admin.media.socialScheduler.statusPublished');
      case 'scheduled': return t('admin.media.socialScheduler.statusScheduled');
      case 'failed': return t('admin.media.socialScheduler.statusFailed');
      default: return t('admin.media.socialScheduler.statusDraft');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <Calendar className="w-6 h-6 text-purple-600" />
            {t('admin.media.socialScheduler.title')}
          </h1>
          <p className="text-slate-500">{t('admin.media.socialScheduler.subtitle')}</p>
        </div>
        <button
          onClick={() => setShowComposer(!showComposer)}
          className="flex items-center gap-2 px-4 py-2 bg-sky-600 text-white rounded-lg hover:bg-sky-700 text-sm font-medium"
        >
          <Plus className="w-4 h-4" /> {t('admin.media.socialScheduler.newPost')}
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: t('admin.media.socialScheduler.statsScheduled'), count: posts.filter(p => p.status === 'scheduled').length, color: 'text-blue-600' },
          { label: t('admin.media.socialScheduler.statsDraft'), count: posts.filter(p => p.status === 'draft').length, color: 'text-slate-600' },
          { label: t('admin.media.socialScheduler.statsPublished'), count: posts.filter(p => p.status === 'published').length, color: 'text-green-600' },
          { label: t('admin.media.socialScheduler.statsFailed'), count: posts.filter(p => p.status === 'failed').length, color: 'text-red-600' },
        ].map(s => (
          <div key={s.label} className="bg-white rounded-xl border border-slate-200 p-4 text-center">
            <div className={`text-2xl font-bold ${s.color}`}>{s.count}</div>
            <div className="text-xs text-slate-500">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Composer */}
      {showComposer && (
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <h3 className="font-semibold text-slate-800 mb-4">{t('admin.media.socialScheduler.composer')}</h3>
          <div className="space-y-4">
            <div className="flex gap-3">
              {(Object.entries(platformConfig) as [keyof typeof platformConfig, typeof platformConfig[keyof typeof platformConfig]][]).map(([key, cfg]) => (
                <button
                  key={key}
                  onClick={() => setNewPost(prev => ({ ...prev, platform: key }))}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg border text-sm font-medium transition-colors ${
                    newPost.platform === key ? 'border-sky-400 bg-sky-50 text-sky-700' : 'border-slate-200 text-slate-500 hover:bg-slate-50'
                  }`}
                >
                  <cfg.icon className="w-4 h-4" />
                  {cfg.label}
                </button>
              ))}
            </div>
            <div className="relative">
              <textarea
                value={newPost.content}
                onChange={e => setNewPost(prev => ({ ...prev, content: e.target.value }))}
                placeholder={t('admin.media.socialScheduler.writePlaceholder')}
                rows={4}
                maxLength={platformConfig[newPost.platform].maxChars}
                className="w-full px-4 py-3 border border-slate-200 rounded-lg focus:ring-2 focus:ring-sky-400 focus:border-sky-400 text-sm resize-none"
              />
              <div className="absolute bottom-2 end-2 text-xs text-slate-400">
                {newPost.content.length}/{platformConfig[newPost.platform].maxChars}
              </div>
            </div>
            <div className="flex items-center gap-3">
              <input
                type="datetime-local"
                value={newPost.scheduledAt}
                onChange={e => setNewPost(prev => ({ ...prev, scheduledAt: e.target.value }))}
                className="px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-sky-400"
              />
              <button onClick={generateCaption} className="flex items-center gap-1 px-3 py-2 bg-purple-100 text-purple-700 rounded-lg hover:bg-purple-200 text-sm font-medium">
                <Sparkles className="w-4 h-4" /> {t('admin.media.socialScheduler.aiCaption')}
              </button>
              <div className="flex-1" />
              <button onClick={() => setShowComposer(false)} className="px-4 py-2 text-slate-500 hover:bg-slate-100 rounded-lg text-sm">
                {t('admin.media.socialScheduler.cancel')}
              </button>
              <button onClick={createPost} className="flex items-center gap-2 px-4 py-2 bg-sky-600 text-white rounded-lg hover:bg-sky-700 text-sm font-medium">
                <Clock className="w-4 h-4" /> {t('admin.media.socialScheduler.schedule')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Posts List */}
      <div className="space-y-3">
        {posts.sort((a, b) => a.scheduledAt.getTime() - b.scheduledAt.getTime()).map(post => {
          const cfg = platformConfig[post.platform];
          return (
            <div key={post.id} className="bg-white rounded-xl border border-slate-200 p-5 flex items-start gap-4">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${cfg.color}`}>
                <cfg.icon className="w-5 h-5" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-sm font-medium text-slate-700">{cfg.label}</span>
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusBadge(post.status)}`}>
                    {statusLabel(post.status)}
                  </span>
                </div>
                <p className="text-sm text-slate-600 whitespace-pre-wrap line-clamp-3">{post.content}</p>
                <div className="flex items-center gap-1 mt-2 text-xs text-slate-400">
                  <Clock className="w-3 h-3" />
                  {formatDate(post.scheduledAt)}
                </div>
              </div>
              <div className="flex items-center gap-1 flex-shrink-0">
                {post.status !== 'published' && (
                  <button onClick={() => publishNow(post.id)} className="p-2 text-slate-400 hover:text-green-600 hover:bg-green-50 rounded-lg" title={t('admin.media.socialScheduler.publishNow')}>
                    <Send className="w-4 h-4" />
                  </button>
                )}
                <button onClick={() => deletePost(post.id)} className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg" title={t('admin.media.socialScheduler.deletePost')}>
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
