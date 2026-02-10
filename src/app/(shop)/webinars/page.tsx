'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { useTranslations } from '@/hooks/useTranslations';

interface Webinar {
  id: string;
  title: string;
  description: string;
  speaker: {
    name: string;
    title: string;
    avatar?: string;
  };
  date: string;
  time: string;
  duration: string;
  category: string;
  status: 'upcoming' | 'live' | 'recorded';
  registrations: number;
  maxAttendees?: number;
  thumbnail: string;
  tags: string[];
  recordingUrl?: string;
}

const webinars: Webinar[] = [
  {
    id: '1',
    title: 'Introduction to Peptide Research: A Beginner\'s Guide',
    description: 'Join us for a comprehensive introduction to peptide research. We will cover the basics of peptide structure, common research applications, and best practices for handling and storage.',
    speaker: {
      name: 'Dr. Sarah Chen',
      title: 'Research Director',
    },
    date: '2026-02-15',
    time: '2:00 PM EST',
    duration: '60 min',
    category: 'Education',
    status: 'upcoming',
    registrations: 245,
    maxAttendees: 500,
    thumbnail: '/images/webinars/intro-peptides.jpg',
    tags: ['beginner', 'education', 'fundamentals'],
  },
  {
    id: '2',
    title: 'GLP-1 Agonists Deep Dive: Semaglutide & Beyond',
    description: 'An in-depth look at GLP-1 receptor agonists, their mechanisms of action, and the latest research findings. Perfect for researchers working with metabolic compounds.',
    speaker: {
      name: 'Dr. Michael Roberts',
      title: 'Metabolic Research Specialist',
    },
    date: '2026-02-22',
    time: '1:00 PM EST',
    duration: '90 min',
    category: 'Research',
    status: 'upcoming',
    registrations: 312,
    maxAttendees: 400,
    thumbnail: '/images/webinars/glp1-deep-dive.jpg',
    tags: ['glp-1', 'semaglutide', 'advanced'],
  },
  {
    id: '3',
    title: 'Lab Best Practices: Quality Control & Documentation',
    description: 'Learn how to maintain proper documentation, quality control measures, and compliance standards in your peptide research lab.',
    speaker: {
      name: 'Jennifer Martinez, PhD',
      title: 'Quality Assurance Manager',
    },
    date: '2026-03-01',
    time: '11:00 AM EST',
    duration: '75 min',
    category: 'Best Practices',
    status: 'upcoming',
    registrations: 178,
    maxAttendees: 300,
    thumbnail: '/images/webinars/lab-practices.jpg',
    tags: ['quality', 'documentation', 'compliance'],
  },
  {
    id: '4',
    title: 'Reconstitution Masterclass: Hands-On Techniques',
    description: 'A practical, hands-on webinar demonstrating proper peptide reconstitution techniques with live demonstrations and Q&A.',
    speaker: {
      name: 'Peptide Plus+ Lab Team',
      title: 'Technical Specialists',
    },
    date: '2026-01-28',
    time: '3:00 PM EST',
    duration: '45 min',
    category: 'Tutorial',
    status: 'live',
    registrations: 523,
    thumbnail: '/images/webinars/reconstitution.jpg',
    tags: ['reconstitution', 'hands-on', 'tutorial'],
  },
  {
    id: '5',
    title: 'BPC-157 Research Update: 2025 Year in Review',
    description: 'A comprehensive review of the most significant BPC-157 research published in 2025, with analysis and implications for ongoing studies.',
    speaker: {
      name: 'Dr. James Wilson',
      title: 'Research Scientist',
    },
    date: '2026-01-10',
    time: '2:00 PM EST',
    duration: '60 min',
    category: 'Research',
    status: 'recorded',
    registrations: 892,
    thumbnail: '/images/webinars/bpc157-review.jpg',
    tags: ['bpc-157', 'research', 'review'],
    recordingUrl: '/webinars/recordings/bpc157-2025-review',
  },
  {
    id: '6',
    title: 'Understanding COA & HPLC Reports',
    description: 'Learn how to read and interpret Certificate of Analysis and HPLC purity reports to ensure you are getting quality research materials.',
    speaker: {
      name: 'Dr. Lisa Park',
      title: 'Analytical Chemistry Lead',
    },
    date: '2025-12-15',
    time: '1:00 PM EST',
    duration: '50 min',
    category: 'Education',
    status: 'recorded',
    registrations: 654,
    thumbnail: '/images/webinars/coa-hplc.jpg',
    tags: ['coa', 'hplc', 'quality'],
    recordingUrl: '/webinars/recordings/understanding-coa',
  },
];

const categories = ['All', 'Education', 'Research', 'Tutorial', 'Best Practices'];

export default function WebinarsPage() {
  const { data: session } = useSession();
  const { t } = useTranslations();
  const [activeFilter, setActiveFilter] = useState<'all' | 'upcoming' | 'recorded'>('all');
  const [activeCategory, setActiveCategory] = useState('All');
  const [registeredWebinars, setRegisteredWebinars] = useState<string[]>([]);
  const [showRegistrationModal, setShowRegistrationModal] = useState<Webinar | null>(null);

  const filteredWebinars = webinars
    .filter(w => activeFilter === 'all' || w.status === activeFilter || (activeFilter === 'upcoming' && w.status === 'live'))
    .filter(w => activeCategory === 'All' || w.category === activeCategory);

  const upcomingWebinars = webinars.filter(w => w.status === 'upcoming' || w.status === 'live');
  const recordedWebinars = webinars.filter(w => w.status === 'recorded');

  const handleRegister = (webinarId: string) => {
    if (!session) {
      window.location.href = '/auth/signin?callbackUrl=/webinars';
      return;
    }
    setRegisteredWebinars(prev => [...prev, webinarId]);
    setShowRegistrationModal(null);
  };

  const getStatusBadge = (status: Webinar['status']) => {
    switch (status) {
      case 'live':
        return (
          <span className="flex items-center gap-1 px-3 py-1 bg-red-500 text-white text-sm font-medium rounded-full animate-pulse">
            <span className="w-2 h-2 bg-white rounded-full"></span>
            LIVE NOW
          </span>
        );
      case 'upcoming':
        return (
          <span className="px-3 py-1 bg-green-100 text-green-700 text-sm font-medium rounded-full">
            Upcoming
          </span>
        );
      case 'recorded':
        return (
          <span className="px-3 py-1 bg-blue-100 text-blue-700 text-sm font-medium rounded-full">
            Watch Recording
          </span>
        );
    }
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-CA', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Hero */}
      <section className="bg-gradient-to-br from-blue-600 to-blue-700 text-white py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3 mb-4">
            <span className="text-4xl">🎓</span>
            <h1 className="text-3xl md:text-4xl font-bold">
              {t('webinars.title') || 'Webinars & Events'}
            </h1>
          </div>
          <p className="text-xl text-blue-100 max-w-2xl">
            {t('webinars.subtitle') || 'Learn from experts with our free educational webinars. Live sessions, Q&A, and on-demand recordings.'}
          </p>

          {/* Stats */}
          <div className="flex flex-wrap gap-6 mt-8">
            <div className="bg-white/10 px-6 py-3 rounded-lg">
              <p className="text-2xl font-bold">{upcomingWebinars.length}</p>
              <p className="text-sm text-blue-200">Upcoming</p>
            </div>
            <div className="bg-white/10 px-6 py-3 rounded-lg">
              <p className="text-2xl font-bold">{recordedWebinars.length}</p>
              <p className="text-sm text-blue-200">Recordings</p>
            </div>
            <div className="bg-white/10 px-6 py-3 rounded-lg">
              <p className="text-2xl font-bold">Free</p>
              <p className="text-sm text-blue-200">Always</p>
            </div>
          </div>
        </div>
      </section>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Live Now Alert */}
        {webinars.some(w => w.status === 'live') && (
          <div className="mb-8 bg-red-50 border border-red-200 rounded-xl p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="flex items-center gap-1 px-3 py-1 bg-red-500 text-white text-sm font-medium rounded-full animate-pulse">
                <span className="w-2 h-2 bg-white rounded-full"></span>
                LIVE NOW
              </span>
              <span className="font-medium">{webinars.find(w => w.status === 'live')?.title}</span>
            </div>
            <button className="px-4 py-2 bg-red-500 text-white rounded-lg font-medium hover:bg-red-600">
              Join Now →
            </button>
          </div>
        )}

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-4 mb-8">
          <div className="flex gap-2">
            {['all', 'upcoming', 'recorded'].map((filter) => (
              <button
                key={filter}
                onClick={() => setActiveFilter(filter as typeof activeFilter)}
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                  activeFilter === filter
                    ? 'bg-blue-600 text-white'
                    : 'bg-white text-neutral-600 hover:bg-neutral-100 border border-neutral-200'
                }`}
              >
                {filter.charAt(0).toUpperCase() + filter.slice(1)}
              </button>
            ))}
          </div>
          <div className="flex gap-2 overflow-x-auto">
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                className={`px-4 py-2 rounded-lg font-medium whitespace-nowrap transition-colors ${
                  activeCategory === cat
                    ? 'bg-neutral-800 text-white'
                    : 'bg-white text-neutral-600 hover:bg-neutral-100 border border-neutral-200'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* Webinars Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredWebinars.map((webinar) => (
            <div
              key={webinar.id}
              className="bg-white rounded-xl shadow-sm border border-neutral-200 overflow-hidden hover:shadow-lg transition-shadow"
            >
              {/* Thumbnail */}
              <div className="relative aspect-video bg-neutral-200">
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                <div className="absolute top-3 left-3">
                  {getStatusBadge(webinar.status)}
                </div>
                <div className="absolute bottom-3 left-3 right-3">
                  <span className="px-2 py-1 bg-white/90 text-neutral-700 text-xs font-medium rounded">
                    {webinar.category}
                  </span>
                </div>
              </div>

              {/* Content */}
              <div className="p-5">
                <h3 className="font-bold text-lg line-clamp-2 mb-2">{webinar.title}</h3>
                <p className="text-sm text-neutral-500 line-clamp-2 mb-4">{webinar.description}</p>

                {/* Speaker */}
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                    <span className="text-blue-600 font-bold">{webinar.speaker.name.charAt(0)}</span>
                  </div>
                  <div>
                    <p className="font-medium text-sm">{webinar.speaker.name}</p>
                    <p className="text-xs text-neutral-500">{webinar.speaker.title}</p>
                  </div>
                </div>

                {/* Date & Time */}
                <div className="flex items-center gap-4 text-sm text-neutral-500 mb-4">
                  <span className="flex items-center gap-1">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    {formatDate(webinar.date)}
                  </span>
                </div>

                <div className="flex items-center gap-4 text-sm text-neutral-500 mb-4">
                  <span className="flex items-center gap-1">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    {webinar.time}
                  </span>
                  <span>•</span>
                  <span>{webinar.duration}</span>
                  {webinar.maxAttendees && (
                    <>
                      <span>•</span>
                      <span>{webinar.registrations}/{webinar.maxAttendees} registered</span>
                    </>
                  )}
                </div>

                {/* Tags */}
                <div className="flex flex-wrap gap-2 mb-4">
                  {webinar.tags.map((tag) => (
                    <span key={tag} className="text-xs bg-neutral-100 text-neutral-600 px-2 py-1 rounded">
                      #{tag}
                    </span>
                  ))}
                </div>

                {/* CTA */}
                {webinar.status === 'recorded' ? (
                  <button className="w-full py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors flex items-center justify-center gap-2">
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M8 5v14l11-7z" />
                    </svg>
                    Watch Recording
                  </button>
                ) : webinar.status === 'live' ? (
                  <button className="w-full py-3 bg-red-500 text-white rounded-lg font-medium hover:bg-red-600 transition-colors flex items-center justify-center gap-2 animate-pulse">
                    <span className="w-2 h-2 bg-white rounded-full"></span>
                    Join Live Now
                  </button>
                ) : registeredWebinars.includes(webinar.id) ? (
                  <button disabled className="w-full py-3 bg-green-100 text-green-700 rounded-lg font-medium flex items-center justify-center gap-2">
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                    Registered
                  </button>
                ) : (
                  <button
                    onClick={() => setShowRegistrationModal(webinar)}
                    className="w-full py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors"
                  >
                    Register Free
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>

        {filteredWebinars.length === 0 && (
          <div className="text-center py-12">
            <span className="text-6xl mb-4 block">🎓</span>
            <h3 className="text-lg font-bold mb-2">{t('webinars.noWebinars') || 'No webinars found'}</h3>
            <p className="text-neutral-500">{t('webinars.checkBack') || 'Check back soon for new educational content!'}</p>
          </div>
        )}

        {/* Newsletter CTA */}
        <div className="mt-12 bg-gradient-to-br from-blue-600 to-blue-700 rounded-2xl p-8 text-white text-center">
          <span className="text-5xl mb-4 block">📬</span>
          <h2 className="text-2xl font-bold mb-2">{t('webinars.stayUpdated') || 'Never Miss a Webinar'}</h2>
          <p className="text-blue-100 mb-6 max-w-md mx-auto">
            {t('webinars.stayUpdatedDesc') || 'Subscribe to get notified about upcoming webinars, new recordings, and exclusive educational content.'}
          </p>
          <div className="flex flex-col sm:flex-row gap-3 max-w-md mx-auto">
            <input
              type="email"
              placeholder="Enter your email"
              className="flex-1 px-4 py-3 rounded-lg text-neutral-900 focus:outline-none focus:ring-2 focus:ring-white"
            />
            <button className="px-6 py-3 bg-white text-blue-600 rounded-lg font-medium hover:bg-blue-50 transition-colors">
              Subscribe
            </button>
          </div>
        </div>
      </div>

      {/* Registration Modal */}
      {showRegistrationModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-md w-full">
            <div className="p-6 border-b">
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-bold">Register for Webinar</h3>
                <button onClick={() => setShowRegistrationModal(null)} className="p-2 hover:bg-neutral-100 rounded-lg">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
            
            <div className="p-6">
              <h4 className="font-bold mb-2">{showRegistrationModal.title}</h4>
              <div className="flex items-center gap-4 text-sm text-neutral-500 mb-6">
                <span>{formatDate(showRegistrationModal.date)}</span>
                <span>•</span>
                <span>{showRegistrationModal.time}</span>
              </div>

              {session ? (
                <>
                  <div className="bg-green-50 rounded-lg p-4 mb-6">
                    <p className="text-green-700">
                      You will receive a confirmation email at <strong>{session.user?.email}</strong> with the webinar link.
                    </p>
                  </div>
                  <button
                    onClick={() => handleRegister(showRegistrationModal.id)}
                    className="w-full py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors"
                  >
                    Confirm Registration
                  </button>
                </>
              ) : (
                <>
                  <p className="text-neutral-600 mb-6">Please sign in to register for this webinar.</p>
                  <Link
                    href={`/auth/signin?callbackUrl=/webinars`}
                    className="block w-full py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors text-center"
                  >
                    Sign In to Register
                  </Link>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
