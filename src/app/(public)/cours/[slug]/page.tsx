export const dynamic = 'force-dynamic';
/**
 * PAGE DÉTAIL COURS
 * Description complète, modules, avis, CTA achat
 */

import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import DOMPurify from 'isomorphic-dompurify';
import { prisma } from '@/lib/db';
import { auth } from '@/lib/auth-config';
import { getApiTranslator } from '@/i18n/server';

interface CoursePageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: CoursePageProps): Promise<Metadata> {
  const { slug } = await params;
  const product = await prisma.product.findUnique({
    where: { slug, isActive: true },
    select: { name: true, shortDescription: true },
  });

  return {
    title: product?.name ?? 'Course',
    description: product?.shortDescription
      ? String(product.shortDescription).slice(0, 160)
      : 'Browse course details, modules, and reviews on BioCycle Peptides.',
  };
}

async function getProduct(slug: string) {
  return prisma.product.findUnique({
    where: { slug, isActive: true },
    include: {
      category: true,
      modules: {
        orderBy: { sortOrder: 'asc' },
      },
    },
  });
}

export default async function CoursePage({ params }: CoursePageProps) {
  const { slug } = await params;
  const product = await getProduct(slug);
  const session = await auth();
  const { t } = await getApiTranslator();

  if (!product) {
    notFound();
  }

  // Vérifier si l'utilisateur a déjà accès
  let hasAccess = false;
  if (session?.user) {
    const access = await prisma.courseAccess.findUnique({
      where: {
        userId_productId: {
          userId: session.user.id,
          productId: product.id,
        },
      },
    });
    hasAccess = !!access;
  }

  const hasDiscount = product.compareAtPrice && Number(product.compareAtPrice) > Number(product.price);
  const discountPercent = hasDiscount
    ? Math.round((1 - Number(product.price) / Number(product.compareAtPrice)) * 100)
    : 0;

  const formatDuration = (minutes: number | null) => {
    if (!minutes) return null;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hours === 0) return `${mins} minutes`;
    if (mins === 0) return `${hours} heures`;
    return `${hours}h ${mins}min`;
  };

  const totalDuration = product.modules.reduce((acc, m) => acc + (m.duration || 0), 0);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Hero Section */}
      <section className="bg-gradient-to-br from-gray-900 to-gray-800 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <div>
              {/* Breadcrumb */}
              <nav className="flex items-center space-x-2 text-sm text-gray-400 mb-4">
                <Link href="/" className="hover:text-white">Accueil</Link>
                <span>/</span>
                <Link href="/catalogue" className="hover:text-white">Catalogue</Link>
                <span>/</span>
                <Link href={`/catalogue/${product.category?.slug}`} className="hover:text-white">
                  {product.category?.name}
                </Link>
              </nav>

              <h1 className="text-4xl font-bold mb-4">{product.name}</h1>
              
              <p className="text-xl text-gray-300 mb-6">
                {product.shortDescription}
              </p>

              {/* Métadonnées */}
              <div className="flex flex-wrap gap-4 mb-6">
                {totalDuration > 0 && (
                  <div className="flex items-center text-gray-300">
                    <svg className="w-5 h-5 me-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    {formatDuration(totalDuration)}
                  </div>
                )}
                <div className="flex items-center text-gray-300">
                  <svg className="w-5 h-5 me-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                  </svg>
                  {product.modules.length} modules
                </div>
                {product.averageRating && (
                  <div className="flex items-center text-yellow-400">
                    <svg className="w-5 h-5 me-1" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                    </svg>
                    {Number(product.averageRating).toFixed(1)} ({product.purchaseCount} avis)
                  </div>
                )}
              </div>

              {/* Prix */}
              <div className="flex items-baseline space-x-3 mb-6">
                <span className="text-4xl font-bold">
                  {Number(product.price).toFixed(2)} $
                </span>
                {hasDiscount && (
                  <>
                    <span className="text-xl text-gray-400 line-through">
                      {Number(product.compareAtPrice).toFixed(2)} $
                    </span>
                    <span className="px-2 py-1 bg-red-500 text-white text-sm font-semibold rounded">
                      -{discountPercent}%
                    </span>
                  </>
                )}
              </div>

              {/* CTA */}
              {hasAccess ? (
                <Link
                  href={`/cours/${product.slug}/learn`}
                  className="inline-flex items-center px-8 py-4 bg-green-600 text-white font-semibold rounded-lg hover:bg-green-700 transition-colors"
                >
                  <svg className="w-5 h-5 me-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  {t('order.tracking.accessCourse')}
                </Link>
              ) : (
                <Link
                  href={`/checkout/${product.slug}`}
                  className="inline-flex items-center px-8 py-4 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition-colors"
                >
                  {t('shop.buyCourse')}
                </Link>
              )}
            </div>

            {/* Image / Vidéo */}
            <div className="relative aspect-video rounded-xl overflow-hidden shadow-2xl">
              {product.videoUrl ? (
                <video
                  src={product.videoUrl}
                  poster={product.imageUrl || undefined}
                  controls
                  className="w-full h-full object-cover"
                />
              ) : product.imageUrl ? (
                <Image
                  src={product.imageUrl}
                  alt={product.name}
                  fill
                  sizes="(max-width: 768px) 100vw, 300px"
                  className="object-cover"
                />
              ) : (
                <div className="absolute inset-0 bg-gradient-to-br from-blue-600 to-blue-800 flex items-center justify-center">
                  <svg className="w-20 h-20 text-white/30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Contenu */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
          {/* Description & Modules */}
          <div className="lg:col-span-2">
            {/* Description */}
            <div className="bg-white rounded-xl p-8 border border-gray-200 mb-8">
              <h2 className="text-2xl font-bold text-gray-900 mb-4">
                À propos de cette formation
              </h2>
              <div
                className="prose max-w-none text-gray-600"
                dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(product.description || '', { ALLOWED_TAGS: ['p', 'br', 'strong', 'em', 'ul', 'ol', 'li', 'h2', 'h3', 'h4', 'a', 'span', 'blockquote'], ALLOWED_ATTR: ['href', 'target', 'rel', 'class'] }) }}
              />
            </div>

            {/* Modules */}
            <div className="bg-white rounded-xl border border-gray-200">
              <div className="p-6 border-b border-gray-200">
                <h2 className="text-2xl font-bold text-gray-900">
                  Contenu de la formation
                </h2>
                <p className="text-gray-600 mt-1">
                  {product.modules.length} modules • {formatDuration(totalDuration)}
                </p>
              </div>
              <div className="divide-y divide-gray-200">
                {product.modules.map((module, index) => (
                  <div key={module.id} className="p-4 hover:bg-gray-50">
                    <div className="flex items-start">
                      <span className="w-8 h-8 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-sm font-semibold flex-shrink-0">
                        {index + 1}
                      </span>
                      <div className="ms-4 flex-1">
                        <h3 className="font-semibold text-gray-900">{module.name}</h3>
                        {module.description && (
                          <p className="text-sm text-gray-600 mt-1">{module.description}</p>
                        )}
                      </div>
                      {module.duration && (
                        <span className="text-sm text-gray-500">
                          {formatDuration(module.duration)}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Sidebar */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-xl p-6 border border-gray-200 sticky top-24">
              <h3 className="font-semibold text-gray-900 mb-4">Cette formation inclut</h3>
              <ul className="space-y-3">
                <li className="flex items-center text-gray-600">
                  <svg className="w-5 h-5 text-green-500 me-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Accès à vie au contenu
                </li>
                <li className="flex items-center text-gray-600">
                  <svg className="w-5 h-5 text-green-500 me-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Certificat de complétion
                </li>
                <li className="flex items-center text-gray-600">
                  <svg className="w-5 h-5 text-green-500 me-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Support par email
                </li>
                <li className="flex items-center text-gray-600">
                  <svg className="w-5 h-5 text-green-500 me-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Mises à jour gratuites
                </li>
                <li className="flex items-center text-gray-600">
                  <svg className="w-5 h-5 text-green-500 me-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Garantie 30 jours
                </li>
              </ul>

              <hr className="my-6" />

              <div className="flex items-baseline justify-between mb-4">
                <span className="text-3xl font-bold text-gray-900">
                  {Number(product.price).toFixed(2)} $
                </span>
                {hasDiscount && (
                  <span className="text-gray-400 line-through">
                    {Number(product.compareAtPrice).toFixed(2)} $
                  </span>
                )}
              </div>

              {hasAccess ? (
                <Link
                  href={`/cours/${product.slug}/learn`}
                  className="w-full btn-primary py-3 text-center block"
                >
                  {t('order.tracking.accessCourse')}
                </Link>
              ) : (
                <Link
                  href={`/checkout/${product.slug}`}
                  className="w-full btn-primary py-3 text-center block"
                >
                  {t('shop.buyNow')}
                </Link>
              )}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
