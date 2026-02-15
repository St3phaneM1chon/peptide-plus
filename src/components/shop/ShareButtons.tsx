'use client';

import { useState, useEffect, useCallback } from 'react';
import { Share2, Link2, Check } from 'lucide-react';
import { toast } from 'sonner';

interface ShareButtonsProps {
  url: string;
  title: string;
  description?: string;
}

// Brand SVG icons (not available in lucide-react)
function TwitterIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  );
}

function FacebookIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M9.101 23.691v-7.98H6.627v-3.667h2.474v-1.58c0-4.085 1.848-5.978 5.858-5.978.401 0 1.09.044 1.613.115v3.146c-.427-.044-.72-.065-.95-.065-1.35 0-1.872.513-1.872 1.846v2.516h3.332l-.468 3.668h-2.864v7.979z" />
    </svg>
  );
}

function LinkedInIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
    </svg>
  );
}

function WhatsAppIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
    </svg>
  );
}

export default function ShareButtons({ url, title, description }: ShareButtonsProps) {
  const [copied, setCopied] = useState(false);
  const [canNativeShare, setCanNativeShare] = useState(false);
  const [absoluteUrl, setAbsoluteUrl] = useState(url);

  useEffect(() => {
    // Resolve relative URL to absolute using window.location.origin
    if (url.startsWith('/')) {
      setAbsoluteUrl(`${window.location.origin}${url}`);
    } else if (!url.startsWith('http')) {
      setAbsoluteUrl(`${window.location.origin}/${url}`);
    } else {
      setAbsoluteUrl(url);
    }

    // Check for Web Share API support (primarily mobile)
    setCanNativeShare(
      typeof navigator !== 'undefined' &&
      typeof navigator.share === 'function' &&
      // Only use native share on touch devices (mobile)
      ('ontouchstart' in window || navigator.maxTouchPoints > 0)
    );
  }, [url]);

  const handleNativeShare = useCallback(async () => {
    try {
      await navigator.share({
        title,
        text: description || title,
        url: absoluteUrl,
      });
    } catch (err) {
      // User cancelled or share failed - ignore AbortError
      if (err instanceof Error && err.name !== 'AbortError') {
        console.error('Share failed:', err);
      }
    }
  }, [absoluteUrl, title, description]);

  const handleCopyLink = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(absoluteUrl);
      setCopied(true);
      toast.success('Link copied!', {
        description: 'Product link has been copied to your clipboard.',
        duration: 2000,
      });
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback for older browsers
      const textArea = document.createElement('textarea');
      textArea.value = absoluteUrl;
      textArea.style.position = 'fixed';
      textArea.style.opacity = '0';
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      setCopied(true);
      toast.success('Link copied!');
      setTimeout(() => setCopied(false), 2000);
    }
  }, [absoluteUrl]);

  const encodedUrl = encodeURIComponent(absoluteUrl);
  const encodedTitle = encodeURIComponent(title);

  const shareLinks = [
    {
      name: 'X',
      href: `https://twitter.com/intent/tweet?text=${encodedTitle}&url=${encodedUrl}`,
      icon: TwitterIcon,
      hoverClass: 'hover:bg-black hover:text-white',
      bgClass: 'bg-neutral-100 text-neutral-600',
    },
    {
      name: 'Facebook',
      href: `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`,
      icon: FacebookIcon,
      hoverClass: 'hover:bg-[#1877F2] hover:text-white',
      bgClass: 'bg-neutral-100 text-neutral-600',
    },
    {
      name: 'LinkedIn',
      href: `https://www.linkedin.com/sharing/share-offsite/?url=${encodedUrl}`,
      icon: LinkedInIcon,
      hoverClass: 'hover:bg-[#0A66C2] hover:text-white',
      bgClass: 'bg-neutral-100 text-neutral-600',
    },
    {
      name: 'WhatsApp',
      href: `https://wa.me/?text=${encodedTitle}%20${encodedUrl}`,
      icon: WhatsAppIcon,
      hoverClass: 'hover:bg-[#25D366] hover:text-white',
      bgClass: 'bg-neutral-100 text-neutral-600',
    },
  ];

  // On mobile with native share support, show a single share button
  if (canNativeShare) {
    return (
      <div className="flex items-center gap-2">
        <button
          onClick={handleNativeShare}
          className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-neutral-300 bg-white text-neutral-600 hover:border-orange-400 hover:text-orange-600 transition-colors text-sm"
          aria-label="Share this product"
        >
          <Share2 className="w-4 h-4" />
          <span className="font-medium">Share</span>
        </button>
      </div>
    );
  }

  // Desktop: show individual share buttons
  return (
    <div className="flex items-center gap-2 flex-wrap">
      <span className="flex items-center gap-1.5 text-sm text-neutral-500 mr-1">
        <Share2 className="w-4 h-4" />
        Share
      </span>

      {shareLinks.map((link) => {
        const Icon = link.icon;
        return (
          <a
            key={link.name}
            href={link.href}
            target="_blank"
            rel="noopener noreferrer"
            title={`Share on ${link.name}`}
            aria-label={`Share on ${link.name}`}
            className={`w-8 h-8 rounded-full flex items-center justify-center transition-all duration-200 ${link.bgClass} ${link.hoverClass}`}
          >
            <Icon className="w-4 h-4" />
          </a>
        );
      })}

      {/* Copy Link button */}
      <button
        onClick={handleCopyLink}
        title="Copy link"
        aria-label="Copy product link"
        className={`w-8 h-8 rounded-full flex items-center justify-center transition-all duration-200 ${
          copied
            ? 'bg-green-500 text-white'
            : 'bg-neutral-100 text-neutral-600 hover:bg-orange-500 hover:text-white'
        }`}
      >
        {copied ? <Check className="w-4 h-4" /> : <Link2 className="w-4 h-4" />}
      </button>
    </div>
  );
}
