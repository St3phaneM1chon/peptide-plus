import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Changer le mot de passe',
  description: 'Modifiez votre mot de passe BioCycle Peptides de façon sécurisée.',
  robots: 'noindex, nofollow',
  openGraph: {
    title: 'Changer le mot de passe | BioCycle Peptides',
    description: 'Modifiez votre mot de passe de façon sécurisée.',
    siteName: 'BioCycle Peptides',
    type: 'website',
  },
};

export default function ChangePasswordLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
