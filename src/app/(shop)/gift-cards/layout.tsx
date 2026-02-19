import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Gift Cards',
  description: 'Give the gift of research. Purchase a BioCycle Peptides gift card in amounts from $25 to $1000 — valid for any product on our site.',
};

export default function GiftCardsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
