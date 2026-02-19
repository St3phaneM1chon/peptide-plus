'use client';

import dynamic from 'next/dynamic';
import { UpsellProvider } from '@/contexts/UpsellContext';
import Header from '@/components/shop/Header';
import Footer from '@/components/shop/Footer';
import FreeShippingBanner from '@/components/shop/FreeShippingBanner';
import DisclaimerModal from '@/components/shop/DisclaimerModal';
import CookieConsent from '@/components/shop/CookieConsent';
import BackToTop from '@/components/ui/BackToTop';
import SkipToContent from '@/components/ui/SkipToContent';
import { Toaster } from 'sonner';

// Lazy-loaded: non-critical, below-fold or conditional components
const ChatWidget = dynamic(() => import('@/components/chat/ChatWidget'), { ssr: false });
const NewsletterPopup = dynamic(() => import('@/components/shop/NewsletterPopup'), { ssr: false });
const CompareBar = dynamic(() => import('@/components/shop/CompareBar'), { ssr: false });
const InstallPWA = dynamic(() => import('@/components/ui/InstallPWA'), { ssr: false });
const TextToSpeechButton = dynamic(() => import('@/components/shop/TextToSpeechButton'), { ssr: false });

export default function ShopLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <UpsellProvider>
      <div className="min-h-screen flex flex-col bg-white">
        <SkipToContent />
        <FreeShippingBanner />
        <Header />
        <main id="main-content" className="flex-1 relative z-0" tabIndex={-1}>{children}</main>
        <Footer />
        <DisclaimerModal />
        <NewsletterPopup />
        <CookieConsent />
        <ChatWidget />
        <TextToSpeechButton />
        <BackToTop />
        <CompareBar />
        <InstallPWA />
        <Toaster position="bottom-right" richColors closeButton />
      </div>
    </UpsellProvider>
  );
}
