/**
 * Social Commerce — Platform feed generators
 *
 * Generates product feeds in the required format for each social commerce platform:
 * - Google Merchant Center (XML / RSS 2.0 with g: namespace)
 * - Facebook / Meta Commerce Manager (JSON batch feed)
 * - TikTok Shop (JSON product feed)
 * - Instagram Shop (shares Facebook feed)
 *
 * Each generator reads products from the DB, formats per platform spec,
 * and returns the serialized feed ready for HTTP response.
 * All feeds are tenant-scoped via the Prisma multi-tenant middleware.
 */

import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';

// ---------------------------------------------------------------------------
// Shared types
// ---------------------------------------------------------------------------

interface FeedProduct {
  id: string;
  name: string;
  slug: string;
  description: string;
  shortDescription: string | null;
  price: number;
  compareAtPrice: number | null;
  imageUrl: string | null;
  images: { url: string; alt: string | null; sortOrder: number }[];
  categoryName: string;
  categorySlug: string;
  sku: string | null;
  barcode: string | null;
  brand: string;
  availability: 'in_stock' | 'out_of_stock' | 'preorder';
  weight: number | null;
  isActive: boolean;
  options: {
    id: string;
    name: string;
    price: number;
    sku: string | null;
    barcode: string | null;
    availability: string;
    stockQuantity: number;
  }[];
}

export interface FeedGeneratorOptions {
  /** Base URL of the storefront, e.g. https://attitudes.vip */
  baseUrl: string;
  /** Store / brand name */
  storeName: string;
  /** ISO 4217 currency code */
  currency: string;
  /** Tenant ID (injected automatically by Prisma middleware, but useful for logging) */
  tenantId?: string;
}

// ---------------------------------------------------------------------------
// Data loader (shared across generators)
// ---------------------------------------------------------------------------

async function loadFeedProducts(): Promise<FeedProduct[]> {
  const products = await prisma.product.findMany({
    where: { isActive: true },
    take: 10_000, // override default 200 limit for feeds
    select: {
      id: true,
      name: true,
      slug: true,
      description: true,
      shortDescription: true,
      price: true,
      compareAtPrice: true,
      imageUrl: true,
      sku: true,
      barcode: true,
      manufacturer: true,
      weight: true,
      isActive: true,
      stockQuantity: true,
      trackInventory: true,
      allowBackorder: true,
      category: {
        select: { name: true, slug: true },
      },
      images: {
        select: { url: true, alt: true, sortOrder: true },
        orderBy: { sortOrder: 'asc' },
        take: 10,
      },
      options: {
        where: { isActive: true },
        select: {
          id: true,
          name: true,
          price: true,
          sku: true,
          barcode: true,
          availability: true,
          stockQuantity: true,
        },
        orderBy: { sortOrder: 'asc' },
      },
    },
    orderBy: { updatedAt: 'desc' },
  });

  return products.map((p) => {
    const inStock = p.trackInventory
      ? p.stockQuantity > 0 || p.allowBackorder
      : true;

    return {
      id: p.id,
      name: p.name,
      slug: p.slug,
      description: stripHtml(p.description ?? p.shortDescription ?? p.name),
      shortDescription: p.shortDescription,
      price: Number(p.price),
      compareAtPrice: p.compareAtPrice ? Number(p.compareAtPrice) : null,
      imageUrl: p.imageUrl,
      images: p.images.map((img) => ({
        url: img.url,
        alt: img.alt,
        sortOrder: img.sortOrder,
      })),
      categoryName: p.category?.name ?? 'Uncategorized',
      categorySlug: p.category?.slug ?? '',
      sku: p.sku,
      barcode: p.barcode,
      brand: p.manufacturer ?? 'Attitudes VIP',
      availability: inStock ? 'in_stock' : 'out_of_stock',
      weight: p.weight ? Number(p.weight) : null,
      isActive: p.isActive,
      options: p.options.map((o) => ({
        id: o.id,
        name: o.name,
        price: Number(o.price),
        sku: o.sku,
        barcode: o.barcode,
        availability: o.availability,
        stockQuantity: o.stockQuantity,
      })),
    };
  });
}

/** Strip HTML tags for feed descriptions */
function stripHtml(html: string): string {
  return html
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, ' ')
    .trim();
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function resolveImageUrl(url: string | null, baseUrl: string): string {
  if (!url) return `${baseUrl}/images/placeholder-product.png`;
  if (url.startsWith('http')) return url;
  return `${baseUrl}${url.startsWith('/') ? '' : '/'}${url}`;
}

// ---------------------------------------------------------------------------
// Google Merchant Center XML feed (RSS 2.0 + g: namespace)
// ---------------------------------------------------------------------------

export async function generateGoogleFeed(opts: FeedGeneratorOptions): Promise<string> {
  const products = await loadFeedProducts();
  logger.info(`[SocialCommerce] Generating Google feed for ${products.length} products`);

  const items = products.map((p) => {
    const productUrl = `${opts.baseUrl}/products/${p.slug}`;
    const imageUrl = resolveImageUrl(p.imageUrl, opts.baseUrl);
    const additionalImages = p.images
      .filter((img) => img.url !== p.imageUrl)
      .slice(0, 9) // Google allows up to 10 additional images
      .map((img) => `    <g:additional_image_link>${escapeXml(resolveImageUrl(img.url, opts.baseUrl))}</g:additional_image_link>`)
      .join('\n');

    const salePrice = p.compareAtPrice && p.compareAtPrice > p.price
      ? `    <g:sale_price>${p.price.toFixed(2)} ${opts.currency}</g:sale_price>\n`
      : '';
    const regularPrice = p.compareAtPrice && p.compareAtPrice > p.price
      ? p.compareAtPrice.toFixed(2)
      : p.price.toFixed(2);

    const weight = p.weight
      ? `    <g:shipping_weight>${p.weight} kg</g:shipping_weight>\n`
      : '';

    const gtin = p.barcode
      ? `    <g:gtin>${escapeXml(p.barcode)}</g:gtin>\n`
      : '';

    const mpn = p.sku
      ? `    <g:mpn>${escapeXml(p.sku)}</g:mpn>\n`
      : '';

    return `  <item>
    <g:id>${escapeXml(p.id)}</g:id>
    <g:title>${escapeXml(p.name)}</g:title>
    <g:description>${escapeXml(p.description.slice(0, 5000))}</g:description>
    <g:link>${escapeXml(productUrl)}</g:link>
    <g:image_link>${escapeXml(imageUrl)}</g:image_link>
${additionalImages ? additionalImages + '\n' : ''}    <g:availability>${p.availability.replace('_', ' ')}</g:availability>
    <g:price>${regularPrice} ${opts.currency}</g:price>
${salePrice}    <g:brand>${escapeXml(p.brand)}</g:brand>
    <g:condition>new</g:condition>
    <g:product_type>${escapeXml(p.categoryName)}</g:product_type>
${gtin}${mpn}${weight}    <g:identifier_exists>${p.barcode || p.sku ? 'true' : 'false'}</g:identifier_exists>
  </item>`;
  });

  return `<?xml version="1.0" encoding="UTF-8"?>
<rss xmlns:g="http://base.google.com/ns/1.0" version="2.0">
  <channel>
    <title>${escapeXml(opts.storeName)}</title>
    <link>${escapeXml(opts.baseUrl)}</link>
    <description>Product feed for ${escapeXml(opts.storeName)}</description>
${items.join('\n')}
  </channel>
</rss>`;
}

// ---------------------------------------------------------------------------
// Facebook / Meta Commerce JSON feed
// ---------------------------------------------------------------------------

interface MetaProduct {
  id: string;
  title: string;
  description: string;
  availability: string;
  condition: string;
  price: string;
  sale_price?: string;
  link: string;
  image_link: string;
  additional_image_link?: string[];
  brand: string;
  google_product_category?: string;
  product_type?: string;
  gtin?: string;
  mpn?: string;
  item_group_id?: string;
}

export async function generateFacebookFeed(opts: FeedGeneratorOptions): Promise<MetaProduct[]> {
  const products = await loadFeedProducts();
  logger.info(`[SocialCommerce] Generating Facebook/Meta feed for ${products.length} products`);

  return products.map((p) => {
    const productUrl = `${opts.baseUrl}/products/${p.slug}`;
    const imageUrl = resolveImageUrl(p.imageUrl, opts.baseUrl);
    const additionalImages = p.images
      .filter((img) => img.url !== p.imageUrl)
      .slice(0, 9)
      .map((img) => resolveImageUrl(img.url, opts.baseUrl));

    const metaAvailability = p.availability === 'in_stock'
      ? 'in stock'
      : p.availability === 'preorder'
        ? 'preorder'
        : 'out of stock';

    const item: MetaProduct = {
      id: p.id,
      title: p.name.slice(0, 200),
      description: p.description.slice(0, 9999),
      availability: metaAvailability,
      condition: 'new',
      price: `${p.compareAtPrice && p.compareAtPrice > p.price ? p.compareAtPrice.toFixed(2) : p.price.toFixed(2)} ${opts.currency}`,
      link: productUrl,
      image_link: imageUrl,
      brand: p.brand,
      product_type: p.categoryName,
    };

    if (p.compareAtPrice && p.compareAtPrice > p.price) {
      item.sale_price = `${p.price.toFixed(2)} ${opts.currency}`;
    }

    if (additionalImages.length > 0) {
      item.additional_image_link = additionalImages;
    }

    if (p.barcode) item.gtin = p.barcode;
    if (p.sku) item.mpn = p.sku;

    // If product has variants, set item_group_id so Meta groups them
    if (p.options.length > 1) {
      item.item_group_id = p.id;
    }

    return item;
  });
}

// ---------------------------------------------------------------------------
// TikTok Shop JSON feed
// ---------------------------------------------------------------------------

interface TikTokProduct {
  sku_id: string;
  product_name: string;
  description: string;
  category_name: string;
  brand_name: string;
  main_images: string[];
  sale_price: number;
  original_price?: number;
  currency: string;
  stock_infos: { available_stock: number; warehouse_id: string }[];
  product_url: string;
  condition: string;
  availability: string;
  identifiers?: { gtin?: string; mpn?: string };
}

export async function generateTikTokFeed(opts: FeedGeneratorOptions): Promise<TikTokProduct[]> {
  const products = await loadFeedProducts();
  logger.info(`[SocialCommerce] Generating TikTok feed for ${products.length} products`);

  return products.map((p) => {
    const productUrl = `${opts.baseUrl}/products/${p.slug}`;
    const images = p.images.length > 0
      ? p.images.map((img) => resolveImageUrl(img.url, opts.baseUrl))
      : [resolveImageUrl(p.imageUrl, opts.baseUrl)];

    const totalStock = p.options.reduce((sum, o) => sum + o.stockQuantity, 0);

    const item: TikTokProduct = {
      sku_id: p.sku || p.id,
      product_name: p.name.slice(0, 255),
      description: p.description.slice(0, 10000),
      category_name: p.categoryName,
      brand_name: p.brand,
      main_images: images.slice(0, 9),
      sale_price: p.price,
      currency: opts.currency,
      stock_infos: [{ available_stock: Math.max(totalStock, 0), warehouse_id: 'default' }],
      product_url: productUrl,
      condition: 'new',
      availability: p.availability === 'in_stock' ? 'IN_STOCK' : 'OUT_OF_STOCK',
    };

    if (p.compareAtPrice && p.compareAtPrice > p.price) {
      item.original_price = p.compareAtPrice;
    }

    if (p.barcode || p.sku) {
      item.identifiers = {};
      if (p.barcode) item.identifiers.gtin = p.barcode;
      if (p.sku) item.identifiers.mpn = p.sku;
    }

    return item;
  });
}

// ---------------------------------------------------------------------------
// Feed stats (for admin dashboard)
// ---------------------------------------------------------------------------

export interface FeedStats {
  totalProducts: number;
  activeProducts: number;
  inStockProducts: number;
  outOfStockProducts: number;
  withImages: number;
  withBarcode: number;
  withSku: number;
  lastGenerated: string | null;
}

export async function getFeedStats(): Promise<FeedStats> {
  const products = await loadFeedProducts();

  return {
    totalProducts: products.length,
    activeProducts: products.filter((p) => p.isActive).length,
    inStockProducts: products.filter((p) => p.availability === 'in_stock').length,
    outOfStockProducts: products.filter((p) => p.availability === 'out_of_stock').length,
    withImages: products.filter((p) => p.imageUrl || p.images.length > 0).length,
    withBarcode: products.filter((p) => p.barcode).length,
    withSku: products.filter((p) => p.sku).length,
    lastGenerated: new Date().toISOString(),
  };
}
