'use client';

/**
 * LiveCourseGrid — Fetches and displays real courses from the LMS
 * Used by the Puck page builder's FeaturedCourses section on public pages.
 */

import { useState, useEffect } from 'react';

interface Course {
  id: string;
  title: string;
  slug: string;
  price: number | null;
  thumbnailUrl: string | null;
  description: string | null;
  _count?: { lessons: number };
}

interface LiveCourseGridProps {
  title?: string;
  limit?: number;
}

export default function LiveCourseGrid({ title, limit = 3 }: LiveCourseGridProps) {
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/lms/courses?limit=${limit}&published=true`)
      .then(res => res.ok ? res.json() : { courses: [] })
      .then(data => setCourses((data.courses || []).slice(0, limit)))
      .catch(() => setCourses([]))
      .finally(() => setLoading(false));
  }, [limit]);

  if (loading) {
    return (
      <div className="space-y-6">
        {title && <h2 className="text-3xl font-bold text-center" style={{ color: 'var(--k-text-primary, rgba(255,255,255,0.95))' }}>{title}</h2>}
        <div className="grid md:grid-cols-3 gap-6">
          {Array.from({ length: limit }).map((_, i) => (
            <div key={i} className="rounded-xl overflow-hidden animate-pulse" style={{ border: '1px solid rgba(255,255,255,0.08)', background: 'var(--k-glass-regular, rgba(255,255,255,0.08))' }}>
              <div className="aspect-video" style={{ background: 'rgba(16,185,129,0.08)' }} />
              <div className="p-4 space-y-2">
                <div className="h-4 w-32 rounded bg-white/10" />
                <div className="h-3 w-20 rounded bg-white/10" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (courses.length === 0) {
    return (
      <div className="space-y-6">
        {title && <h2 className="text-3xl font-bold text-center" style={{ color: 'var(--k-text-primary, rgba(255,255,255,0.95))' }}>{title}</h2>}
        <p className="text-center opacity-50" style={{ color: 'var(--k-text-secondary, rgba(255,255,255,0.60))' }}>
          Aucune formation disponible pour le moment.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {title && <h2 className="text-3xl font-bold text-center" style={{ color: 'var(--k-text-primary, rgba(255,255,255,0.95))' }}>{title}</h2>}
      <div className="grid md:grid-cols-3 gap-6">
        {courses.map((course) => (
          <a
            key={course.id}
            href={`/learn/${course.slug}`}
            className="rounded-xl overflow-hidden group hover:shadow-xl transition-all"
            style={{ border: '1px solid rgba(255,255,255,0.08)', background: 'var(--k-glass-regular, rgba(255,255,255,0.08))' }}
          >
            <div className="aspect-video overflow-hidden" style={{ background: 'rgba(16,185,129,0.08)' }}>
              {course.thumbnailUrl ? (
                <img
                  src={course.thumbnailUrl}
                  alt={course.title}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  loading="lazy"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-4xl">🎓</div>
              )}
            </div>
            <div className="p-4 space-y-2">
              <h3 className="font-semibold line-clamp-2" style={{ color: 'var(--k-text-primary, rgba(255,255,255,0.95))' }}>
                {course.title}
              </h3>
              {course.description && (
                <p className="text-sm line-clamp-2 opacity-60" style={{ color: 'var(--k-text-secondary, rgba(255,255,255,0.60))' }}>
                  {course.description}
                </p>
              )}
              <div className="flex items-center justify-between">
                <span className="text-sm opacity-50">{course._count?.lessons || 0} leçons</span>
                <span className="font-bold" style={{ color: '#10b981' }}>
                  {course.price ? `$${course.price.toFixed(2)}` : 'Gratuit'}
                </span>
              </div>
            </div>
          </a>
        ))}
      </div>
    </div>
  );
}
