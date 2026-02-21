const SITE_URL = 'https://biocyclepeptides.com';
const SITE_NAME = 'BioCycle Peptides';
const DEFAULT_LOGO = `${SITE_URL}/images/logo.png`;

export function organizationSchema() {
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: SITE_NAME,
    url: SITE_URL,
    logo: DEFAULT_LOGO,
    description:
      "Canada's trusted source for premium research peptides. Lab-tested, 99%+ purity, fast shipping.",
    address: {
      '@type': 'PostalAddress',
      addressCountry: 'CA',
    },
    contactPoint: {
      '@type': 'ContactPoint',
      contactType: 'customer service',
      url: `${SITE_URL}/contact`,
      availableLanguage: ['English', 'French'],
    },
    // sameAs omitted until social profiles are configured
  };
}

export function websiteSchema() {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: SITE_NAME,
    url: SITE_URL,
    potentialAction: {
      '@type': 'SearchAction',
      target: {
        '@type': 'EntryPoint',
        urlTemplate: `${SITE_URL}/shop?q={search_term_string}`,
      },
      'query-input': 'required name=search_term_string',
    },
  };
}

interface ProductSchemaInput {
  name: string;
  description: string;
  slug: string;
  image?: string;
  images?: { url: string }[];
  price: number;
  purity?: number;
  sku?: string;
  inStock?: boolean;
  categoryName?: string;
  reviewCount?: number;
  ratingValue?: number;
}

export function productSchema(product: ProductSchemaInput) {
  const imageUrls: string[] = [];
  if (product.images && product.images.length > 0) {
    for (const img of product.images) {
      imageUrls.push(img.url.startsWith('http') ? img.url : `${SITE_URL}${img.url}`);
    }
  } else if (product.image) {
    imageUrls.push(product.image.startsWith('http') ? product.image : `${SITE_URL}${product.image}`);
  }

  const schema: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: product.name,
    description: product.description,
    url: `${SITE_URL}/product/${product.slug}`,
    image: imageUrls.length > 0 ? imageUrls : undefined,
    brand: {
      '@type': 'Brand',
      name: SITE_NAME,
    },
    offers: {
      '@type': 'Offer',
      price: product.price.toFixed(2),
      priceCurrency: 'CAD',
      availability: product.inStock !== false
        ? 'https://schema.org/InStock'
        : 'https://schema.org/OutOfStock',
      seller: {
        '@type': 'Organization',
        name: SITE_NAME,
      },
      url: `${SITE_URL}/product/${product.slug}`,
    },
  };

  if (product.sku) {
    schema.sku = product.sku;
  }

  if (product.categoryName) {
    schema.category = product.categoryName;
  }

  if (product.reviewCount && product.reviewCount > 0 && product.ratingValue) {
    schema.aggregateRating = {
      '@type': 'AggregateRating',
      ratingValue: product.ratingValue.toFixed(1),
      reviewCount: product.reviewCount,
      bestRating: '5',
      worstRating: '1',
    };
  }

  return schema;
}

interface BreadcrumbItem {
  name: string;
  url: string;
}

export function breadcrumbSchema(items: BreadcrumbItem[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      item: item.url.startsWith('http') ? item.url : `${SITE_URL}${item.url}`,
    })),
  };
}

interface FaqItem {
  question: string;
  answer: string;
}

export function faqSchema(items: FaqItem[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: items.map((item) => ({
      '@type': 'Question',
      name: item.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: item.answer,
      },
    })),
  };
}

interface ArticleSchemaInput {
  headline: string;
  description: string;
  slug: string;
  image?: string;
  datePublished?: string;
  dateModified?: string;
  author?: string;
}

export function articleSchema(article: ArticleSchemaInput) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: article.headline,
    description: article.description,
    url: `${SITE_URL}/learn/${article.slug}`,
    image: article.image
      ? article.image.startsWith('http')
        ? article.image
        : `${SITE_URL}${article.image}`
      : undefined,
    datePublished: article.datePublished,
    dateModified: article.dateModified || article.datePublished,
    author: {
      '@type': 'Organization',
      name: article.author || SITE_NAME,
    },
    publisher: {
      '@type': 'Organization',
      name: SITE_NAME,
      logo: {
        '@type': 'ImageObject',
        url: DEFAULT_LOGO,
      },
    },
  };
}
