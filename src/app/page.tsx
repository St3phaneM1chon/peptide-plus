/**
 * PAGE D'ACCUEIL
 */

import Link from 'next/link';

export default function HomePage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-8">
      <div className="max-w-2xl text-center">
        {/* Logo / Titre */}
        <div className="mb-8">
          <div className="w-20 h-20 mx-auto mb-4 bg-blue-600 rounded-2xl flex items-center justify-center">
            <svg
              className="w-10 h-10 text-white"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
              />
            </svg>
          </div>
          <h1 className="text-4xl font-bold text-gray-900 mb-2">
            Secure Web Template
          </h1>
          <p className="text-lg text-gray-600">
            Application web sécurisée - Conforme Chubb / NYDFS / OWASP
          </p>
        </div>

        {/* Features */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8 text-left">
          <div className="card">
            <div className="flex items-center mb-2">
              <span className="text-green-500 mr-2">✓</span>
              <h3 className="font-semibold">Azure AD (Entra ID)</h3>
            </div>
            <p className="text-sm text-gray-600">
              Authentification SSO avec MFA obligatoire
            </p>
          </div>

          <div className="card">
            <div className="flex items-center mb-2">
              <span className="text-green-500 mr-2">✓</span>
              <h3 className="font-semibold">Chiffrement AES-256</h3>
            </div>
            <p className="text-sm text-gray-600">
              Données chiffrées au repos et en transit
            </p>
          </div>

          <div className="card">
            <div className="flex items-center mb-2">
              <span className="text-green-500 mr-2">✓</span>
              <h3 className="font-semibold">Azure Key Vault</h3>
            </div>
            <p className="text-sm text-gray-600">
              Gestion sécurisée des secrets
            </p>
          </div>

          <div className="card">
            <div className="flex items-center mb-2">
              <span className="text-green-500 mr-2">✓</span>
              <h3 className="font-semibold">OWASP Top 10</h3>
            </div>
            <p className="text-sm text-gray-600">
              Protection contre les vulnérabilités web
            </p>
          </div>
        </div>

        {/* CTA */}
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link href="/auth/signin" className="btn-primary">
            Se connecter
          </Link>
          <Link href="/api/health" className="btn-secondary">
            Status API
          </Link>
        </div>

        {/* Footer */}
        <p className="mt-12 text-sm text-gray-500">
          Conforme SOC 2 Type II • ISO 27001 • NYDFS 23 NYCRR 500
        </p>
      </div>
    </div>
  );
}
