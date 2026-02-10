'use client';

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useCart } from '@/contexts/CartContext';
import { useCurrency } from '@/contexts/CurrencyContext';
import { useTranslations } from '@/hooks/useTranslations';
import { getPeptideChemistry } from '@/data/peptideChemistry';
import ProductReviews from '@/components/shop/ProductReviews';
import ProductQA from '@/components/shop/ProductQA';

interface ProductFormat {
  id: string;
  name: string;
  nameKey?: string;
  type: string;
  dosageMg?: number;
  price: number;
  comparePrice?: number;
  sku: string;
  inStock: boolean;
  stockQuantity: number;
  image?: string;
}

interface RelatedProduct {
  id: string;
  name: string;
  nameKey?: string;
  slug: string;
  price: number;
  purity?: number;
}

interface Product {
  id: string;
  name: string;
  nameKey?: string;
  subtitle: string;
  slug: string;
  shortDescription: string;
  description: string;
  specifications: string;
  price: number;
  purity?: number;
  avgMass?: string;
  molecularWeight?: number;
  casNumber?: string;
  molecularFormula?: string;
  storageConditions?: string;
  categoryName: string;
  categoryKey?: string;
  categorySlug: string;
  isNew?: boolean;
  isBestseller?: boolean;
  formats: ProductFormat[];
  relatedProducts: RelatedProduct[];
}

interface ProductPageClientProps {
  product: Product;
}

// Format icons - same as ProductCard
const formatIcons: Record<string, string> = {
  vial_2ml: '💉',
  vial_10ml: '🧪',
  cartridge_3ml: '💊',
  cartridge_kit_12: '📦',
  capsule: '💊',
  capsules_30: '💊',
  capsules_60: '💊',
  capsules_120: '💊',
  pack_2: '📦',
  pack_5: '📦',
  pack_10: '📦',
  box_50: '📦',
  box_100: '📦',
  syringe: '💉',
  accessory: '🔧',
  powder: '🥤',
  gummies: '🍬',
  kit: '🎁',
};

export default function ProductPageClient({ product }: ProductPageClientProps) {
  const { addItem } = useCart();
  const { formatPrice } = useCurrency();
  const { t } = useTranslations();
  
  const [selectedFormat, setSelectedFormat] = useState<ProductFormat>(
    product.formats.find(f => f.inStock) || product.formats[0]
  );
  const [quantity, setQuantity] = useState(1);
  const [activeTab, setActiveTab] = useState<'description' | 'specs' | 'research' | 'reconstitution'>('description');
  const [addedToCart, setAddedToCart] = useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  
  // Get enriched chemistry data if available
  const chemistryData = getPeptideChemistry(product.slug);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Get translated product name
  const productName = product.nameKey ? t(`products.${product.nameKey}`) : product.name;
  
  // Get translated category
  const categoryName = product.categoryKey ? t(`categories.${product.categoryKey}`) : product.categoryName;

  // Get translated format name
  const getFormatName = (format: ProductFormat) => {
    if (format.nameKey) {
      return t(`formats.${format.nameKey}`);
    }
    return format.name;
  };

  // Get translated related product name
  const getRelatedProductName = (related: RelatedProduct) => {
    if (related.nameKey) {
      return t(`products.${related.nameKey}`);
    }
    return related.name;
  };

  const handleFormatSelect = (format: ProductFormat) => {
    setSelectedFormat(format);
    setQuantity(1);
    setIsDropdownOpen(false);
  };

  const handleAddToCart = () => {
    if (!selectedFormat.inStock) return;
    
    const formatName = getFormatName(selectedFormat);
    const fullProductName = `${productName} ${formatName}`;
    
    addItem({
      productId: product.id,
      formatId: selectedFormat.id,
      name: fullProductName,
      formatName: formatName,
      price: selectedFormat.price,
      comparePrice: selectedFormat.comparePrice,
      sku: selectedFormat.sku,
      image: '/images/products/peptide-default.png',
      maxQuantity: selectedFormat.stockQuantity,
      quantity,
    });
    
    setAddedToCart(true);
    setTimeout(() => setAddedToCart(false), 2000);
  };

  return (
    <div className="min-h-screen bg-white">
      {/* Breadcrumb */}
      <div className="bg-neutral-100 border-b">
        <div className="max-w-6xl mx-auto px-4 py-3">
          <nav className="flex items-center gap-2 text-sm text-neutral-500">
            <Link href="/" className="hover:text-black">{t('nav.home')}</Link>
            <span>/</span>
            <Link href="/shop" className="hover:text-black">{t('nav.shop')}</Link>
            <span>/</span>
            <Link href={`/category/${product.categorySlug}`} className="hover:text-black">{categoryName}</Link>
            <span>/</span>
            <span className="text-black">{productName}</span>
          </nav>
        </div>
      </div>

      {/* Product Content */}
      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12">
          
          {/* LEFT: Image */}
          <div>
            <div className="aspect-square max-w-md mx-auto bg-neutral-100 rounded-lg overflow-hidden relative">
              <Image
                src="/images/products/peptide-default.png"
                alt={productName}
                fill
                className="object-cover"
                priority
              />
              {product.isNew && (
                <span className="absolute top-3 left-3 bg-blue-600 text-white text-xs font-bold px-2 py-1 rounded">
                  {t('shop.new')}
                </span>
              )}
              {product.isBestseller && (
                <span className="absolute top-3 right-3 bg-orange-500 text-white text-xs font-bold px-2 py-1 rounded">
                  {t('shop.bestseller')}
                </span>
              )}
            </div>
          </div>

          {/* RIGHT: Product Info */}
          <div>
            {/* Category Badge */}
            <span className="inline-block px-3 py-1 bg-black/80 text-white text-xs font-medium rounded-full mb-3">
              {categoryName}
            </span>

            {/* Title - adapts with selected format */}
            <h1 className="text-2xl lg:text-3xl font-bold text-black mb-2">
              {productName} {getFormatName(selectedFormat)}
            </h1>

            {/* Subtitle */}
            {product.subtitle && (
              <p className="text-lg text-neutral-600 mb-4">
                {product.subtitle}
              </p>
            )}

            {/* Price - adapts with selected format */}
            <div className="flex items-center gap-3 mb-4">
              <span className="text-3xl font-bold text-orange-600">
                {formatPrice(selectedFormat.price)}
              </span>
              {selectedFormat.comparePrice && selectedFormat.comparePrice > selectedFormat.price && (
                <span className="text-xl text-neutral-400 line-through">
                  {formatPrice(selectedFormat.comparePrice)}
                </span>
              )}
            </div>

            {/* Purity & Mass Badges */}
            {(product.purity || product.avgMass) && (
              <div className="flex flex-wrap gap-2 mb-4">
                {product.purity && (
                  <span className="bg-green-100 text-green-700 px-3 py-1 rounded-full text-sm font-medium">
                    {t('shop.purity')} {product.purity}%
                  </span>
                )}
                {product.avgMass && (
                  <span className="bg-neutral-100 text-neutral-700 px-3 py-1 rounded-full text-sm font-medium">
                    {t('shop.avgMass')} {product.avgMass}
                  </span>
                )}
              </div>
            )}

            {/* Short Description */}
            <p className="text-neutral-700 mb-6 leading-relaxed">
              {product.shortDescription}
            </p>

            {/* Format Selector - Dropdown like ProductCard */}
            <div className="mb-6 relative" ref={dropdownRef}>
              <label className="block text-xs text-neutral-500 uppercase tracking-wider mb-2">
                {t('shop.packaging')}:
              </label>
              <button
                onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                className="w-full flex items-center justify-between gap-3 px-4 py-3 border-2 border-neutral-300 rounded-lg bg-white hover:border-orange-400 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <span className="text-2xl">
                    {selectedFormat?.type ? formatIcons[selectedFormat.type] || '📦' : '📦'}
                  </span>
                  <div className="text-left">
                    <p className="font-semibold text-black">
                      {getFormatName(selectedFormat)}
                    </p>
                    <p className="text-sm text-orange-600 font-bold">
                      {formatPrice(selectedFormat.price)}
                    </p>
                  </div>
                </div>
                <svg 
                  className={`w-5 h-5 text-neutral-400 transition-transform ${isDropdownOpen ? 'rotate-180' : ''}`} 
                  fill="none" 
                  stroke="currentColor" 
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {/* Dropdown Menu */}
              {isDropdownOpen && (
                <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-white border border-neutral-200 rounded-lg shadow-2xl max-h-80 overflow-y-auto">
                  {product.formats.map((format) => (
                    <button
                      key={format.id}
                      onClick={() => handleFormatSelect(format)}
                      disabled={!format.inStock}
                      className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors border-b border-neutral-100 last:border-b-0 ${
                        selectedFormat.id === format.id
                          ? 'bg-orange-50'
                          : format.inStock
                          ? 'hover:bg-neutral-50'
                          : 'opacity-50 cursor-not-allowed bg-neutral-50'
                      }`}
                    >
                      {/* Format Icon */}
                      <div className="w-12 h-12 bg-neutral-100 rounded-lg flex items-center justify-center">
                        {format.image ? (
                          <Image src={format.image} alt={getFormatName(format)} width={48} height={48} className="object-cover rounded-lg" />
                        ) : (
                          <span className="text-2xl">{format.type ? formatIcons[format.type] || '📦' : '📦'}</span>
                        )}
                      </div>
                      
                      {/* Format Info */}
                      <div className="flex-1">
                        <p className="font-medium text-black">{getFormatName(format)}</p>
                        <div className="flex items-center gap-2">
                          <span className="text-orange-600 font-bold">{formatPrice(format.price)}</span>
                          {format.comparePrice && format.comparePrice > format.price && (
                            <span className="text-sm text-neutral-400 line-through">{formatPrice(format.comparePrice)}</span>
                          )}
                        </div>
                        {!format.inStock && (
                          <span className="text-xs text-red-500">{t('shop.outOfStock')}</span>
                        )}
                        {format.inStock && format.stockQuantity <= 10 && (
                          <span className="text-xs text-amber-600">{t('shop.onlyLeft')} {format.stockQuantity} {t('shop.left')}</span>
                        )}
                      </div>

                      {/* Selected Check */}
                      {selectedFormat.id === format.id && (
                        <svg className="w-6 h-6 text-orange-500" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Quantity + Add to Cart */}
            <div className="flex items-center gap-4 mb-6">
              {/* Quantity Selector */}
              <div className="flex items-center border border-neutral-300 rounded-lg">
                <button
                  onClick={() => setQuantity(Math.max(1, quantity - 1))}
                  className="w-12 h-12 flex items-center justify-center text-xl hover:bg-neutral-100 transition-colors"
                >
                  −
                </button>
                <span className="w-14 text-center font-bold text-lg">{quantity}</span>
                <button
                  onClick={() => setQuantity(Math.min(selectedFormat.stockQuantity, quantity + 1))}
                  className="w-12 h-12 flex items-center justify-center text-xl hover:bg-neutral-100 transition-colors"
                >
                  +
                </button>
              </div>

              {/* Add to Cart Button */}
              <button
                onClick={handleAddToCart}
                disabled={!selectedFormat.inStock}
                className={`flex-1 py-3 px-6 rounded-lg font-bold text-lg transition-all ${
                  addedToCart
                    ? 'bg-green-600 text-white'
                    : selectedFormat.inStock
                    ? 'bg-orange-500 text-white hover:bg-orange-600'
                    : 'bg-neutral-300 text-neutral-500 cursor-not-allowed'
                }`}
              >
                {addedToCart 
                  ? `✓ ${t('shop.added')}` 
                  : selectedFormat.inStock 
                    ? `${t('shop.addToCart')} - ${formatPrice(selectedFormat.price * quantity)}`
                    : t('shop.outOfStock')
                }
              </button>
            </div>

            {/* Stock Warning */}
            {selectedFormat.inStock && selectedFormat.stockQuantity <= 10 && (
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-6">
                <p className="text-amber-700 text-sm font-medium">
                  ⚠️ {t('shop.onlyLeft')} {selectedFormat.stockQuantity} {t('shop.left')}!
                </p>
              </div>
            )}

            {/* Trust badges */}
            <div className="flex flex-wrap gap-4 text-sm text-neutral-600 border-t pt-4">
              <span className="flex items-center gap-1">✅ {t('shop.labTested')}</span>
              <span className="flex items-center gap-1">🚚 {t('shop.fastShipping')}</span>
              <span className="flex items-center gap-1">🔒 {t('shop.securePayment')}</span>
              <span className="flex items-center gap-1">📦 {t('shop.freeShipping')}</span>
            </div>
          </div>
        </div>

        {/* Tabs: Description / Specifications / Research / Reconstitution */}
        <div className="mt-12 border-t pt-8">
          <div className="flex flex-wrap gap-4 md:gap-6 border-b mb-6">
            <button
              onClick={() => setActiveTab('description')}
              className={`pb-3 font-medium text-base md:text-lg whitespace-nowrap ${
                activeTab === 'description'
                  ? 'text-orange-600 border-b-2 border-orange-600'
                  : 'text-neutral-500 hover:text-black'
              }`}
            >
              {t('shop.description')}
            </button>
            <button
              onClick={() => setActiveTab('specs')}
              className={`pb-3 font-medium text-base md:text-lg whitespace-nowrap ${
                activeTab === 'specs'
                  ? 'text-orange-600 border-b-2 border-orange-600'
                  : 'text-neutral-500 hover:text-black'
              }`}
            >
              {t('shop.specifications')}
            </button>
            {chemistryData?.researchSummary && (
              <button
                onClick={() => setActiveTab('research')}
                className={`pb-3 font-medium text-base md:text-lg whitespace-nowrap ${
                  activeTab === 'research'
                    ? 'text-orange-600 border-b-2 border-orange-600'
                    : 'text-neutral-500 hover:text-black'
                }`}
              >
                🔬 {t('shop.research') || 'Research'}
              </button>
            )}
            {chemistryData?.reconstitution && (
              <button
                onClick={() => setActiveTab('reconstitution')}
                className={`pb-3 font-medium text-base md:text-lg whitespace-nowrap ${
                  activeTab === 'reconstitution'
                    ? 'text-orange-600 border-b-2 border-orange-600'
                    : 'text-neutral-500 hover:text-black'
                }`}
              >
                💉 {t('shop.reconstitution') || 'Reconstitution'}
              </button>
            )}
          </div>

          {/* Description Tab */}
          {activeTab === 'description' && (
            <div className="prose max-w-none">
              {product.description.split('\n').map((p, i) => (
                <p key={i} className="mb-4 text-neutral-700 leading-relaxed">{p}</p>
              ))}
            </div>
          )}

          {/* Specifications Tab */}
          {activeTab === 'specs' && (
            <div className="bg-neutral-50 rounded-lg p-6">
              {/* COA Download Button */}
              {chemistryData?.coaAvailable && (
                <div className="mb-6 flex flex-wrap gap-3">
                  <button className="inline-flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    {t('shop.downloadCOA') || 'Download COA (PDF)'}
                  </button>
                  <button className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                    </svg>
                    {t('shop.viewHPLC') || 'View HPLC Results'}
                  </button>
                </div>
              )}

              {/* Chemical Properties Grid */}
              <h3 className="font-semibold text-lg mb-4">{t('shop.chemicalProperties') || 'Chemical Properties'}</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                {(product.purity || chemistryData?.hplcPurity) && (
                  <div className="flex justify-between border-b border-neutral-200 pb-3">
                    <span className="text-neutral-500">{t('shop.hplcPurity') || 'HPLC Purity'}</span>
                    <span className="font-bold text-green-600">{chemistryData?.hplcPurity || product.purity}%</span>
                  </div>
                )}
                {product.avgMass && (
                  <div className="flex justify-between border-b border-neutral-200 pb-3">
                    <span className="text-neutral-500">{t('shop.avgMass')}</span>
                    <span className="font-medium">{product.avgMass}</span>
                  </div>
                )}
                {(product.casNumber || chemistryData?.casNumber) && (
                  <div className="flex justify-between border-b border-neutral-200 pb-3">
                    <span className="text-neutral-500">{t('shop.casNumber') || 'CAS Number'}</span>
                    <span className="font-mono text-sm">{chemistryData?.casNumber || product.casNumber}</span>
                  </div>
                )}
                {(product.molecularWeight || chemistryData?.molecularWeight) && (
                  <div className="flex justify-between border-b border-neutral-200 pb-3">
                    <span className="text-neutral-500">{t('shop.molecularWeight') || 'Molecular Weight'}</span>
                    <span className="font-mono">{chemistryData?.molecularWeight || product.molecularWeight} Da</span>
                  </div>
                )}
                {(product.molecularFormula || chemistryData?.molecularFormula) && (
                  <div className="flex justify-between border-b border-neutral-200 pb-3">
                    <span className="text-neutral-500">{t('shop.molecularFormula') || 'Molecular Formula'}</span>
                    <span className="font-mono text-sm">{chemistryData?.molecularFormula || product.molecularFormula}</span>
                  </div>
                )}
                {chemistryData?.appearance && (
                  <div className="flex justify-between border-b border-neutral-200 pb-3">
                    <span className="text-neutral-500">{t('shop.appearance') || 'Appearance'}</span>
                    <span className="font-medium">{chemistryData.appearance}</span>
                  </div>
                )}
                {chemistryData?.solubility && (
                  <div className="flex justify-between border-b border-neutral-200 pb-3">
                    <span className="text-neutral-500">{t('shop.solubility') || 'Solubility'}</span>
                    <span className="font-medium text-sm">{chemistryData.solubility}</span>
                  </div>
                )}
              </div>

              {/* Amino Acid Sequence */}
              {chemistryData?.sequence && (
                <div className="mb-6">
                  <h4 className="font-medium text-neutral-700 mb-2">{t('shop.sequence') || 'Amino Acid Sequence'}</h4>
                  <code className="block bg-white p-3 rounded-lg border font-mono text-sm text-neutral-600 break-all">
                    {chemistryData.sequence}
                  </code>
                </div>
              )}

              {/* Synonyms */}
              {chemistryData?.synonyms && chemistryData.synonyms.length > 0 && (
                <div className="mb-6">
                  <h4 className="font-medium text-neutral-700 mb-2">{t('shop.synonyms') || 'Also Known As'}</h4>
                  <div className="flex flex-wrap gap-2">
                    {chemistryData.synonyms.map((syn, i) => (
                      <span key={i} className="px-3 py-1 bg-white rounded-full text-sm text-neutral-600 border">
                        {syn}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Storage Conditions */}
              {chemistryData?.storage && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <h4 className="font-semibold text-blue-800 mb-2 flex items-center gap-2">
                    <span>❄️</span> {t('shop.storageInstructions') || 'Storage Instructions'}
                  </h4>
                  <ul className="text-sm text-blue-700 space-y-1">
                    <li><strong>Lyophilized:</strong> {chemistryData.storage.lyophilized}</li>
                    <li><strong>Reconstituted:</strong> {chemistryData.storage.reconstituted}</li>
                  </ul>
                </div>
              )}

              {product.specifications && (
                <div className="mt-6">
                  <h4 className="font-medium text-neutral-700 mb-2">{t('shop.additionalSpecs') || 'Additional Specifications'}</h4>
                  <pre className="whitespace-pre-wrap text-sm text-neutral-600 bg-white p-4 rounded-lg border">
                    {product.specifications}
                  </pre>
                </div>
              )}
            </div>
          )}

          {/* Research Tab */}
          {activeTab === 'research' && chemistryData?.researchSummary && (
            <div className="bg-neutral-50 rounded-lg p-6">
              <div className="flex items-center gap-3 mb-4">
                <span className="w-10 h-10 bg-orange-100 rounded-full flex items-center justify-center text-xl">🔬</span>
                <h3 className="font-bold text-xl">{t('shop.researchOverview') || 'Research Overview'}</h3>
              </div>
              
              <div className="prose max-w-none mb-6">
                {chemistryData.researchSummary.split('\n').map((p, i) => (
                  <p key={i} className="mb-3 text-neutral-700 leading-relaxed">{p}</p>
                ))}
              </div>

              {chemistryData.mechanism && (
                <div className="bg-white border rounded-lg p-4 mb-6">
                  <h4 className="font-semibold text-neutral-800 mb-2">{t('shop.mechanism') || 'Mechanism of Action'}</h4>
                  <p className="text-neutral-600 text-sm">{chemistryData.mechanism}</p>
                </div>
              )}

              {chemistryData.references && chemistryData.references.length > 0 && (
                <div>
                  <h4 className="font-semibold text-neutral-800 mb-3">{t('shop.references') || 'Scientific References'}</h4>
                  <ul className="space-y-2">
                    {chemistryData.references.map((ref, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm">
                        <span className="text-orange-500 mt-1">📄</span>
                        <span className="text-neutral-600">
                          {ref.title}
                          {ref.pubmedId && (
                            <a 
                              href={`https://pubmed.ncbi.nlm.nih.gov/${ref.pubmedId}/`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="ml-2 text-blue-600 hover:underline"
                            >
                              [PubMed: {ref.pubmedId}]
                            </a>
                          )}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="mt-6 p-4 bg-amber-50 border border-amber-200 rounded-lg">
                <p className="text-xs text-amber-700">
                  <strong>Note:</strong> This information is for educational purposes only. All products are sold for research use only and are not intended for human consumption.
                </p>
              </div>
            </div>
          )}

          {/* Reconstitution Tab */}
          {activeTab === 'reconstitution' && chemistryData?.reconstitution && (
            <div className="bg-neutral-50 rounded-lg p-6">
              <div className="flex items-center gap-3 mb-4">
                <span className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center text-xl">💉</span>
                <h3 className="font-bold text-xl">{t('shop.reconstitutionGuide') || 'Reconstitution Guide'}</h3>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                <div className="bg-white rounded-lg p-4 border">
                  <p className="text-sm text-neutral-500 mb-1">{t('shop.recommendedSolvent') || 'Recommended Solvent'}</p>
                  <p className="font-semibold text-neutral-800">{chemistryData.reconstitution.solvent}</p>
                </div>
                <div className="bg-white rounded-lg p-4 border">
                  <p className="text-sm text-neutral-500 mb-1">{t('shop.recommendedVolume') || 'Recommended Volume'}</p>
                  <p className="font-semibold text-neutral-800">{chemistryData.reconstitution.volume}</p>
                </div>
                <div className="bg-white rounded-lg p-4 border">
                  <p className="text-sm text-neutral-500 mb-1">{t('shop.stability') || 'Stability After Reconstitution'}</p>
                  <p className="font-semibold text-neutral-800">{chemistryData.storage?.reconstituted.split('for ')[1] || '14-30 days at 2-8°C'}</p>
                </div>
              </div>

              <div className="bg-white rounded-lg p-4 border mb-6">
                <h4 className="font-semibold text-neutral-800 mb-3">{t('shop.reconstitutionSteps') || 'Step-by-Step Instructions'}</h4>
                <ol className="space-y-3 text-sm text-neutral-600">
                  <li className="flex items-start gap-3">
                    <span className="w-6 h-6 bg-orange-500 text-white rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0">1</span>
                    <span>Allow the vial to reach room temperature before reconstitution.</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="w-6 h-6 bg-orange-500 text-white rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0">2</span>
                    <span>Wipe the rubber stopper with an alcohol swab and let it dry.</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="w-6 h-6 bg-orange-500 text-white rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0">3</span>
                    <span>Draw {chemistryData.reconstitution.volume} of {chemistryData.reconstitution.solvent} into a sterile syringe.</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="w-6 h-6 bg-orange-500 text-white rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0">4</span>
                    <span>Insert needle through stopper and <strong>slowly</strong> release water along the inside wall of the vial.</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="w-6 h-6 bg-orange-500 text-white rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0">5</span>
                    <span>Do NOT shake. Gently swirl or let sit until fully dissolved.</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="w-6 h-6 bg-orange-500 text-white rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0">6</span>
                    <span>Store reconstituted peptide in refrigerator (2-8°C).</span>
                  </li>
                </ol>
              </div>

              {chemistryData.reconstitution.notes && (
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
                  <h4 className="font-semibold text-yellow-800 mb-2 flex items-center gap-2">
                    <span>⚠️</span> {t('shop.importantNotes') || 'Important Notes'}
                  </h4>
                  <p className="text-sm text-yellow-700">{chemistryData.reconstitution.notes}</p>
                </div>
              )}

              {/* Calculator Link */}
              <div className="bg-orange-50 border border-orange-200 rounded-lg p-4 text-center">
                <p className="text-sm text-orange-700 mb-3">
                  Need help calculating your reconstitution? Use our peptide calculator.
                </p>
                <Link
                  href="/#calculator"
                  className="inline-flex items-center gap-2 px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors text-sm font-medium"
                >
                  🧮 Open Peptide Calculator
                </Link>
              </div>
            </div>
          )}
        </div>

        {/* Related Products */}
        {product.relatedProducts.length > 0 && (
          <div className="mt-12 border-t pt-8">
            <h2 className="text-2xl font-bold mb-6">{t('shop.relatedProducts')}</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {product.relatedProducts.map((related) => (
                <Link
                  key={related.id}
                  href={`/product/${related.slug}`}
                  className="bg-white border rounded-lg overflow-hidden hover:shadow-lg transition-shadow group"
                >
                  <div className="aspect-square bg-neutral-100 relative">
                    <Image
                      src="/images/products/peptide-default.png"
                      alt={getRelatedProductName(related)}
                      fill
                      className="object-cover group-hover:scale-105 transition-transform"
                    />
                  </div>
                  <div className="p-3">
                    <h3 className="font-medium text-sm text-black group-hover:text-orange-600 transition-colors">
                      {getRelatedProductName(related)}
                    </h3>
                    {related.purity && (
                      <p className="text-xs text-neutral-500">{t('shop.purity')} {related.purity}%</p>
                    )}
                    <p className="text-orange-600 font-bold mt-1">{formatPrice(related.price)}</p>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* Reviews Section */}
        <div className="mt-12 border-t pt-8">
          <ProductReviews productId={product.id} productName={product.name} />
        </div>

        {/* Q&A Section */}
        <div className="mt-12 border-t pt-8">
          <ProductQA productId={product.id} productName={product.name} />
        </div>

        {/* Disclaimer */}
        <div className="mt-12 p-4 bg-amber-50 border border-amber-200 rounded-lg">
          <p className="text-sm text-amber-800">
            <strong className="text-amber-900">{t('disclaimer.title').toUpperCase()}:</strong>{' '}
            {t('disclaimer.text')} {t('disclaimer.notForConsumption')}
          </p>
        </div>
      </div>
    </div>
  );
}
