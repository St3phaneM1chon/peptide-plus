/**
 * ADMIN - Carrier Rate Calculator
 *
 * Estimate shipping rates from Canada Post, Purolator, and FedEx
 * based on weight, dimensions, and postal codes.
 */

'use client';

import { useState, useCallback } from 'react';
import {
  Truck,
  Calculator,
  Package,
  MapPin,
  Scale,
  Ruler,
  RefreshCw,
  ArrowRight,
  DollarSign,
  Clock,
} from 'lucide-react';
import {
  PageHeader,
  Button,
  StatCard,
} from '@/components/admin';
import { useI18n } from '@/i18n/client';
import { toast } from 'sonner';

interface CarrierRate {
  carrier: string;
  service: string;
  rate: number;
  estimatedDays: string;
  currency: string;
}

const CARRIER_COLORS: Record<string, string> = {
  'Canada Post': 'border-l-red-500 bg-red-50 dark:bg-red-900/10',
  'Purolator': 'border-l-green-500 bg-green-50 dark:bg-green-900/10',
  'FedEx': 'border-l-purple-500 bg-purple-50 dark:bg-purple-900/10',
};

const CARRIER_BADGES: Record<string, string> = {
  'Canada Post': 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  'Purolator': 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  'FedEx': 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
};

export default function CarrierRatesPage() {
  const { t, formatCurrency } = useI18n();
  const [originPostal, setOriginPostal] = useState('H2X 1Y4');
  const [destPostal, setDestPostal] = useState('');
  const [weightGrams, setWeightGrams] = useState('500');
  const [lengthCm, setLengthCm] = useState('');
  const [widthCm, setWidthCm] = useState('');
  const [heightCm, setHeightCm] = useState('');
  const [carrier, setCarrier] = useState('all');
  const [rates, setRates] = useState<CarrierRate[]>([]);
  const [loading, setLoading] = useState(false);
  const [cached, setCached] = useState(false);

  const calculateRates = useCallback(async () => {
    if (!destPostal.trim()) {
      toast.error(t('admin.carrierRates.destRequired'));
      return;
    }

    setLoading(true);
    try {
      const body: Record<string, unknown> = {
        originPostal: originPostal.trim(),
        destPostal: destPostal.trim(),
        weightGrams: parseInt(weightGrams, 10) || 500,
        carrier,
      };

      if (lengthCm && widthCm && heightCm) {
        body.dimensions = {
          lengthCm: parseInt(lengthCm, 10),
          widthCm: parseInt(widthCm, 10),
          heightCm: parseInt(heightCm, 10),
        };
      }

      const res = await fetch('/api/admin/carrier-rates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();

      if (data.success) {
        setRates(data.rates || []);
        setCached(data.cached || false);
        if (data.rates?.length === 0) {
          toast.info(t('admin.carrierRates.noRates'));
        }
      } else {
        toast.error(data.error?.message || t('admin.carrierRates.calcError'));
      }
    } catch {
      toast.error(t('admin.carrierRates.calcError'));
    } finally {
      setLoading(false);
    }
  }, [originPostal, destPostal, weightGrams, lengthCm, widthCm, heightCm, carrier, t]);

  const cheapest = rates.length > 0 ? rates[0] : null;
  const fastest = rates.length > 0 ? [...rates].sort((a, b) => {
    // Parse first number from estimatedDays
    const aNum = parseInt(a.estimatedDays.match(/\d+/)?.[0] || '99', 10);
    const bNum = parseInt(b.estimatedDays.match(/\d+/)?.[0] || '99', 10);
    return aNum - bNum;
  })[0] : null;

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('admin.carrierRates.title')}
        subtitle={t('admin.carrierRates.description')}
      />

      {/* Calculator Form */}
      <div className="rounded-xl border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800">
        <h3 className="mb-4 flex items-center gap-2 text-base font-semibold text-gray-900 dark:text-gray-100">
          <Calculator className="h-5 w-5 text-blue-500" />
          {t('admin.carrierRates.calculator')}
        </h3>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {/* Origin */}
          <div>
            <label className="flex items-center gap-1.5 text-sm font-medium text-gray-700 dark:text-gray-300">
              <MapPin className="h-3.5 w-3.5" />
              {t('admin.carrierRates.originPostal')}
            </label>
            <input
              type="text"
              value={originPostal}
              onChange={(e) => setOriginPostal(e.target.value)}
              placeholder="H2X 1Y4"
              className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm uppercase dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
            />
          </div>

          {/* Destination */}
          <div>
            <label className="flex items-center gap-1.5 text-sm font-medium text-gray-700 dark:text-gray-300">
              <MapPin className="h-3.5 w-3.5" />
              {t('admin.carrierRates.destPostal')}
            </label>
            <input
              type="text"
              value={destPostal}
              onChange={(e) => setDestPostal(e.target.value)}
              placeholder="M5J 2X2"
              className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm uppercase dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
            />
          </div>

          {/* Weight */}
          <div>
            <label className="flex items-center gap-1.5 text-sm font-medium text-gray-700 dark:text-gray-300">
              <Scale className="h-3.5 w-3.5" />
              {t('admin.carrierRates.weightGrams')}
            </label>
            <input
              type="number"
              value={weightGrams}
              onChange={(e) => setWeightGrams(e.target.value)}
              placeholder="500"
              min="1"
              max="30000"
              className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
            />
          </div>

          {/* Dimensions (optional) */}
          <div className="sm:col-span-2 lg:col-span-3">
            <label className="flex items-center gap-1.5 text-sm font-medium text-gray-700 dark:text-gray-300">
              <Ruler className="h-3.5 w-3.5" />
              {t('admin.carrierRates.dimensions')} ({t('admin.carrierRates.optional')})
            </label>
            <div className="mt-1 grid grid-cols-3 gap-2">
              <input
                type="number"
                value={lengthCm}
                onChange={(e) => setLengthCm(e.target.value)}
                placeholder={`${t('admin.carrierRates.length')} (cm)`}
                className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
              />
              <input
                type="number"
                value={widthCm}
                onChange={(e) => setWidthCm(e.target.value)}
                placeholder={`${t('admin.carrierRates.width')} (cm)`}
                className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
              />
              <input
                type="number"
                value={heightCm}
                onChange={(e) => setHeightCm(e.target.value)}
                placeholder={`${t('admin.carrierRates.height')} (cm)`}
                className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
              />
            </div>
          </div>

          {/* Carrier filter */}
          <div>
            <label className="flex items-center gap-1.5 text-sm font-medium text-gray-700 dark:text-gray-300">
              <Truck className="h-3.5 w-3.5" />
              {t('admin.carrierRates.carrier')}
            </label>
            <select
              value={carrier}
              onChange={(e) => setCarrier(e.target.value)}
              className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
            >
              <option value="all">{t('admin.carrierRates.allCarriers')}</option>
              <option value="canada_post">Canada Post</option>
              <option value="purolator">Purolator</option>
              <option value="fedex">FedEx</option>
            </select>
          </div>
        </div>

        <div className="mt-4">
          <Button onClick={calculateRates} loading={loading} icon={Calculator}>
            {t('admin.carrierRates.calculate')}
          </Button>
        </div>
      </div>

      {/* Results */}
      {rates.length > 0 && (
        <>
          {/* Summary cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <StatCard
              label={t('admin.carrierRates.totalOptions')}
              value={String(rates.length)}
              icon={Package}
            />
            {cheapest && (
              <StatCard
                label={t('admin.carrierRates.cheapest')}
                value={`${formatCurrency(cheapest.rate)} — ${cheapest.carrier}`}
                icon={DollarSign}
              />
            )}
            {fastest && (
              <StatCard
                label={t('admin.carrierRates.fastest')}
                value={`${fastest.estimatedDays} — ${fastest.carrier}`}
                icon={Clock}
              />
            )}
          </div>

          {cached && (
            <p className="flex items-center gap-1 text-xs text-gray-400">
              <RefreshCw className="h-3 w-3" />
              {t('admin.carrierRates.cachedResult')}
            </p>
          )}

          {/* Rate cards */}
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {rates.map((rate, idx) => (
              <div
                key={`${rate.carrier}-${rate.service}-${idx}`}
                className={`rounded-xl border-l-4 border border-gray-200 p-4 dark:border-gray-700 ${
                  CARRIER_COLORS[rate.carrier] || 'bg-gray-50 dark:bg-gray-800'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div>
                    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                      CARRIER_BADGES[rate.carrier] || 'bg-gray-100 text-gray-700'
                    }`}>
                      {rate.carrier}
                    </span>
                    <p className="mt-1.5 text-sm font-semibold text-gray-900 dark:text-gray-100">
                      {rate.service}
                    </p>
                  </div>
                  <p className="text-lg font-bold text-gray-900 dark:text-gray-100">
                    {formatCurrency(rate.rate)}
                  </p>
                </div>
                <div className="mt-2 flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
                  <Clock className="h-3 w-3" />
                  {rate.estimatedDays}
                </div>
                {idx === 0 && (
                  <span className="mt-2 inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-[10px] font-medium text-green-700 dark:bg-green-900/30 dark:text-green-400">
                    <ArrowRight className="h-2.5 w-2.5" />
                    {t('admin.carrierRates.bestValue')}
                  </span>
                )}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
