'use client';

/**
 * AiDesignPanel — AI Design Assistant for the Koraline Page Builder
 *
 * A floating side panel that provides AI-powered design suggestions:
 *   - "Suggest Page Layout" — industry-aware section ordering
 *   - "Generate Content" — AI-written copy for any section
 *   - "Improve This Text" — rewrite selected text
 *   - Color palette & font pairing recommendations
 *
 * Accessible from the PageBuilder via a toggle button.
 */

import { useState, useCallback } from 'react';
import { useI18n } from '@/i18n/client';
import { addCSRFHeader } from '@/lib/csrf';
import {
  Sparkles,
  X,
  Loader2,
  Palette,
  LayoutTemplate,
  Type,
  Wand2,
  ChevronDown,
  ChevronRight,
  Copy,
  Check,
  AlertCircle,
} from 'lucide-react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Industry = 'restaurant' | 'fitness' | 'education' | 'legal' | 'creative' | 'tech' | 'healthcare' | 'retail' | 'general';
type ContentTone = 'professional' | 'friendly' | 'bold' | 'minimal' | 'luxury';

interface ColorPalette {
  primary: string;
  secondary: string;
  accent: string;
  background: string;
  text: string;
  muted: string;
}

interface FontPairing {
  heading: string;
  body: string;
  accent?: string;
}

interface SectionSuggestion {
  type: string;
  reason: string;
}

interface ContentHint {
  section: string;
  headline: string;
  description: string;
}

interface DesignSuggestions {
  colorPalette: ColorPalette;
  fontPairing: FontPairing;
  sectionOrder: SectionSuggestion[];
  contentHints: ContentHint[];
}

interface GeneratedSection {
  type: string;
  [key: string]: unknown;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const INDUSTRIES: { value: Industry; label: string }[] = [
  { value: 'restaurant', label: 'Restaurant' },
  { value: 'fitness', label: 'Fitness' },
  { value: 'education', label: 'Education' },
  { value: 'legal', label: 'Legal' },
  { value: 'creative', label: 'Creative / Design' },
  { value: 'tech', label: 'Technology' },
  { value: 'healthcare', label: 'Healthcare' },
  { value: 'retail', label: 'Retail / E-commerce' },
  { value: 'general', label: 'General' },
];

const TONES: { value: ContentTone; label: string }[] = [
  { value: 'professional', label: 'Professional' },
  { value: 'friendly', label: 'Friendly' },
  { value: 'bold', label: 'Bold' },
  { value: 'minimal', label: 'Minimal' },
  { value: 'luxury', label: 'Luxury' },
];

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface AiDesignPanelProps {
  /** Currently used section types on the page */
  existingSections?: string[];
  /** Called when user wants to add a suggested section to the page */
  onAddSection?: (sectionData: Record<string, unknown>) => void;
  /** Called when user applies a text improvement */
  onApplyText?: (text: string) => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function AiDesignPanel({
  existingSections = [],
  onAddSection,
  onApplyText,
}: AiDesignPanelProps) {
  const { t } = useI18n();

  // Panel state
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'layout' | 'content' | 'improve'>('layout');

  // Form state
  const [industry, setIndustry] = useState<Industry>('general');
  const [tone, setTone] = useState<ContentTone>('professional');
  const [topic, setTopic] = useState('');
  const [textToImprove, setTextToImprove] = useState('');
  const [improveInstruction, setImproveInstruction] = useState('');

  // Results
  const [suggestions, setSuggestions] = useState<DesignSuggestions | null>(null);
  const [generatedContent, setGeneratedContent] = useState<Record<string, unknown> | null>(null);
  const [improvedText, setImprovedText] = useState<string | null>(null);

  // Loading / error
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Expanded sections
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    palette: true,
    fonts: true,
    layout: true,
    hints: false,
  });

  // Clipboard
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // ── API helper ──────────────────────────────────────────────────────

  const callApi = useCallback(async (body: Record<string, unknown>) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/ai/design', {
        method: 'POST',
        headers: addCSRFHeader({ 'Content-Type': 'application/json' }),
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Request failed' }));
        throw new Error(err.error || `HTTP ${res.status}`);
      }
      const json = await res.json();
      return json.data;
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      setError(msg);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  // ── Actions ─────────────────────────────────────────────────────────

  const handleSuggestLayout = useCallback(async () => {
    const result = await callApi({
      action: 'suggestions',
      pageType: 'homepage',
      industry,
      existingSections,
    });
    if (result) setSuggestions(result as DesignSuggestions);
  }, [callApi, industry, existingSections]);

  const handleGenerateContent = useCallback(async () => {
    if (!topic.trim()) {
      setError(t('admin.aiDesign.topicRequired') || 'Please enter a topic');
      return;
    }
    const result = await callApi({
      action: 'content',
      topic: topic.trim(),
      tone,
      length: 'medium',
      sections: ['hero', 'features', 'cta', 'faq'],
    });
    if (result) setGeneratedContent(result as Record<string, unknown>);
  }, [callApi, topic, tone, t]);

  const handleImproveText = useCallback(async () => {
    if (!textToImprove.trim()) {
      setError(t('admin.aiDesign.textRequired') || 'Please enter text to improve');
      return;
    }
    const result = await callApi({
      action: 'improve',
      text: textToImprove.trim(),
      instruction: improveInstruction.trim() || undefined,
      tone,
    });
    if (result?.improved) setImprovedText(result.improved as string);
  }, [callApi, textToImprove, improveInstruction, tone, t]);

  const handleGenerateSection = useCallback(async (sectionType: string) => {
    const result = await callApi({
      action: 'section',
      sectionType,
      topic: topic.trim() || industry,
      tone,
    }) as GeneratedSection | null;
    if (result && onAddSection) {
      onAddSection(result);
    }
  }, [callApi, topic, industry, tone, onAddSection]);

  // ── Utilities ───────────────────────────────────────────────────────

  const toggleSection = (key: string) => {
    setExpandedSections(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const copyToClipboard = async (text: string, id: string) => {
    await navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // ── Toggle button (always visible) ─────────────────────────────────

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="fixed right-4 bottom-20 z-50 flex items-center gap-2 rounded-full bg-gradient-to-r from-purple-600 to-indigo-600 px-4 py-3 text-sm font-medium text-white shadow-lg transition-all hover:from-purple-700 hover:to-indigo-700 hover:shadow-xl"
        title={t('admin.aiDesign.title') || 'AI Design Assistant'}
      >
        <Sparkles className="h-4 w-4" />
        <span className="hidden sm:inline">{t('admin.aiDesign.title') || 'AI Assistant'}</span>
      </button>
    );
  }

  // ── Panel ───────────────────────────────────────────────────────────

  return (
    <div className="fixed right-0 top-0 z-50 flex h-full w-96 max-w-[90vw] flex-col border-l border-gray-200 bg-white shadow-2xl dark:border-gray-700 dark:bg-gray-900">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3 dark:border-gray-700">
        <div className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-purple-600" />
          <h2 className="text-base font-semibold text-gray-900 dark:text-white">
            {t('admin.aiDesign.title') || 'AI Design Assistant'}
          </h2>
        </div>
        <button
          onClick={() => setIsOpen(false)}
          className="rounded-lg p-1.5 text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800"
          aria-label={t('common.close') || 'Close'}
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-200 dark:border-gray-700">
        {[
          { key: 'layout' as const, icon: LayoutTemplate, label: t('admin.aiDesign.tabLayout') || 'Layout' },
          { key: 'content' as const, icon: Type, label: t('admin.aiDesign.tabContent') || 'Content' },
          { key: 'improve' as const, icon: Wand2, label: t('admin.aiDesign.tabImprove') || 'Improve' },
        ].map(tab => (
          <button
            key={tab.key}
            onClick={() => { setActiveTab(tab.key); setError(null); }}
            className={`flex flex-1 items-center justify-center gap-1.5 px-3 py-2.5 text-xs font-medium transition-colors ${
              activeTab === tab.key
                ? 'border-b-2 border-purple-600 text-purple-600'
                : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
            }`}
          >
            <tab.icon className="h-3.5 w-3.5" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Body — scrollable */}
      <div className="flex-1 overflow-y-auto px-4 py-4">
        {/* Error banner */}
        {error && (
          <div className="mb-4 flex items-start gap-2 rounded-lg bg-red-50 p-3 text-sm text-red-700 dark:bg-red-900/20 dark:text-red-400">
            <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* ── Layout Tab ─────────────────────────────────────── */}
        {activeTab === 'layout' && (
          <div className="space-y-4">
            {/* Industry selector */}
            <div>
              <label className="mb-1.5 block text-xs font-medium text-gray-700 dark:text-gray-300">
                {t('admin.aiDesign.industry') || 'Industry'}
              </label>
              <select
                value={industry}
                onChange={e => setIndustry(e.target.value as Industry)}
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-purple-500 focus:ring-1 focus:ring-purple-500 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
              >
                {INDUSTRIES.map(i => (
                  <option key={i.value} value={i.value}>{i.label}</option>
                ))}
              </select>
            </div>

            {/* Generate button */}
            <button
              onClick={handleSuggestLayout}
              disabled={loading}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-purple-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-purple-700 disabled:opacity-50"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <LayoutTemplate className="h-4 w-4" />}
              {t('admin.aiDesign.suggestLayout') || 'Suggest Page Layout'}
            </button>

            {/* Results */}
            {suggestions && (
              <div className="space-y-3">
                {/* Color Palette */}
                <CollapsibleSection
                  title={t('admin.aiDesign.colorPalette') || 'Color Palette'}
                  icon={<Palette className="h-4 w-4" />}
                  isOpen={expandedSections.palette}
                  onToggle={() => toggleSection('palette')}
                >
                  <div className="grid grid-cols-3 gap-2">
                    {Object.entries(suggestions.colorPalette).map(([name, hex]) => (
                      <button
                        key={name}
                        onClick={() => copyToClipboard(hex, `color-${name}`)}
                        className="flex flex-col items-center gap-1 rounded-lg p-2 transition-colors hover:bg-gray-100 dark:hover:bg-gray-800"
                        title={`${name}: ${hex}`}
                      >
                        <div
                          className="h-8 w-8 rounded-full border border-gray-200 dark:border-gray-600"
                          style={{ backgroundColor: hex }}
                        />
                        <span className="text-[10px] text-gray-500">{name}</span>
                        <span className="text-[10px] font-mono text-gray-400">
                          {copiedId === `color-${name}` ? <Check className="h-3 w-3 text-green-500" /> : hex}
                        </span>
                      </button>
                    ))}
                  </div>
                </CollapsibleSection>

                {/* Font Pairing */}
                <CollapsibleSection
                  title={t('admin.aiDesign.fontPairing') || 'Font Pairing'}
                  icon={<Type className="h-4 w-4" />}
                  isOpen={expandedSections.fonts}
                  onToggle={() => toggleSection('fonts')}
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between rounded-lg bg-gray-50 px-3 py-2 dark:bg-gray-800">
                      <span className="text-xs text-gray-500">{t('admin.aiDesign.headingFont') || 'Heading'}</span>
                      <span className="text-sm font-medium text-gray-900 dark:text-white">{suggestions.fontPairing.heading}</span>
                    </div>
                    <div className="flex items-center justify-between rounded-lg bg-gray-50 px-3 py-2 dark:bg-gray-800">
                      <span className="text-xs text-gray-500">{t('admin.aiDesign.bodyFont') || 'Body'}</span>
                      <span className="text-sm font-medium text-gray-900 dark:text-white">{suggestions.fontPairing.body}</span>
                    </div>
                    {suggestions.fontPairing.accent && (
                      <div className="flex items-center justify-between rounded-lg bg-gray-50 px-3 py-2 dark:bg-gray-800">
                        <span className="text-xs text-gray-500">{t('admin.aiDesign.accentFont') || 'Accent'}</span>
                        <span className="text-sm font-medium text-gray-900 dark:text-white">{suggestions.fontPairing.accent}</span>
                      </div>
                    )}
                  </div>
                </CollapsibleSection>

                {/* Section Order */}
                <CollapsibleSection
                  title={t('admin.aiDesign.suggestedSections') || 'Suggested Sections'}
                  icon={<LayoutTemplate className="h-4 w-4" />}
                  isOpen={expandedSections.layout}
                  onToggle={() => toggleSection('layout')}
                >
                  <div className="space-y-2">
                    {suggestions.sectionOrder.map((s, idx) => (
                      <div
                        key={`${s.type}-${idx}`}
                        className="flex items-start gap-2 rounded-lg border border-gray-200 p-2.5 dark:border-gray-700"
                      >
                        <span className="mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-purple-100 text-[10px] font-bold text-purple-700 dark:bg-purple-900 dark:text-purple-300">
                          {idx + 1}
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-medium text-gray-900 dark:text-white">
                              {s.type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                            </span>
                            {onAddSection && (
                              <button
                                onClick={() => handleGenerateSection(s.type)}
                                disabled={loading}
                                className="rounded px-2 py-0.5 text-[10px] font-medium text-purple-600 transition-colors hover:bg-purple-50 dark:text-purple-400 dark:hover:bg-purple-900/30"
                              >
                                + {t('common.add') || 'Add'}
                              </button>
                            )}
                          </div>
                          <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">{s.reason}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </CollapsibleSection>

                {/* Content Hints */}
                <CollapsibleSection
                  title={t('admin.aiDesign.contentHints') || 'Content Hints'}
                  icon={<Sparkles className="h-4 w-4" />}
                  isOpen={expandedSections.hints}
                  onToggle={() => toggleSection('hints')}
                >
                  <div className="space-y-2">
                    {suggestions.contentHints.map((h, idx) => (
                      <div
                        key={`${h.section}-${idx}`}
                        className="rounded-lg bg-gray-50 p-2.5 dark:bg-gray-800"
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-medium uppercase tracking-wide text-gray-400">
                            {h.section.replace(/_/g, ' ')}
                          </span>
                          <button
                            onClick={() => copyToClipboard(h.headline, `hint-${idx}`)}
                            className="text-gray-400 hover:text-gray-600"
                            title={t('common.copy') || 'Copy'}
                          >
                            {copiedId === `hint-${idx}` ? <Check className="h-3 w-3 text-green-500" /> : <Copy className="h-3 w-3" />}
                          </button>
                        </div>
                        <p className="mt-1 text-sm font-medium text-gray-900 dark:text-white">{h.headline}</p>
                        <p className="mt-0.5 text-xs text-gray-500">{h.description}</p>
                      </div>
                    ))}
                  </div>
                </CollapsibleSection>
              </div>
            )}
          </div>
        )}

        {/* ── Content Tab ────────────────────────────────────── */}
        {activeTab === 'content' && (
          <div className="space-y-4">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-gray-700 dark:text-gray-300">
                {t('admin.aiDesign.topic') || 'Business / Topic'}
              </label>
              <input
                type="text"
                value={topic}
                onChange={e => setTopic(e.target.value)}
                placeholder={t('admin.aiDesign.topicPlaceholder') || 'e.g. Organic skincare, Yoga studio, SaaS platform...'}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:border-purple-500 focus:ring-1 focus:ring-purple-500 dark:border-gray-600 dark:bg-gray-800 dark:text-white dark:placeholder:text-gray-500"
                maxLength={500}
              />
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-medium text-gray-700 dark:text-gray-300">
                {t('admin.aiDesign.tone') || 'Tone'}
              </label>
              <select
                value={tone}
                onChange={e => setTone(e.target.value as ContentTone)}
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-purple-500 focus:ring-1 focus:ring-purple-500 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
              >
                {TONES.map(t => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>

            <button
              onClick={handleGenerateContent}
              disabled={loading || !topic.trim()}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-purple-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-purple-700 disabled:opacity-50"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              {t('admin.aiDesign.generateContent') || 'Generate Content'}
            </button>

            {/* Generated content results */}
            {generatedContent && (
              <div className="space-y-3">
                {/* Hero */}
                {generatedContent.hero && (
                  <ContentCard
                    title="Hero"
                    content={generatedContent.hero as Record<string, string>}
                    fields={['headline', 'subtitle', 'ctaLabel']}
                    copiedId={copiedId}
                    onCopy={copyToClipboard}
                  />
                )}

                {/* Features */}
                {Array.isArray(generatedContent.features) && (
                  <div className="rounded-lg border border-gray-200 p-3 dark:border-gray-700">
                    <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">Features</h4>
                    <div className="space-y-2">
                      {(generatedContent.features as Array<Record<string, string>>).map((f, i) => (
                        <div key={i} className="flex items-start gap-2 rounded bg-gray-50 p-2 dark:bg-gray-800">
                          <span className="text-base">{f.icon}</span>
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium text-gray-900 dark:text-white">{f.title}</p>
                            <p className="text-xs text-gray-500">{f.description}</p>
                          </div>
                          <button
                            onClick={() => copyToClipboard(`${f.title}: ${f.description}`, `feat-${i}`)}
                            className="text-gray-400 hover:text-gray-600"
                          >
                            {copiedId === `feat-${i}` ? <Check className="h-3 w-3 text-green-500" /> : <Copy className="h-3 w-3" />}
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* CTA */}
                {generatedContent.cta && (
                  <ContentCard
                    title="Call to Action"
                    content={generatedContent.cta as Record<string, string>}
                    fields={['headline', 'subtitle', 'buttonLabel']}
                    copiedId={copiedId}
                    onCopy={copyToClipboard}
                  />
                )}

                {/* FAQ */}
                {Array.isArray(generatedContent.faq) && (
                  <div className="rounded-lg border border-gray-200 p-3 dark:border-gray-700">
                    <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">FAQ</h4>
                    <div className="space-y-2">
                      {(generatedContent.faq as Array<Record<string, string>>).map((f, i) => (
                        <div key={i} className="rounded bg-gray-50 p-2 dark:bg-gray-800">
                          <p className="text-sm font-medium text-gray-900 dark:text-white">{f.question}</p>
                          <p className="mt-0.5 text-xs text-gray-500">{f.answer}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ── Improve Tab ────────────────────────────────────── */}
        {activeTab === 'improve' && (
          <div className="space-y-4">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-gray-700 dark:text-gray-300">
                {t('admin.aiDesign.textToImprove') || 'Text to Improve'}
              </label>
              <textarea
                value={textToImprove}
                onChange={e => setTextToImprove(e.target.value)}
                placeholder={t('admin.aiDesign.textToImprovePlaceholder') || 'Paste or type the text you want to improve...'}
                rows={4}
                maxLength={5000}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:border-purple-500 focus:ring-1 focus:ring-purple-500 dark:border-gray-600 dark:bg-gray-800 dark:text-white dark:placeholder:text-gray-500"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-medium text-gray-700 dark:text-gray-300">
                {t('admin.aiDesign.instruction') || 'Instruction (optional)'}
              </label>
              <input
                type="text"
                value={improveInstruction}
                onChange={e => setImproveInstruction(e.target.value)}
                placeholder={t('admin.aiDesign.instructionPlaceholder') || 'e.g. Make it shorter, more persuasive, add urgency...'}
                maxLength={500}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:border-purple-500 focus:ring-1 focus:ring-purple-500 dark:border-gray-600 dark:bg-gray-800 dark:text-white dark:placeholder:text-gray-500"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-medium text-gray-700 dark:text-gray-300">
                {t('admin.aiDesign.tone') || 'Tone'}
              </label>
              <select
                value={tone}
                onChange={e => setTone(e.target.value as ContentTone)}
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-purple-500 focus:ring-1 focus:ring-purple-500 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
              >
                {TONES.map(t => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>

            <button
              onClick={handleImproveText}
              disabled={loading || !textToImprove.trim()}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-purple-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-purple-700 disabled:opacity-50"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />}
              {t('admin.aiDesign.improveText') || 'Improve Text'}
            </button>

            {/* Improved result */}
            {improvedText && (
              <div className="rounded-lg border border-green-200 bg-green-50 p-3 dark:border-green-800 dark:bg-green-900/20">
                <div className="mb-2 flex items-center justify-between">
                  <h4 className="text-xs font-semibold uppercase tracking-wide text-green-700 dark:text-green-400">
                    {t('admin.aiDesign.improvedResult') || 'Improved Version'}
                  </h4>
                  <div className="flex gap-1">
                    <button
                      onClick={() => copyToClipboard(improvedText, 'improved')}
                      className="rounded p-1 text-green-600 hover:bg-green-100 dark:text-green-400 dark:hover:bg-green-800"
                      title={t('common.copy') || 'Copy'}
                    >
                      {copiedId === 'improved' ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                    </button>
                    {onApplyText && (
                      <button
                        onClick={() => onApplyText(improvedText)}
                        className="rounded px-2 py-0.5 text-[10px] font-medium text-green-700 hover:bg-green-100 dark:text-green-400 dark:hover:bg-green-800"
                      >
                        {t('common.apply') || 'Apply'}
                      </button>
                    )}
                  </div>
                </div>
                <p className="whitespace-pre-wrap text-sm text-gray-900 dark:text-gray-100">{improvedText}</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="border-t border-gray-200 px-4 py-2 dark:border-gray-700">
        <p className="text-center text-[10px] text-gray-400">
          {t('admin.aiDesign.poweredBy') || 'Powered by AI'} &middot; {t('admin.aiDesign.resultsDisclaimer') || 'Results are suggestions only'}
        </p>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function CollapsibleSection({
  title,
  icon,
  isOpen,
  onToggle,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  isOpen: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border border-gray-200 dark:border-gray-700">
      <button
        onClick={onToggle}
        className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm font-medium text-gray-900 dark:text-white"
      >
        {icon}
        <span className="flex-1">{title}</span>
        {isOpen ? <ChevronDown className="h-4 w-4 text-gray-400" /> : <ChevronRight className="h-4 w-4 text-gray-400" />}
      </button>
      {isOpen && <div className="border-t border-gray-200 px-3 py-2.5 dark:border-gray-700">{children}</div>}
    </div>
  );
}

function ContentCard({
  title,
  content,
  fields,
  copiedId,
  onCopy,
}: {
  title: string;
  content: Record<string, string>;
  fields: string[];
  copiedId: string | null;
  onCopy: (text: string, id: string) => void;
}) {
  return (
    <div className="rounded-lg border border-gray-200 p-3 dark:border-gray-700">
      <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">{title}</h4>
      <div className="space-y-1.5">
        {fields.map(field => {
          const value = content[field];
          if (!value) return null;
          const id = `${title}-${field}`;
          return (
            <div key={field} className="flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <span className="text-[10px] text-gray-400">{field.replace(/([A-Z])/g, ' $1').trim()}</span>
                <p className="text-sm text-gray-900 dark:text-white">{value}</p>
              </div>
              <button
                onClick={() => onCopy(value, id)}
                className="mt-3 text-gray-400 hover:text-gray-600"
              >
                {copiedId === id ? <Check className="h-3 w-3 text-green-500" /> : <Copy className="h-3 w-3" />}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
