'use client';

import { useCallback } from 'react';
import { ContactListPage } from '@/components/admin/ContactListPage';
import { useRibbonAction } from '@/hooks/useRibbonAction';
import { useI18n } from '@/i18n/client';
import { toast } from 'sonner';
import { customerConfig } from './config';

export default function CustomersPage() {
  const { t } = useI18n();

  const ribbonNewCustomer = useCallback(() => {
    toast.info(t('common.comingSoon'));
  }, [t]);

  const ribbonSalesStats = useCallback(() => {
    toast.info(t('common.comingSoon'));
  }, [t]);

  const ribbonTypeStats = useCallback(() => {
    toast.info(t('common.comingSoon'));
  }, [t]);

  const ribbonReviewStats = useCallback(() => {
    toast.info(t('common.comingSoon'));
  }, [t]);

  const ribbonAmbassadorStats = useCallback(() => {
    toast.info(t('common.comingSoon'));
  }, [t]);

  const ribbonExport = useCallback(() => {
    toast.info(t('common.comingSoon'));
  }, [t]);

  useRibbonAction('newCustomer', ribbonNewCustomer);
  useRibbonAction('salesStats', ribbonSalesStats);
  useRibbonAction('typeStats', ribbonTypeStats);
  useRibbonAction('reviewStats', ribbonReviewStats);
  useRibbonAction('ambassadorStats', ribbonAmbassadorStats);
  useRibbonAction('export', ribbonExport);

  return <ContactListPage config={customerConfig} />;
}
