'use client';

import Link from 'next/link';
import Image from 'next/image';
import { MotionDiv } from '@/components/koraline';
import { GlassCard } from '@/components/koraline';
import type { FeaturedCoursesSection as FeaturedCoursesConfig } from '@/lib/homepage-sections';
import type { FeaturedCourseData } from '@/lib/homepage-sections';

interface Props {
  config: FeaturedCoursesConfig;
  courses: FeaturedCourseData[];
}

const LEVEL_COLORS: Record<string, string> = {
  BEGINNER: 'bg-[var(--k-accent-emerald)]/20 text-[var(--k-accent-emerald)]',
  INTERMEDIATE: 'bg-[var(--k-accent-indigo)]/20 text-[var(--k-accent-indigo)]',
  ADVANCED: 'bg-[var(--k-accent-amber)]/20 text-[var(--k-accent-amber)]',
  EXPERT: 'bg-[var(--k-accent-rose)]/20 text-[var(--k-accent-rose)]',
};

export default function FeaturedCoursesSection({ config, courses }: Props) {
  if (courses.length === 0) return null;

  return (
    <section className="py-16 md:py-24 bg-[var(--k-bg-surface)]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <MotionDiv animation="slideUp" className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-bold text-[var(--k-text-primary)] mb-3">
            {config.title}
          </h2>
          {config.subtitle && (
            <p className="text-[var(--k-text-secondary)] text-lg max-w-2xl mx-auto">
              {config.subtitle}
            </p>
          )}
        </MotionDiv>

        {/* Course Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {courses.map((course, index) => (
            <MotionDiv key={course.id} animation="slideUp" delay={0.05 * index}>
              <GlassCard hoverable>
                <Link href={`/learn/courses/${course.slug}`} className="block">
                  {/* Thumbnail */}
                  <div className="aspect-video relative overflow-hidden bg-[var(--k-bg-raised)]">
                    {course.thumbnailUrl ? (
                      <Image
                        src={course.thumbnailUrl}
                        alt={course.title}
                        fill
                        className="object-cover transition-transform duration-500 group-hover:scale-105"
                        sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                      />
                    ) : (
                      <div className="flex items-center justify-center h-full">
                        <svg className="w-12 h-12 text-[var(--k-text-muted)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />
                        </svg>
                      </div>
                    )}
                    {/* Level badge */}
                    <span className={`absolute top-3 left-3 px-2.5 py-1 rounded-full text-xs font-medium backdrop-blur-sm ${LEVEL_COLORS[course.level] || 'bg-[var(--k-glass-regular)] text-[var(--k-text-secondary)]'}`}>
                      {course.level}
                    </span>
                    {/* Free badge */}
                    {course.isFree && (
                      <span className="absolute top-3 right-3 px-2.5 py-1 rounded-full text-xs font-medium bg-[var(--k-accent-emerald)]/90 text-white backdrop-blur-sm">
                        Free
                      </span>
                    )}
                  </div>

                  {/* Info */}
                  <div className="p-5">
                    <h3 className="text-base font-semibold text-[var(--k-text-primary)] line-clamp-2 mb-1">
                      {course.title}
                    </h3>
                    {course.subtitle && (
                      <p className="text-sm text-[var(--k-text-tertiary)] line-clamp-1 mb-3">
                        {course.subtitle}
                      </p>
                    )}

                    {/* Price */}
                    <div className="flex items-center justify-between">
                      {!course.isFree && course.price != null ? (
                        <span className="font-bold text-[var(--k-text-primary)]">
                          ${Number(course.price).toFixed(2)}
                        </span>
                      ) : (
                        <span className="text-sm font-medium text-[var(--k-accent-emerald)]">
                          Free
                        </span>
                      )}
                      <span className="text-sm text-[var(--k-text-tertiary)] flex items-center gap-1">
                        View
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                      </span>
                    </div>
                  </div>
                </Link>
              </GlassCard>
            </MotionDiv>
          ))}
        </div>
      </div>
    </section>
  );
}
