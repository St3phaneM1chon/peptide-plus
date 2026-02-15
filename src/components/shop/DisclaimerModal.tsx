'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from '@/hooks/useTranslations';

export default function DisclaimerModal() {
  const { t } = useTranslations();
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    // Check if user has already accepted
    const hasAccepted = localStorage.getItem('biocycle_disclaimer_accepted');
    if (!hasAccepted) {
      setIsOpen(true);
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

  const content = {
    title: t('disclaimer.title'),
    intro: t('disclaimer.text'),
    warning: t('disclaimer.notForConsumption') + ' ' + t('disclaimer.byEntering'),
    age: t('disclaimer.age'),
    research: t('disclaimer.research'),
    noConsumption: t('disclaimer.understand'),
    accept: t('disclaimer.agree'),
    decline: t('disclaimer.disagree'),
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
