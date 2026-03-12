'use client';

import dynamic from 'next/dynamic';
import { UpsellProvider } from '@/contexts/UpsellContext';
import DisclaimerModal from '@/components/shop/DisclaimerModal';
import CookieConsent from '@/components/shop/CookieConsent';
import BackToTop from '@/components/ui/BackToTop';
import { Toaster } from 'sonner';

// Lazy-loaded: non-critical, below-fold or conditional components
const ChatWidget = dynamic(() => import('@/components/chat/ChatWidget'), { ssr: false });
const NewsletterPopup = dynamic(() => import('@/components/shop/NewsletterPopup'), { ssr: false });
const CompareBar = dynamic(() => import('@/components/shop/CompareBar'), { ssr: false });
const InstallPWA = dynamic(() => import('@/components/ui/InstallPWA'), { ssr: false });
const TextToSpeechButton = dynamic(() => import('@/components/shop/TextToSpeechButton'), { ssr: false });

export default function ShopClientProviders({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <UpsellProvider>
      {children}
      <DisclaimerModal />
      <NewsletterPopup />
      <CookieConsent />
      <ChatWidget />
      <TextToSpeechButton />
      <BackToTop />
      <CompareBar />
      <InstallPWA />
      <Toaster position="bottom-right" richColors closeButton />
    </UpsellProvider>
  );
}
