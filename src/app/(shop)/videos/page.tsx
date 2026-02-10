'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useTranslations } from '@/hooks/useTranslations';

interface Video {
  id: string;
  title: string;
  description: string;
  thumbnail: string;
  duration: string;
  category: string;
  views: number;
  likes: number;
  youtubeId: string;
  featured: boolean;
  createdAt: string;
}

const getVideoCategories = (t: (key: string) => string) => [
  { id: 'all', name: t('videos.allVideos') || 'All Videos', icon: '📺' },
  { id: 'reconstitution', name: t('videos.reconstitution') || 'Reconstitution', icon: '💉' },
  { id: 'storage', name: t('videos.storageHandling') || 'Storage & Handling', icon: '❄️' },
  { id: 'calculator', name: t('videos.dosageCalculator') || 'Dosage Calculator', icon: '🧮' },
  { id: 'products', name: t('videos.productGuides') || 'Product Guides', icon: '📦' },
  { id: 'research', name: t('videos.researchUpdates') || 'Research Updates', icon: '🔬' },
];

const videos: Video[] = [
  {
    id: '1',
    title: 'How to Reconstitute Peptides: Complete Step-by-Step Guide',
    description: 'Learn the proper technique for reconstituting lyophilized peptides with bacteriostatic water. This comprehensive guide covers everything from calculating volumes to proper injection technique for research purposes.',
    thumbnail: '/images/videos/reconstitute-thumb.jpg',
    duration: '12:34',
    category: 'reconstitution',
    views: 45230,
    likes: 1823,
    youtubeId: 'dQw4w9WgXcQ',
    featured: true,
    createdAt: '2026-01-15T10:00:00Z',
  },
  {
    id: '2',
    title: 'Proper Peptide Storage: Maximize Shelf Life',
    description: 'Discover the best practices for storing both lyophilized and reconstituted peptides to maintain their potency and extend shelf life.',
    thumbnail: '/images/videos/storage-thumb.jpg',
    duration: '8:22',
    category: 'storage',
    views: 28450,
    likes: 1245,
    youtubeId: 'dQw4w9WgXcQ',
    featured: true,
    createdAt: '2026-01-10T10:00:00Z',
  },
  {
    id: '3',
    title: 'Using the Peptide Calculator: Quick Tutorial',
    description: 'A quick walkthrough of our online peptide calculator tool to help you determine the right reconstitution volumes and concentrations.',
    thumbnail: '/images/videos/calculator-thumb.jpg',
    duration: '5:15',
    category: 'calculator',
    views: 18920,
    likes: 892,
    youtubeId: 'dQw4w9WgXcQ',
    featured: false,
    createdAt: '2026-01-08T10:00:00Z',
  },
  {
    id: '4',
    title: 'BPC-157 Research Overview: What Scientists Know',
    description: 'An educational overview of BPC-157 research, covering the science behind this popular peptide and its areas of study.',
    thumbnail: '/images/videos/bpc157-thumb.jpg',
    duration: '15:42',
    category: 'research',
    views: 52100,
    likes: 2341,
    youtubeId: 'dQw4w9WgXcQ',
    featured: true,
    createdAt: '2026-01-05T10:00:00Z',
  },
  {
    id: '5',
    title: 'Understanding GLP-1 Agonists: Semaglutide & Tirzepatide',
    description: 'Deep dive into GLP-1 receptor agonists, their mechanisms, and why they have become such important research compounds.',
    thumbnail: '/images/videos/glp1-thumb.jpg',
    duration: '18:30',
    category: 'research',
    views: 67800,
    likes: 3102,
    youtubeId: 'dQw4w9WgXcQ',
    featured: true,
    createdAt: '2026-01-02T10:00:00Z',
  },
  {
    id: '6',
    title: 'Insulin Syringe Guide for Peptide Research',
    description: 'Everything you need to know about choosing and using insulin syringes for peptide research applications.',
    thumbnail: '/images/videos/syringes-thumb.jpg',
    duration: '7:45',
    category: 'products',
    views: 12340,
    likes: 567,
    youtubeId: 'dQw4w9WgXcQ',
    featured: false,
    createdAt: '2025-12-28T10:00:00Z',
  },
  {
    id: '7',
    title: 'TB-500 vs BPC-157: Research Comparison',
    description: 'Comparing two popular healing peptides - their mechanisms, research applications, and how they differ.',
    thumbnail: '/images/videos/comparison-thumb.jpg',
    duration: '14:20',
    category: 'research',
    views: 38900,
    likes: 1876,
    youtubeId: 'dQw4w9WgXcQ',
    featured: false,
    createdAt: '2025-12-20T10:00:00Z',
  },
  {
    id: '8',
    title: 'Cold Chain Shipping: How We Protect Your Order',
    description: 'Behind the scenes look at how we package and ship peptides to maintain their integrity during transit.',
    thumbnail: '/images/videos/shipping-thumb.jpg',
    duration: '6:18',
    category: 'storage',
    views: 8920,
    likes: 423,
    youtubeId: 'dQw4w9WgXcQ',
    featured: false,
    createdAt: '2025-12-15T10:00:00Z',
  },
];

export default function VideosPage() {
  const { t } = useTranslations();
  const videoCategories = getVideoCategories(t);
  const [activeCategory, setActiveCategory] = useState('all');
  const [playingVideo, setPlayingVideo] = useState<Video | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const filteredVideos = videos
    .filter(v => activeCategory === 'all' || v.category === activeCategory)
    .filter(v => 
      v.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      v.description.toLowerCase().includes(searchQuery.toLowerCase())
    );

  const featuredVideos = videos.filter(v => v.featured);

  const formatViews = (views: number) => {
    if (views >= 1000000) return `${(views / 1000000).toFixed(1)}M`;
    if (views >= 1000) return `${(views / 1000).toFixed(1)}K`;
    return views.toString();
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Hero */}
      <section className="bg-gradient-to-br from-neutral-900 via-neutral-800 to-black text-white py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3 mb-4">
            <span className="text-4xl">🎬</span>
            <h1 className="text-3xl md:text-4xl font-bold">
              {t('videos.title') || 'Video Tutorials'}
            </h1>
          </div>
          <p className="text-xl text-neutral-300 max-w-2xl">
            {t('videos.subtitle') || 'Learn everything about peptide handling, storage, and research with our comprehensive video library.'}
          </p>

          {/* Search */}
          <div className="relative mt-8 max-w-xl">
            <svg className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-neutral-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t('videos.searchPlaceholder') || 'Search videos...'}
              className="w-full pl-12 pr-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-neutral-400 focus:outline-none focus:ring-2 focus:ring-orange-500"
            />
          </div>
        </div>
      </section>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Featured Videos */}
        {!searchQuery && activeCategory === 'all' && (
          <section className="mb-12">
            <h2 className="text-xl font-bold mb-4">{t('videos.featured') || 'Featured Videos'}</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {featuredVideos.slice(0, 4).map((video) => (
                <div
                  key={video.id}
                  onClick={() => setPlayingVideo(video)}
                  className="bg-white rounded-xl overflow-hidden shadow-sm border border-neutral-200 hover:shadow-lg transition-shadow cursor-pointer group"
                >
                  <div className="relative aspect-video bg-neutral-200">
                    <div className="absolute inset-0 flex items-center justify-center bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity">
                      <div className="w-16 h-16 bg-orange-500 rounded-full flex items-center justify-center">
                        <svg className="w-8 h-8 text-white ml-1" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M8 5v14l11-7z" />
                        </svg>
                      </div>
                    </div>
                    <span className="absolute bottom-2 right-2 px-2 py-1 bg-black/80 text-white text-xs rounded">
                      {video.duration}
                    </span>
                    <span className="absolute top-2 left-2 px-2 py-1 bg-orange-500 text-white text-xs font-medium rounded">
                      Featured
                    </span>
                  </div>
                  <div className="p-4">
                    <h3 className="font-semibold line-clamp-2 group-hover:text-orange-600 transition-colors">
                      {video.title}
                    </h3>
                    <div className="flex items-center gap-3 mt-2 text-sm text-neutral-500">
                      <span>{formatViews(video.views)} views</span>
                      <span>•</span>
                      <span>{video.likes} likes</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Categories */}
        <div className="flex gap-2 overflow-x-auto pb-4 mb-6">
          {videoCategories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setActiveCategory(cat.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium whitespace-nowrap transition-colors ${
                activeCategory === cat.id
                  ? 'bg-orange-500 text-white'
                  : 'bg-white text-neutral-600 hover:bg-neutral-100 border border-neutral-200'
              }`}
            >
              <span>{cat.icon}</span>
              {cat.name}
            </button>
          ))}
        </div>

        {/* Video Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredVideos.map((video) => (
            <div
              key={video.id}
              onClick={() => setPlayingVideo(video)}
              className="bg-white rounded-xl overflow-hidden shadow-sm border border-neutral-200 hover:shadow-lg transition-shadow cursor-pointer group"
            >
              <div className="relative aspect-video bg-neutral-200">
                <div className="absolute inset-0 flex items-center justify-center bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity">
                  <div className="w-16 h-16 bg-orange-500 rounded-full flex items-center justify-center">
                    <svg className="w-8 h-8 text-white ml-1" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M8 5v14l11-7z" />
                    </svg>
                  </div>
                </div>
                <span className="absolute bottom-2 right-2 px-2 py-1 bg-black/80 text-white text-xs rounded">
                  {video.duration}
                </span>
              </div>
              <div className="p-4">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xs bg-neutral-100 text-neutral-600 px-2 py-1 rounded">
                    {videoCategories.find(c => c.id === video.category)?.name}
                  </span>
                </div>
                <h3 className="font-semibold line-clamp-2 group-hover:text-orange-600 transition-colors">
                  {video.title}
                </h3>
                <p className="text-sm text-neutral-500 mt-2 line-clamp-2">{video.description}</p>
                <div className="flex items-center gap-3 mt-3 text-sm text-neutral-500">
                  <span className="flex items-center gap-1">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                    {formatViews(video.views)}
                  </span>
                  <span className="flex items-center gap-1">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 10h4.764a2 2 0 011.789 2.894l-3.5 7A2 2 0 0115.263 21h-4.017c-.163 0-.326-.02-.485-.06L7 20m7-10V5a2 2 0 00-2-2h-.095c-.5 0-.905.405-.905.905 0 .714-.211 1.412-.608 2.006L7 11v9m7-10h-2M7 20H5a2 2 0 01-2-2v-6a2 2 0 012-2h2.5" />
                    </svg>
                    {video.likes}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>

        {filteredVideos.length === 0 && (
          <div className="text-center py-12">
            <span className="text-6xl mb-4 block">🔍</span>
            <h3 className="text-lg font-bold mb-2">{t('videos.noResults') || 'No videos found'}</h3>
            <p className="text-neutral-500">{t('videos.tryDifferent') || 'Try a different search or category'}</p>
          </div>
        )}

        {/* Quick Links */}
        <div className="mt-12 bg-white rounded-xl shadow-sm border border-neutral-200 p-6">
          <h3 className="text-lg font-bold mb-4">{t('videos.quickLinks') || 'Quick Links'}</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Link href="/learn" className="flex items-center gap-3 p-4 bg-neutral-50 rounded-lg hover:bg-neutral-100 transition-colors">
              <span className="text-2xl">📚</span>
              <span className="font-medium">{t('videos.learningCenter') || 'Learning Center'}</span>
            </Link>
            <Link href="/faq" className="flex items-center gap-3 p-4 bg-neutral-50 rounded-lg hover:bg-neutral-100 transition-colors">
              <span className="text-2xl">❓</span>
              <span className="font-medium">{t('videos.faq') || 'FAQ'}</span>
            </Link>
            <Link href="/#calculator" className="flex items-center gap-3 p-4 bg-neutral-50 rounded-lg hover:bg-neutral-100 transition-colors">
              <span className="text-2xl">🧮</span>
              <span className="font-medium">{t('videos.calculator') || 'Calculator'}</span>
            </Link>
            <Link href="/lab-results" className="flex items-center gap-3 p-4 bg-neutral-50 rounded-lg hover:bg-neutral-100 transition-colors">
              <span className="text-2xl">🔬</span>
              <span className="font-medium">{t('videos.labResults') || 'Lab Results'}</span>
            </Link>
          </div>
        </div>
      </div>

      {/* Video Player Modal */}
      {playingVideo && (
        <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-50 p-4">
          <div className="w-full max-w-4xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-white font-bold text-xl">{playingVideo.title}</h3>
              <button
                onClick={() => setPlayingVideo(null)}
                className="p-2 text-white hover:bg-white/10 rounded-lg"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="relative aspect-video bg-black rounded-xl overflow-hidden">
              <iframe
                src={`https://www.youtube.com/embed/${playingVideo.youtubeId}?autoplay=1`}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                className="absolute inset-0 w-full h-full"
              />
            </div>
            <div className="mt-4 text-white">
              <p className="text-neutral-300">{playingVideo.description}</p>
              <div className="flex items-center gap-4 mt-3 text-sm text-neutral-400">
                <span>{formatViews(playingVideo.views)} views</span>
                <span>•</span>
                <span>{playingVideo.likes} likes</span>
                <span>•</span>
                <span>{new Date(playingVideo.createdAt).toLocaleDateString('en-CA', { year: 'numeric', month: 'long', day: 'numeric' })}</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
