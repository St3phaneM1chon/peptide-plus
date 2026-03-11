'use client';

/**
 * EmbedScript - Shows embed code snippet for embedding the chat widget on external websites
 *
 * Provides a copyable script tag and iframe option that third-party sites can use
 * to embed the BioCycle Peptides chat widget on their own pages.
 */

import { useState } from 'react';
import { useI18n } from '@/i18n/client';
import { toast } from 'sonner';
import {
  Code,
  Copy,
  Check,
  ExternalLink,
  Globe,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';

type EmbedMethod = 'script' | 'iframe';

interface EmbedScriptProps {
  baseUrl?: string;
  widgetColor?: string;
  position?: 'bottom-right' | 'bottom-left';
}

export default function EmbedScript({
  baseUrl,
  widgetColor = '#9333ea',
  position = 'bottom-right',
}: EmbedScriptProps) {
  const { t } = useI18n();

  const [copiedMethod, setCopiedMethod] = useState<EmbedMethod | null>(null);
  const [activeMethod, setActiveMethod] = useState<EmbedMethod>('script');
  const [showAdvanced, setShowAdvanced] = useState(false);

  const resolvedBaseUrl = baseUrl || (typeof window !== 'undefined' ? window.location.origin : 'https://biocyclepeptides.com');

  const scriptEmbedCode = `<!-- BioCycle Peptides Chat Widget -->
<script>
  (function() {
    var w = document.createElement('script');
    w.type = 'text/javascript';
    w.async = true;
    w.src = '${resolvedBaseUrl}/embed/chat-widget.js';
    w.setAttribute('data-color', '${widgetColor}');
    w.setAttribute('data-position', '${position}');
    w.setAttribute('data-api', '${resolvedBaseUrl}/api/public/chat');
    var s = document.getElementsByTagName('script')[0];
    s.parentNode.insertBefore(w, s);
  })();
</script>`;

  const iframeEmbedCode = `<!-- BioCycle Peptides Chat Widget (iframe) -->
<iframe
  src="${resolvedBaseUrl}/embed/chat?color=${encodeURIComponent(widgetColor)}&position=${position}"
  style="position:fixed;${position === 'bottom-right' ? 'right:0;bottom:0;' : 'left:0;bottom:0;'}width:420px;height:600px;border:none;z-index:9999;pointer-events:none;"
  allow="clipboard-write"
  title="BioCycle Peptides Chat"
></iframe>`;

  const handleCopy = async (method: EmbedMethod) => {
    const code = method === 'script' ? scriptEmbedCode : iframeEmbedCode;

    try {
      await navigator.clipboard.writeText(code);
      setCopiedMethod(method);
      toast.success(t('chat.embed.copied') || 'Embed code copied to clipboard!');

      setTimeout(() => {
        setCopiedMethod(null);
      }, 2000);
    } catch {
      toast.error(t('chat.embed.copyFailed') || 'Failed to copy. Please select and copy manually.');
    }
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
            <Code className="w-5 h-5 text-purple-600" />
          </div>
          <div>
            <h3 className="font-semibold text-gray-900">
              {t('chat.embed.title') || 'Embed Chat Widget'}
            </h3>
            <p className="text-sm text-gray-500">
              {t('chat.embed.description') || 'Add the live chat widget to your website.'}
            </p>
          </div>
        </div>
      </div>

      {/* Method Tabs */}
      <div className="flex border-b border-gray-200">
        <button
          onClick={() => setActiveMethod('script')}
          className={`flex-1 px-4 py-3 text-sm font-medium text-center transition-colors ${
            activeMethod === 'script'
              ? 'text-purple-600 border-b-2 border-purple-600 bg-purple-50/50'
              : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
          }`}
        >
          <Globe className="w-4 h-4 inline-block me-1.5 -mt-0.5" />
          {t('chat.embed.methodScript') || 'JavaScript'}
        </button>
        <button
          onClick={() => setActiveMethod('iframe')}
          className={`flex-1 px-4 py-3 text-sm font-medium text-center transition-colors ${
            activeMethod === 'iframe'
              ? 'text-purple-600 border-b-2 border-purple-600 bg-purple-50/50'
              : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
          }`}
        >
          <ExternalLink className="w-4 h-4 inline-block me-1.5 -mt-0.5" />
          {t('chat.embed.methodIframe') || 'iFrame'}
        </button>
      </div>

      {/* Embed Code Display */}
      <div className="p-6">
        {/* Method description */}
        <p className="text-sm text-gray-600 mb-3">
          {activeMethod === 'script'
            ? (t('chat.embed.scriptHint') || 'Paste this code before the closing </body> tag of your website.')
            : (t('chat.embed.iframeHint') || 'Add this iframe to any page where you want the chat widget to appear.')}
        </p>

        {/* Code block */}
        <div className="relative group">
          <pre className="bg-gray-900 text-gray-100 rounded-lg p-4 text-xs font-mono overflow-x-auto whitespace-pre leading-relaxed max-h-64 overflow-y-auto">
            <code>
              {activeMethod === 'script' ? scriptEmbedCode : iframeEmbedCode}
            </code>
          </pre>

          {/* Copy button overlay */}
          <button
            onClick={() => handleCopy(activeMethod)}
            className="absolute top-2 end-2 px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white text-xs font-medium rounded-md flex items-center gap-1.5 transition-colors opacity-80 group-hover:opacity-100"
          >
            {copiedMethod === activeMethod ? (
              <>
                <Check className="w-3.5 h-3.5" />
                {t('chat.embed.copiedButton') || 'Copied!'}
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5" />
                {t('chat.embed.copyButton') || 'Copy'}
              </>
            )}
          </button>
        </div>

        {/* Method-specific notes */}
        {activeMethod === 'script' && (
          <div className="mt-3 p-3 bg-purple-50 border border-purple-100 rounded-lg">
            <p className="text-xs text-purple-800 font-medium mb-1">
              {t('chat.embed.recommended') || 'Recommended'}
            </p>
            <p className="text-xs text-purple-600">
              {t('chat.embed.scriptBenefit') || 'The JavaScript snippet loads asynchronously and will not slow down your page. It automatically adapts to your site\'s styling.'}
            </p>
          </div>
        )}

        {activeMethod === 'iframe' && (
          <div className="mt-3 p-3 bg-yellow-50 border border-yellow-100 rounded-lg">
            <p className="text-xs text-yellow-800 font-medium mb-1">
              {t('chat.embed.iframeNote') || 'Note'}
            </p>
            <p className="text-xs text-yellow-700">
              {t('chat.embed.iframeWarning') || 'The iframe method is simpler but may have cross-origin limitations. Use the JavaScript method for full functionality.'}
            </p>
          </div>
        )}
      </div>

      {/* Advanced Options */}
      <div className="border-t border-gray-200">
        <button
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="w-full px-6 py-3 flex items-center justify-between text-sm text-gray-600 hover:bg-gray-50 transition-colors"
        >
          <span className="font-medium">
            {t('chat.embed.advancedOptions') || 'Advanced Options'}
          </span>
          {showAdvanced ? (
            <ChevronUp className="w-4 h-4" />
          ) : (
            <ChevronDown className="w-4 h-4" />
          )}
        </button>

        {showAdvanced && (
          <div className="px-6 pb-6 space-y-4">
            {/* Color */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t('chat.embed.optionColor') || 'Widget Color'}
              </label>
              <div className="flex items-center gap-2">
                <div
                  className="w-8 h-8 rounded-md border border-gray-300"
                  style={{ backgroundColor: widgetColor }}
                />
                <code className="text-sm text-gray-600 bg-gray-100 px-2 py-1 rounded">
                  {widgetColor}
                </code>
              </div>
              <p className="text-xs text-gray-400 mt-1">
                {t('chat.embed.optionColorHint') || 'Change the data-color attribute in the embed code to customize.'}
              </p>
            </div>

            {/* Position */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t('chat.embed.optionPosition') || 'Widget Position'}
              </label>
              <code className="text-sm text-gray-600 bg-gray-100 px-2 py-1 rounded">
                {position}
              </code>
              <p className="text-xs text-gray-400 mt-1">
                {t('chat.embed.optionPositionHint') || 'Set data-position to "bottom-left" or "bottom-right".'}
              </p>
            </div>

            {/* API Endpoint */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t('chat.embed.optionApi') || 'API Endpoint'}
              </label>
              <code className="text-sm text-gray-600 bg-gray-100 px-2 py-1 rounded break-all">
                {resolvedBaseUrl}/api/public/chat
              </code>
              <p className="text-xs text-gray-400 mt-1">
                {t('chat.embed.optionApiHint') || 'The widget sends POST requests with { name, email, message, conversationId } to this endpoint.'}
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
