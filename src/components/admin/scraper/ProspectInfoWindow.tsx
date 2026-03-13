'use client';

/**
 * ProspectInfoWindow — InfoWindow overlay showing prospect details and CRM actions.
 */

import { InfoWindow } from '@vis.gl/react-google-maps';
import { Phone, Mail, Globe, Star, MapPin, Plus, Check, Loader2 } from 'lucide-react';
import { useTranslations } from '@/hooks/useTranslations';
import type { ScrapedPlace } from './types';

interface ProspectInfoWindowProps {
  place: ScrapedPlace;
  position: { lat: number; lng: number };
  onClose: () => void;
  onSelect: () => void;
  onAddToCrm: () => void;
  isSelected: boolean;
  crmLoading?: boolean;
}

export default function ProspectInfoWindow({
  place,
  position,
  onClose,
  onSelect,
  onAddToCrm,
  isSelected,
  crmLoading,
}: ProspectInfoWindowProps) {
  const { t } = useTranslations();
  const renderStars = (rating: number | null) => {
    if (rating === null) return null;
    return (
      <span className="flex items-center gap-0.5">
        {Array.from({ length: 5 }, (_, i) => (
          <Star
            key={i}
            className={`h-3 w-3 ${
              i < Math.floor(rating)
                ? 'fill-yellow-400 text-yellow-400'
                : i < rating
                  ? 'fill-yellow-400/50 text-yellow-400'
                  : 'text-gray-300'
            }`}
          />
        ))}
        <span className="ml-1 text-xs font-medium">{rating.toFixed(1)}</span>
        {place.googleReviewCount != null && (
          <span className="text-xs text-gray-500 ml-1">({place.googleReviewCount})</span>
        )}
      </span>
    );
  };

  return (
    <InfoWindow
      position={position}
      onCloseClick={onClose}
      maxWidth={320}
    >
      <div className="p-1 space-y-2 text-sm">
        {/* Name + Category */}
        <div>
          <h3 className="font-semibold text-gray-900 text-base leading-tight">{place.name}</h3>
          {place.category && (
            <span className="text-xs text-gray-500">{place.category}</span>
          )}
        </div>

        {/* Rating */}
        {place.googleRating != null && (
          <div>{renderStars(place.googleRating)}</div>
        )}

        {/* Address */}
        {place.address && (
          <div className="flex items-start gap-1.5 text-gray-600">
            <MapPin className="h-3.5 w-3.5 mt-0.5 shrink-0" />
            <span className="text-xs">{place.address}</span>
          </div>
        )}

        {/* Phone */}
        {place.phone && (
          <div className="flex items-center gap-1.5">
            <Phone className="h-3.5 w-3.5 text-gray-500" />
            <a href={`tel:${place.phone}`} className="text-xs text-blue-600 hover:underline">
              {place.phone}
            </a>
          </div>
        )}

        {/* Email */}
        {place.email && (
          <div className="flex items-center gap-1.5">
            <Mail className="h-3.5 w-3.5 text-gray-500" />
            <a href={`mailto:${place.email}`} className="text-xs text-blue-600 hover:underline">
              {place.email}
            </a>
          </div>
        )}

        {/* Website */}
        {place.website && (
          <div className="flex items-center gap-1.5">
            <Globe className="h-3.5 w-3.5 text-gray-500" />
            <a
              href={place.website}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-blue-600 hover:underline truncate max-w-[200px]"
            >
              {place.website.replace(/^https?:\/\/(www\.)?/, '')}
            </a>
          </div>
        )}

        {/* Action buttons */}
        <div className="flex items-center gap-2 pt-1 border-t border-gray-100">
          <button
            onClick={onSelect}
            className={`flex items-center gap-1 px-2.5 py-1 rounded text-xs font-medium transition-colors ${
              isSelected
                ? 'bg-green-100 text-green-700 hover:bg-green-200'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            <Check className={`h-3 w-3 ${isSelected ? 'opacity-100' : 'opacity-0'}`} />
            {isSelected ? t('admin.scraper.selected') : t('admin.scraper.select')}
          </button>
          <button
            onClick={onAddToCrm}
            disabled={crmLoading}
            className="flex items-center gap-1 px-2.5 py-1 rounded text-xs font-medium bg-blue-600 text-white hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {crmLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3 w-3" />}
            CRM
          </button>
        </div>
      </div>
    </InfoWindow>
  );
}
