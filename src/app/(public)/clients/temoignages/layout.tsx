import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Testimonials',
  description: 'Read and watch testimonials from our clients about their experience with BioCycle Peptides.',
};

export default function TestimonialsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
