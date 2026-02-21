import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Change Password | BioCycle Peptides',
  robots: 'noindex, nofollow',
};

export default function ChangePasswordLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
