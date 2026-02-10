'use client';

export type FormatType = 'vial_2ml' | 'vial_10ml' | 'cartridge_3ml' | 'cartridge_kit_12' | 'capsule' | 'pack_10' | 'syringe' | 'accessory';

interface Format {
  id: string;
  name: string;
  type: FormatType;
  price: number;
  comparePrice?: number;
  inStock: boolean;
  stockQuantity: number;
}

interface FormatSelectorProps {
  formats: Format[];
  selectedFormat: Format;
  onSelect: (format: Format) => void;
  formatPrice: (price: number) => string;
}

// Format icons/images mapping
const formatImages: Record<FormatType, { icon: string; label: string }> = {
  vial_2ml: { icon: '💉', label: 'Vial 2ml' },
  vial_10ml: { icon: '🧪', label: 'Vial 10ml' },
  cartridge_3ml: { icon: '💊', label: 'Cartridge 3ml' },
  cartridge_kit_12: { icon: '📦', label: 'Kit 12 Cartridges' },
  capsule: { icon: '💊', label: 'Capsules' },
  pack_10: { icon: '📦', label: '10-Pack' },
  syringe: { icon: '💉', label: 'Syringe' },
  accessory: { icon: '🔧', label: 'Accessory' },
};

export default function FormatSelector({ 
  formats, 
  selectedFormat, 
  onSelect, 
  formatPrice 
}: FormatSelectorProps) {
  return (
    <div className="space-y-3">
      <label className="text-sm text-neutral-500 uppercase tracking-wider block">
        Select Format:
      </label>
      
      <div className="grid grid-cols-2 gap-3">
        {formats.map((format) => {
          const formatInfo = formatImages[format.type] || { icon: '📦', label: format.name };
          const isSelected = selectedFormat.id === format.id;
          
          return (
            <button
              key={format.id}
              onClick={() => onSelect(format)}
              disabled={!format.inStock}
              className={`relative flex items-center gap-3 p-3 rounded-xl border-2 text-left transition-all ${
                isSelected
                  ? 'border-orange-500 bg-orange-50'
                  : format.inStock
                  ? 'border-neutral-200 hover:border-neutral-300 bg-white'
                  : 'border-neutral-200 bg-neutral-100 opacity-60 cursor-not-allowed'
              }`}
            >
              {/* Format Icon/Image */}
              <div className={`w-12 h-12 rounded-lg flex items-center justify-center text-2xl ${
                isSelected ? 'bg-orange-100' : 'bg-neutral-100'
              }`}>
                {formatInfo.icon}
              </div>
              
              {/* Format Info */}
              <div className="flex-1 min-w-0">
                <p className={`font-medium text-sm truncate ${
                  isSelected ? 'text-orange-700' : 'text-neutral-900'
                }`}>
                  {format.name}
                </p>
                <p className={`text-sm font-bold ${
                  isSelected ? 'text-orange-600' : 'text-neutral-700'
                }`}>
                  {formatPrice(format.price)}
                </p>
                {format.comparePrice && format.comparePrice > format.price && (
                  <p className="text-xs text-neutral-400 line-through">
                    {formatPrice(format.comparePrice)}
                  </p>
                )}
              </div>

              {/* Selected Indicator */}
              {isSelected && (
                <div className="absolute top-2 right-2 w-5 h-5 bg-orange-500 rounded-full flex items-center justify-center">
                  <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                </div>
              )}

              {/* Out of Stock Badge */}
              {!format.inStock && (
                <span className="absolute top-2 right-2 text-xs bg-red-100 text-red-600 px-2 py-0.5 rounded-full">
                  Out of stock
                </span>
              )}

              {/* Low Stock Warning */}
              {format.inStock && format.stockQuantity <= 5 && (
                <span className="absolute bottom-1 right-2 text-xs text-amber-600">
                  {format.stockQuantity} left
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
