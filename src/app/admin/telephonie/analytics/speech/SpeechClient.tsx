'use client';

/**
 * SpeechClient - Speech analytics with keyword trends and sentiment.
 */

import { useI18n } from '@/i18n/client';
import { MessageSquare, TrendingUp, TrendingDown, Minus, ArrowLeft, Shield } from 'lucide-react';
import Link from 'next/link';

interface KeywordStat {
  keyword: string;
  count: number;
}

interface SpeechStats {
  totalTranscriptions: number;
  sentiment: {
    positive: number;
    negative: number;
    neutral: number;
  };
  sentimentPercentages: {
    positive: number;
    negative: number;
    neutral: number;
  };
  avgSentimentScore: number;
  topKeywords: KeywordStat[];
  complianceScore: number;
}

export default function SpeechClient({ stats }: { stats: SpeechStats }) {
  const { t } = useI18n();

  const maxKeywordCount = stats.topKeywords.length > 0
    ? Math.max(...stats.topKeywords.map((k) => k.count))
    : 1;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link
          href="/admin/telephonie/analytics"
          className="p-2 text-gray-400 hover:text-teal-600 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
        >
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            {t('voip.admin.speechAnalytics.title')}
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            {t('voip.admin.speechAnalytics.subtitle')}
          </p>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <MessageSquare className="w-4 h-4 text-teal-600" />
            <span className="text-xs text-gray-500 dark:text-gray-400">
              {t('voip.callLog.transcription')}
            </span>
          </div>
          <div className="text-2xl font-bold text-gray-900 dark:text-white">
            {stats.totalTranscriptions}
          </div>
        </div>
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="w-4 h-4 text-emerald-600" />
            <span className="text-xs text-gray-500 dark:text-gray-400">
              {t('voip.admin.speechAnalytics.positive')}
            </span>
          </div>
          <div className="text-2xl font-bold text-emerald-600">
            {stats.sentimentPercentages.positive}%
          </div>
        </div>
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <TrendingDown className="w-4 h-4 text-red-600" />
            <span className="text-xs text-gray-500 dark:text-gray-400">
              {t('voip.admin.speechAnalytics.negative')}
            </span>
          </div>
          <div className="text-2xl font-bold text-red-600">
            {stats.sentimentPercentages.negative}%
          </div>
        </div>
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <Shield className="w-4 h-4 text-purple-600" />
            <span className="text-xs text-gray-500 dark:text-gray-400">
              {t('voip.admin.speechAnalytics.compliance')}
            </span>
          </div>
          <div className="text-2xl font-bold text-purple-600">
            {stats.complianceScore > 0 ? `${stats.complianceScore}%` : '-'}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Sentiment Breakdown */}
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-6">
          <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-4">
            {t('voip.admin.speechAnalytics.sentimentTrends')}
          </h3>

          {stats.totalTranscriptions > 0 ? (
            <div className="space-y-5">
              {/* Sentiment Bar */}
              <div className="flex h-8 rounded-full overflow-hidden">
                {stats.sentimentPercentages.positive > 0 && (
                  <div
                    className="bg-emerald-500 flex items-center justify-center text-white text-xs font-medium transition-all"
                    style={{ width: `${stats.sentimentPercentages.positive}%` }}
                  >
                    {stats.sentimentPercentages.positive > 10 && `${stats.sentimentPercentages.positive}%`}
                  </div>
                )}
                {stats.sentimentPercentages.neutral > 0 && (
                  <div
                    className="bg-gray-400 flex items-center justify-center text-white text-xs font-medium transition-all"
                    style={{ width: `${stats.sentimentPercentages.neutral}%` }}
                  >
                    {stats.sentimentPercentages.neutral > 10 && `${stats.sentimentPercentages.neutral}%`}
                  </div>
                )}
                {stats.sentimentPercentages.negative > 0 && (
                  <div
                    className="bg-red-500 flex items-center justify-center text-white text-xs font-medium transition-all"
                    style={{ width: `${stats.sentimentPercentages.negative}%` }}
                  >
                    {stats.sentimentPercentages.negative > 10 && `${stats.sentimentPercentages.negative}%`}
                  </div>
                )}
              </div>

              {/* Legend */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-emerald-500" />
                    <span className="text-sm text-gray-700 dark:text-gray-300">
                      {t('voip.admin.speechAnalytics.positive')}
                    </span>
                  </div>
                  <span className="text-sm font-medium text-gray-900 dark:text-white">
                    {stats.sentiment.positive} ({stats.sentimentPercentages.positive}%)
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Minus className="w-4 h-4 text-gray-400" />
                    <span className="text-sm text-gray-700 dark:text-gray-300">
                      {t('voip.admin.speechAnalytics.neutral')}
                    </span>
                  </div>
                  <span className="text-sm font-medium text-gray-900 dark:text-white">
                    {stats.sentiment.neutral} ({stats.sentimentPercentages.neutral}%)
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <TrendingDown className="w-4 h-4 text-red-500" />
                    <span className="text-sm text-gray-700 dark:text-gray-300">
                      {t('voip.admin.speechAnalytics.negative')}
                    </span>
                  </div>
                  <span className="text-sm font-medium text-gray-900 dark:text-white">
                    {stats.sentiment.negative} ({stats.sentimentPercentages.negative}%)
                  </span>
                </div>
              </div>

              {/* Avg Score */}
              <div className="pt-3 border-t border-gray-100 dark:border-gray-700">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-500 dark:text-gray-400">
                    Avg Sentiment Score
                  </span>
                  <span className={`text-lg font-bold ${
                    stats.avgSentimentScore >= 0.6
                      ? 'text-emerald-600'
                      : stats.avgSentimentScore >= 0.4
                      ? 'text-amber-600'
                      : 'text-red-600'
                  }`}>
                    {stats.avgSentimentScore > 0 ? stats.avgSentimentScore.toFixed(2) : '-'}
                  </span>
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center py-8 text-sm text-gray-400">
              <MessageSquare className="w-8 h-8 mx-auto mb-2 text-gray-300" />
              No transcription data available yet
            </div>
          )}
        </div>

        {/* Keyword Trends */}
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-6">
          <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-4">
            {t('voip.admin.speechAnalytics.keywordTrends')}
          </h3>

          {stats.topKeywords.length > 0 ? (
            <div className="space-y-2.5">
              {stats.topKeywords.map((kw, idx) => (
                <div key={kw.keyword} className="flex items-center gap-3">
                  <span className="text-xs text-gray-400 font-mono w-5 text-right">
                    {idx + 1}
                  </span>
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm text-gray-700 dark:text-gray-300 font-medium">
                        {kw.keyword}
                      </span>
                      <span className="text-xs text-gray-500 dark:text-gray-400">
                        {kw.count}x
                      </span>
                    </div>
                    <div className="h-1.5 bg-gray-200 dark:bg-gray-600 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-teal-500 rounded-full"
                        style={{ width: `${(kw.count / maxKeywordCount) * 100}%` }}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-sm text-gray-400">
              <MessageSquare className="w-8 h-8 mx-auto mb-2 text-gray-300" />
              No keyword data available yet
            </div>
          )}
        </div>
      </div>

      {/* Top Topics */}
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-6">
        <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-4">
          {t('voip.admin.speechAnalytics.topTopics')}
        </h3>
        {stats.topKeywords.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {stats.topKeywords.slice(0, 15).map((kw) => {
              const ratio = kw.count / maxKeywordCount;
              const size = ratio > 0.7 ? 'text-lg font-bold' : ratio > 0.4 ? 'text-base font-medium' : 'text-sm';
              const color = ratio > 0.7
                ? 'text-teal-600 dark:text-teal-400'
                : ratio > 0.4
                ? 'text-gray-700 dark:text-gray-300'
                : 'text-gray-500 dark:text-gray-400';
              return (
                <span
                  key={kw.keyword}
                  className={`px-3 py-1.5 bg-gray-50 dark:bg-gray-700 rounded-lg ${size} ${color}`}
                >
                  {kw.keyword}
                </span>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-6 text-sm text-gray-400">
            No topic data available yet. Transcribe calls to see trends.
          </div>
        )}
      </div>
    </div>
  );
}
