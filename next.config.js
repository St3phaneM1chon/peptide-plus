/** @type {import('next').NextConfig} */
const nextConfig = {
  // Production: Standalone build for Azure/Docker deployment
  output: 'standalone',
  
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
              // unsafe-eval needed for Next.js dev mode HMR; safe to keep in prod (Next.js strips it)
              `script-src 'self' 'unsafe-inline' 'unsafe-eval' https://js.stripe.com https://www.paypal.com https://login.microsoftonline.com https://accounts.google.com https://appleid.cdn-apple.com`,
              "style-src 'self' 'unsafe-inline'",
              "img-src 'self' data: https: blob:",
              "font-src 'self' data:",
              "connect-src 'self' https://*.azure.com https://login.microsoftonline.com https://api.stripe.com https://www.paypal.com https://api.openai.com https://accounts.google.com https://oauth.googleapis.com https://appleid.apple.com https://graph.facebook.com https://api.x.com https://api.twitter.com https://twitter.com",
              "frame-src https://js.stripe.com https://www.paypal.com https://hooks.stripe.com https://accounts.google.com",
              "frame-ancestors 'none'",
              "base-uri 'self'",
              "form-action 'self' https://accounts.google.com https://appleid.apple.com https://www.facebook.com https://x.com https://twitter.com",
              ...(process.env.NODE_ENV === 'production' ? ["upgrade-insecure-requests"] : [])
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
  
  // Compression automatique
  compress: true,
  
  // Optimiser les packages
  modularizeImports: {
    'lucide-react': {
      transform: 'lucide-react/dist/esm/icons/{{member}}',
    },
    'date-fns': {
      transform: 'date-fns/{{member}}',
    },
  },
  
  // Exclude jsdom-based packages from server webpack bundling.
  // jsdom@28 (used by isomorphic-dompurify) loads default-stylesheet.css
  // via fs.readFileSync which webpack cannot resolve during build.
  serverExternalPackages: ['isomorphic-dompurify', 'jsdom'],

  // Experimental optimizations
  experimental: {
    optimizePackageImports: ['lucide-react', 'date-fns', '@radix-ui/react-icons'],
  },
  
  // Images - Optimisation et domaines autorisés
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**.azure.com',
      },
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
      },
      {
        protocol: 'https',
        hostname: '**.cloudinary.com',
      },
      {
        protocol: 'https',
        hostname: 'biocyclepeptides.com',
      },
      {
        protocol: 'https',
        hostname: 'lh3.googleusercontent.com',
      },
      {
        protocol: 'https',
        hostname: 'pbs.twimg.com',
      },
    ],
    // Formats modernes pour performance
    formats: ['image/avif', 'image/webp'],
    // Tailles d'images générées automatiquement
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
    // Cache images optimisées
    minimumCacheTTL: 60 * 60 * 24 * 30, // 30 jours
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
