import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Welcome to Attitudes VIP',
  description: 'Welcome! Your Attitudes VIP account is ready. Start exploring the Suite Koraline platform.',
  robots: { index: false, follow: false },
  openGraph: {
    title: 'Welcome to Attitudes VIP',
    description: 'Welcome! Your Attitudes VIP account is ready.',
  },
};

export default function WelcomeLayout({ children }: { children: React.ReactNode }) {
  return children;
}
