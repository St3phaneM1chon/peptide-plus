'use client';

/**
 * RecordingsClient - Unified content dashboard with tabs: Audio, Video, Chat
 * Searches across recordings, transcriptions, and chat conversations.
 */

import { useState, useEffect, useCallback } from 'react';
import { useI18n } from '@/i18n/client';
import AudioPlayer from '@/components/voip/AudioPlayer';
import {
  PhoneIncoming,
  PhoneOutgoing,
  Phone,
  Video,
  MessageCircle,
  Search,
  Download,
  FileText,
  Calendar,
  Filter,
} from 'lucide-react';
import { Button, Input } from '@/components/admin';
import { toast } from 'sonner';

type ContentType = 'all' | 'audio' | 'video' | 'chat';

interface ContentItem {
  id: string;
  type: 'audio' | 'video' | 'chat';
  title: string;
  description: string | null;
  date: string;
  duration: number | null;
  url: string | null;
  sentiment: string | null;
  metadata: Record<string, unknown>;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export default function RecordingsClient({ recordings: initialRecordings }: { recordings: any[] }) {
  const { t, locale } = useI18n();
  const [activeTab, setActiveTab] = useState<ContentType>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [results, setResults] = useState<ContentItem[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  // Convert initial recordings to ContentItem format for initial display
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const initialItems: ContentItem[] = initialRecordings.map((rec: any) => ({
    id: rec.id,
    type: rec.isVideo ? 'video' : 'audio',
    title: `${rec.callLog?.callerName || rec.callLog?.callerNumber || 'Unknown'} → ${rec.callLog?.calledNumber || 'Unknown'}`,
    description: rec.transcription?.summary || null,
    date: rec.createdAt,
    duration: rec.durationSec,
    url: rec.blobUrl,
    sentiment: rec.transcription?.sentiment || null,
    metadata: {
      format: rec.format,
      direction: rec.callLog?.direction,
      agent: rec.callLog?.agent?.user?.name || rec.callLog?.agent?.extension,
      client: rec.callLog?.client?.name,
      callLogId: rec.callLogId,
      isVideo: rec.isVideo,
    },
  }));

  const displayItems = hasSearched ? results : initialItems;

  const search = useCallback(async () => {
    setIsSearching(true);
    setHasSearched(true);
    try {
      const params = new URLSearchParams();
      if (searchQuery) params.set('q', searchQuery);
      if (activeTab !== 'all') params.set('type', activeTab);
      params.set('limit', '50');

      const res = await fetch(`/api/admin/content/recordings?${params}`);
      const data = await res.json();
      setResults(data.results || []);
    } catch {
      toast.error(t('common.errorOccurred'));
    } finally {
      setIsSearching(false);
    }
  }, [searchQuery, activeTab, t]);

  // Search when tab changes
  useEffect(() => {
    if (hasSearched || activeTab !== 'all') {
      search();
    }
  }, [activeTab]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    search();
  };

  const exportChat = async (conversationId: string, format: 'csv' | 'json') => {
    window.open(`/api/admin/chat/export?conversationId=${conversationId}&format=${format}`, '_blank');
  };

  const formatDuration = (seconds: number | null) => {
    if (!seconds) return '--:--';
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${String(s).padStart(2, '0')}`;
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleString(locale, {
      dateStyle: 'medium',
      timeStyle: 'short',
    });
  };

  const tabs: Array<{ key: ContentType; label: string; icon: typeof Phone }> = [
    { key: 'all', label: t('voip.recordings.all'), icon: Filter },
    { key: 'audio', label: t('voip.recordings.audioTab'), icon: Phone },
    { key: 'video', label: t('voip.recordings.videoTab'), icon: Video },
    { key: 'chat', label: t('voip.recordings.chatTab'), icon: MessageCircle },
  ];

  // Filter display items by active tab when not using API search
  const filteredItems = !hasSearched && activeTab !== 'all'
    ? displayItems.filter((item) => item.type === activeTab)
    : displayItems;

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-gray-900">{t('voip.recordings.title')}</h1>

      {/* Search + Tabs */}
      <div className="flex flex-col sm:flex-row gap-4">
        <form onSubmit={handleSearch} className="flex gap-2 flex-1">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t('voip.recordings.searchPlaceholder')}
              className="!pl-9"
            />
          </div>
          <Button type="submit" variant="primary" loading={isSearching}>
            {t('common.search')}
          </Button>
        </form>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-lg w-fit">
        {tabs.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
              activeTab === key
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <Icon className="w-4 h-4" />
            {label}
          </button>
        ))}
      </div>

      {/* Results */}
      <div className="space-y-3">
        {filteredItems.map((item) => (
          <div key={`${item.type}-${item.id}`} className="bg-white border border-gray-200 rounded-xl p-4">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-3">
                {/* Type icon */}
                {item.type === 'audio' && (
                  item.metadata.direction === 'INBOUND' ? (
                    <PhoneIncoming className="w-4 h-4 text-teal-600" />
                  ) : item.metadata.direction === 'OUTBOUND' ? (
                    <PhoneOutgoing className="w-4 h-4 text-emerald-600" />
                  ) : (
                    <Phone className="w-4 h-4 text-gray-400" />
                  )
                )}
                {item.type === 'video' && <Video className="w-4 h-4 text-purple-600" />}
                {item.type === 'chat' && <MessageCircle className="w-4 h-4 text-teal-600" />}

                {/* Type badge */}
                <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                  item.type === 'audio' ? 'bg-gray-100 text-gray-600' :
                  item.type === 'video' ? 'bg-purple-100 text-purple-600' :
                  'bg-teal-100 text-teal-600'
                }`}>
                  {item.type === 'audio' ? 'Audio' : item.type === 'video' ? 'Video' : 'Chat'}
                </span>

                <span className="font-medium text-gray-900">{item.title}</span>
              </div>

              <div className="flex items-center gap-3">
                {item.duration && (
                  <span className="text-xs text-gray-500">{formatDuration(item.duration)}</span>
                )}
                {item.metadata.messageCount ? (
                  <span className="text-xs text-gray-500">
                    {String(item.metadata.messageCount)} msgs
                  </span>
                ) : null}
                <span className="flex items-center gap-1 text-xs text-gray-400">
                  <Calendar className="w-3 h-3" />
                  {formatDate(item.date)}
                </span>
              </div>
            </div>

            {/* Metadata */}
            {item.metadata.agent ? (
              <div className="text-xs text-gray-500 mb-2">
                {t('voip.recordings.agent')}: {String(item.metadata.agent)}
                {item.metadata.client ? ` | ${t('voip.recordings.client')}: ${String(item.metadata.client)}` : null}
              </div>
            ) : null}

            {/* Audio/Video player */}
            {(item.type === 'audio' || item.type === 'video') && item.url && (
              <div className="mb-2">
                {item.type === 'video' ? (
                  <video
                    src={item.url}
                    controls
                    className="w-full max-h-48 rounded-lg bg-black"
                    preload="metadata"
                  />
                ) : (
                  <AudioPlayer
                    src={`/api/admin/voip/recordings/${item.id}`}
                    duration={item.duration ?? undefined}
                    filename={`recording-${item.id}.${item.metadata.format || 'wav'}`}
                  />
                )}
              </div>
            )}

            {/* Description / Summary */}
            {item.description && (
              <div className="p-2 bg-gray-50 rounded-lg text-sm text-gray-700">
                <span className="text-xs font-medium text-gray-500">
                  {item.type === 'chat' ? t('voip.recordings.lastMessage') : t('voip.recordings.summary')}:{' '}
                </span>
                {item.description}
                {item.sentiment && (
                  <span className={`ms-2 text-xs px-1.5 py-0.5 rounded-full ${
                    item.sentiment === 'positive' ? 'bg-emerald-100 text-emerald-700' :
                    item.sentiment === 'negative' ? 'bg-red-100 text-red-700' :
                    'bg-gray-100 text-gray-600'
                  }`}>
                    {item.sentiment}
                  </span>
                )}
              </div>
            )}

            {/* Chat export actions */}
            {item.type === 'chat' && (
              <div className="flex gap-2 mt-2">
                <button
                  onClick={() => exportChat(item.id, 'csv')}
                  className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700 transition-colors"
                >
                  <Download className="w-3 h-3" />
                  CSV
                </button>
                <button
                  onClick={() => exportChat(item.id, 'json')}
                  className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700 transition-colors"
                >
                  <FileText className="w-3 h-3" />
                  JSON
                </button>
              </div>
            )}
          </div>
        ))}

        {filteredItems.length === 0 && (
          <div className="bg-white border border-gray-200 rounded-xl p-8 text-center text-gray-400">
            {isSearching ? t('common.loading') : t('voip.recordings.empty')}
          </div>
        )}
      </div>
    </div>
  );
}
