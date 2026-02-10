import { MetadataRoute } from 'next';
import { products } from '@/data/products';

const BASE_URL = 'https://biocyclepeptides.com';

export default function sitemap(): MetadataRoute.Sitemap {
  // Static pages
  const staticPages = [
    '',
    '/shop',
    '/contact',
    '/faq',
    '/rewards',
    '/subscriptions',
    '/a-propos',
    '/mentions-legales/confidentialite',
    '/mentions-legales/conditions',
    '/refund-policy',
    '/shipping-policy',
    '/auth/signin',
    '/auth/signup',
  ];

  const staticEntries: MetadataRoute.Sitemap = staticPages.map((path) => ({
    url: `${BASE_URL}${path}`,
    lastModified: new Date(),
    changeFrequency: path === '' ? 'daily' : 'weekly',
    priority: path === '' ? 1 : path === '/shop' ? 0.9 : 0.7,
  }));

  // Product pages
  const productEntries: MetadataRoute.Sitemap = products.map((product) => ({
    url: `${BASE_URL}/product/${product.slug}`,
    lastModified: new Date(),
    changeFrequency: 'weekly',
    priority: 0.8,
  }));

  // Category pages
  const categories = ['peptides', 'supplements', 'accessories'];
  const categoryEntries: MetadataRoute.Sitemap = categories.map((cat) => ({
    url: `${BASE_URL}/category/${cat}`,
    lastModified: new Date(),
    changeFrequency: 'weekly',
    priority: 0.8,
  }));

  return [...staticEntries, ...productEntries, ...categoryEntries];
}
