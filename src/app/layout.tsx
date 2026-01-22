/**
 * ROOT LAYOUT - Application sécurisée
 */

import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: {
    template: '%s | Secure App',
    default: 'Secure Web Application',
  },
  description: 'Application web sécurisée - Conforme Chubb/NYDFS',
  // Sécurité: Ne pas indexer les pages sensibles
  robots: {
    index: false,
    follow: false,
  },
  // Désactiver le référencement automatique
  referrer: 'strict-origin-when-cross-origin',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="fr" suppressHydrationWarning>
      <head>
        {/* Meta tags de sécurité supplémentaires */}
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta name="format-detection" content="telephone=no" />
      </head>
      <body className={inter.className}>
        {/* Providers d'authentification et autres contextes */}
        <main className="min-h-screen bg-gray-50">
          {children}
        </main>
      </body>
    </html>
  );
}
