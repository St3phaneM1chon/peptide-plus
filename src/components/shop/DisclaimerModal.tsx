'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from '@/hooks/useTranslations';

export default function DisclaimerModal() {
  const { t, locale } = useTranslations();
  const [isOpen, setIsOpen] = useState(false);
  const [detectedLocale, setDetectedLocale] = useState<string | null>(null);

  useEffect(() => {
    // Check if user has already accepted
    const hasAccepted = localStorage.getItem('biocycle_disclaimer_accepted');
    if (!hasAccepted) {
      setIsOpen(true);
    }

    // Detect browser language for initial display
    if (typeof navigator !== 'undefined') {
      const browserLang = navigator.language || (navigator as any).userLanguage;
      setDetectedLocale(browserLang?.split('-')[0] || 'en');
    }
  }, []);

  const handleAccept = () => {
    localStorage.setItem('biocycle_disclaimer_accepted', 'true');
    setIsOpen(false);
    
    // Dispatch event for newsletter popup to know disclaimer is done
    window.dispatchEvent(new CustomEvent('disclaimerAccepted'));
  };

  const handleDecline = () => {
    window.location.href = 'https://www.google.com';
  };

  if (!isOpen) return null;

  // Use translated content or fallback based on detected locale
  const isFrench = locale === 'fr' || detectedLocale === 'fr';

  // Helper to get translation with fallback
  const getText = (key: string, enFallback: string, frFallback: string) => {
    const translated = t(key);
    if (translated !== key) return translated;
    return isFrench ? frFallback : enFallback;
  };

  const content = {
    title: getText('disclaimer.title', 'Research Use Only', 'Usage de recherche uniquement'),
    intro: getText('disclaimer.text', 
      'All products sold on this website are intended for laboratory and research purposes only.',
      'Tous les produits vendus sur ce site sont destinés uniquement à des fins de laboratoire et de recherche.'),
    warning: getText('disclaimer.notForConsumption',
      'These products are NOT intended for human or animal consumption.',
      'Ces produits NE SONT PAS destinés à la consommation humaine ou animale.') + ' ' +
      getText('disclaimer.byEntering',
        'By entering this website, you confirm that:',
        'En entrant sur ce site, vous confirmez que:'),
    age: getText('disclaimer.age', 'You are at least 21 years of age', 'Vous avez au moins 21 ans'),
    research: getText('disclaimer.research', 
      'You will use products only for legitimate research', 
      'Vous utiliserez les produits uniquement pour la recherche légitime'),
    noConsumption: getText('disclaimer.understand', 
      'You understand these products are not for consumption', 
      'Vous comprenez que ces produits ne sont pas destinés à la consommation'),
    accept: getText('disclaimer.agree', 'I Agree - Enter Site', "J'accepte - Entrer sur le site"),
    decline: getText('disclaimer.disagree', 'I Disagree - Leave Site', 'Je refuse - Quitter le site'),
  };

  return (
    <div className="fixed inset-0 bg-black/80 z-[200] flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl">
        {/* Logo */}
        <div className="flex items-center justify-center gap-2 mb-6">
          <div className="w-10 h-10 bg-orange-500 rounded-lg flex items-center justify-center">
            <span className="text-white font-bold">BC</span>
          </div>
          <span className="font-bold text-xl">BioCycle Peptides</span>
        </div>

        {/* Title */}
        <h2 className="text-xl font-bold text-center mb-4">
          {content.title}
        </h2>

        {/* Content */}
        <div className="text-sm text-neutral-600 space-y-4 mb-6">
          <p>
            {content.intro}
          </p>
          <p>
            {content.warning}
          </p>
          <ul className="list-disc list-inside space-y-2 ml-2">
            <li><strong>{content.age}</strong></li>
            <li><strong>{content.research}</strong></li>
            <li><strong>{content.noConsumption}</strong></li>
          </ul>
        </div>

        {/* Buttons */}
        <div className="space-y-3">
          <button
            onClick={handleAccept}
            className="w-full py-3 bg-orange-500 text-white font-semibold rounded-lg hover:bg-orange-600 transition-colors"
          >
            {content.accept}
          </button>
          <button
            onClick={handleDecline}
            className="w-full py-3 border border-neutral-300 text-neutral-600 font-medium rounded-lg hover:bg-neutral-50 transition-colors"
          >
            {content.decline}
          </button>
        </div>
      </div>
    </div>
  );
}
