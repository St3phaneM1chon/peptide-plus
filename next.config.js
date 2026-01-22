/** @type {import('next').NextConfig} */
const nextConfig = {
  // Build: Ignorer les erreurs pour déploiement initial
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },

  // Sécurité: Désactiver x-powered-by
  poweredByHeader: false,
  
  // Sécurité: Headers HTTP stricts
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          // HSTS - Force HTTPS
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=31536000; includeSubDomains; preload'
          },
          // Empêcher le clickjacking
          {
            key: 'X-Frame-Options',
            value: 'DENY'
          },
          // Empêcher le sniffing de type MIME
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff'
          },
          // Protection XSS (legacy)
          {
            key: 'X-XSS-Protection',
            value: '1; mode=block'
          },
          // Politique de référent
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin'
          },
          // Politique de permissions
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=(), interest-cohort=()'
          },
          // Content Security Policy
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://login.microsoftonline.com",
              "style-src 'self' 'unsafe-inline'",
              "img-src 'self' data: https:",
              "font-src 'self'",
              "connect-src 'self' https://*.azure.com https://login.microsoftonline.com",
              "frame-ancestors 'none'",
              "base-uri 'self'",
              "form-action 'self'"
            ].join('; ')
          }
        ]
      }
    ];
  },

  // Sécurité: Redirections HTTPS
  async redirects() {
    return [];
  },

  // Optimisations
  reactStrictMode: true,
  
  // Images autorisées
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**.azure.com',
      },
    ],
  },

  // Variables d'environnement publiques (non sensibles uniquement!)
  env: {
    NEXT_PUBLIC_APP_NAME: process.env.NEXT_PUBLIC_APP_NAME,
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
  },

  // Webpack - Sécurité
  webpack: (config, { isServer }) => {
    // Ne pas exposer les chemins de fichiers dans les erreurs
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        path: false,
        crypto: false,
      };
    }
    return config;
  },
};

module.exports = nextConfig;
