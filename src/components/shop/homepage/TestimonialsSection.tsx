'use client';

import Image from 'next/image';
import { MotionDiv } from '@/components/koraline';
import { GlassCard } from '@/components/koraline';
import type { TestimonialsSection as TestimonialsConfig } from '@/lib/homepage-sections';
import type { TestimonialDisplayData } from '@/lib/homepage-sections';

interface Props {
  config: TestimonialsConfig;
  testimonials: TestimonialDisplayData[];
}

function StarRating({ rating }: { rating: number }) {
  return (
    <div className="flex gap-0.5 mb-3" aria-label={`${rating} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map((star) => (
        <svg
          key={star}
          className={`w-5 h-5 ${star <= rating ? 'text-[var(--k-accent-amber)]' : 'text-[var(--k-text-muted)]'}`}
          fill="currentColor"
          viewBox="0 0 20 20"
          aria-hidden="true"
        >
          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
        </svg>
      ))}
    </div>
  );
}

export default function TestimonialsSection({ config, testimonials }: Props) {
  if (testimonials.length === 0) return null;

  return (
    <section className="py-16 md:py-24 bg-[var(--k-bg-surface)]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <MotionDiv animation="slideUp" className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-bold text-[var(--k-text-primary)]">
            {config.title}
          </h2>
        </MotionDiv>

        {/* Testimonials Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {testimonials.slice(0, 6).map((testimonial, index) => (
            <MotionDiv key={testimonial.id} animation="slideUp" delay={0.05 * index}>
              <GlassCard hoverable={false} className="h-full">
                <div className="p-6 flex flex-col h-full">
                  <StarRating rating={testimonial.rating} />
                  <p className="text-[var(--k-text-secondary)] mb-5 leading-relaxed flex-1">
                    &ldquo;{testimonial.content}&rdquo;
                  </p>
                  <div className="flex items-center gap-3 pt-4 border-t border-[var(--k-border-subtle)]">
                    {testimonial.imageUrl && (
                      <Image
                        src={testimonial.imageUrl}
                        alt={testimonial.name}
                        width={40}
                        height={40}
                        className="rounded-full object-cover"
                      />
                    )}
                    <div>
                      <p className="font-semibold text-[var(--k-text-primary)] text-sm">
                        {testimonial.name}
                      </p>
                      {testimonial.role && (
                        <p className="text-xs text-[var(--k-text-tertiary)]">
                          {testimonial.role}
                          {testimonial.company ? ` - ${testimonial.company}` : ''}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              </GlassCard>
            </MotionDiv>
          ))}
        </div>
      </div>
    </section>
  );
}
