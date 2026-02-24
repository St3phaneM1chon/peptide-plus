'use client';

import { MessageCircle } from 'lucide-react';
import Link from 'next/link';
import { useI18n } from '@/i18n/client';
import { useRecentChats } from '@/hooks/useRecentChats';

export default function ChatPreview() {
  const { t, locale } = useI18n();
  const { chats, loading } = useRecentChats();

  return (
    <div className="border-t border-slate-200 flex flex-col" style={{ maxHeight: '35%' }}>
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2 bg-slate-50 border-b border-slate-100 flex-shrink-0">
        <MessageCircle className="w-3.5 h-3.5 text-slate-500" />
        <span className="text-xs font-semibold text-slate-600 uppercase tracking-wide">
          {t('admin.chat.recentMessages')}
        </span>
        {chats.length > 0 && (
          <span className="ml-auto text-xs bg-sky-100 text-sky-700 rounded-full px-1.5 py-0.5 font-medium">
            {chats.length}
          </span>
        )}
      </div>

      {/* Chat list */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="p-3 text-center">
            <div
              className="animate-spin w-4 h-4 border-2 border-slate-300 border-t-sky-600 rounded-full mx-auto"
              role="status"
            >
              <span className="sr-only">{t('common.loading')}</span>
            </div>
          </div>
        ) : chats.length === 0 ? (
          <p className="p-3 text-xs text-slate-400 text-center">
            {t('admin.chat.noRecentMessages')}
          </p>
        ) : (
          chats.map((chat) => (
            <Link
              key={chat.id}
              href={`/admin/chat?clientId=${chat.clientId}`}
              className="flex items-start gap-2 px-3 py-2 hover:bg-slate-50 border-b border-slate-50 transition-colors group"
            >
              {/* Avatar circle */}
              <div className="w-7 h-7 rounded-full bg-sky-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                <span className="text-xs font-semibold text-sky-700">
                  {chat.clientName.charAt(0).toUpperCase()}
                </span>
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1">
                  <span className="text-xs font-medium text-slate-800 truncate">
                    {chat.clientName}
                  </span>
                  {chat.unreadCount > 0 && (
                    <span className="w-2 h-2 bg-sky-500 rounded-full flex-shrink-0" />
                  )}
                </div>
                <p className="text-[11px] text-slate-500 truncate leading-tight mt-0.5">
                  {chat.lastMessage}
                </p>
              </div>

              {/* Time */}
              <span className="text-[10px] text-slate-400 flex-shrink-0 mt-0.5">
                {formatRelativeTime(chat.lastMessageAt, t, locale)}
              </span>
            </Link>
          ))
        )}
      </div>
    </div>
  );
}

// TODO: F-098 - Uses new Date(dateStr) which depends on browser timezone; consider UTC normalization.
function formatRelativeTime(dateStr: string, t: (key: string) => string, locale: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  const diffHrs = Math.floor(diffMs / 3600000);

  if (diffMin < 1) return t('admin.chat.timeNow') || 'now';
  if (diffMin < 60) return `${diffMin}${t('admin.chat.timeMinute') || 'm'}`;
  if (diffHrs < 24) return `${diffHrs}${t('admin.chat.timeHour') || 'h'}`;
  return date.toLocaleDateString(locale, { month: 'short', day: 'numeric' });
}
