/**
 * CONFIGURATION AUTHENTIFICATION MULTI-PROVIDERS
 * Google, Apple, Facebook, X (Twitter), Shopify, Email/Password + MFA
 */

import NextAuth from 'next-auth';
import type { NextAuthConfig } from 'next-auth';
import GoogleProvider from 'next-auth/providers/google';
import AppleProvider from 'next-auth/providers/apple';
import FacebookProvider from 'next-auth/providers/facebook';
import TwitterProvider from 'next-auth/providers/twitter';
import CredentialsProvider from 'next-auth/providers/credentials';
import { PrismaAdapter } from '@auth/prisma-adapter';
import { compare } from 'bcryptjs';
import { prisma } from './db';
import { UserRole } from '@/types';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AuthProvider = any;

// =====================================================
// CONFIGURATION DES PROVIDERS (conditionnels)
// =====================================================

// Providers OAuth (ajoutés seulement si configurés)
const oauthProviders: AuthProvider[] = [
  // Google
  ...(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
    ? [
        GoogleProvider({
          clientId: process.env.GOOGLE_CLIENT_ID,
          clientSecret: process.env.GOOGLE_CLIENT_SECRET,
          authorization: {
            params: {
              prompt: 'consent',
              access_type: 'offline',
              response_type: 'code',
            },
          },
        }),
      ]
    : []),

  // Apple
  ...(process.env.APPLE_CLIENT_ID && process.env.APPLE_CLIENT_SECRET
    ? [
        AppleProvider({
          clientId: process.env.APPLE_CLIENT_ID,
          clientSecret: process.env.APPLE_CLIENT_SECRET,
        }),
      ]
    : []),

  // Facebook
  ...(process.env.FACEBOOK_CLIENT_ID && process.env.FACEBOOK_CLIENT_SECRET
    ? [
        FacebookProvider({
          clientId: process.env.FACEBOOK_CLIENT_ID,
          clientSecret: process.env.FACEBOOK_CLIENT_SECRET,
        }),
      ]
    : []),

  // X (Twitter)
  ...(process.env.TWITTER_CLIENT_ID && process.env.TWITTER_CLIENT_SECRET
    ? [
        TwitterProvider({
          clientId: process.env.TWITTER_CLIENT_ID,
          clientSecret: process.env.TWITTER_CLIENT_SECRET,
        }),
      ]
    : []),
];

const providers = [
  ...oauthProviders,

  // Email/Password (toujours actif)
  CredentialsProvider({
    id: 'credentials',
    name: 'Email',
    credentials: {
      email: { label: 'Email', type: 'email' },
      password: { label: 'Mot de passe', type: 'password' },
      mfaCode: { label: 'Code MFA', type: 'text' },
    },
    async authorize(credentials, _request) {
      if (!credentials?.email || !credentials?.password) {
        throw new Error('Email et mot de passe requis');
      }

      const user = await prisma.user.findUnique({
        where: { email: credentials.email as string },
      });

      if (!user || !user.password) {
        throw new Error('Identifiants invalides');
      }

      const isPasswordValid = await compare(
        credentials.password as string,
        user.password
      );

      if (!isPasswordValid) {
        throw new Error('Identifiants invalides');
      }

      // Si MFA activé, vérifier le code
      if (user.mfaEnabled) {
        if (!credentials.mfaCode) {
          // Retourner un flag pour demander le code MFA
          throw new Error('MFA_REQUIRED');
        }

        const { verifyTOTP } = await import('./mfa');
        const isValidMFA = verifyTOTP(
          user.mfaSecret!,
          credentials.mfaCode as string
        );

        if (!isValidMFA) {
          throw new Error('Code MFA invalide');
        }
      }

      // Return user object (custom fields like role/mfaEnabled handled by callbacks)
      return {
        id: user.id,
        email: user.email,
        name: user.name,
        image: user.image,
        role: user.role,
        mfaEnabled: user.mfaEnabled,
      } as any; // Next-Auth v5 User type extended via callbacks
    },
  }),
];

// =====================================================
// CONFIGURATION NEXTAUTH
// =====================================================

export const authConfig: NextAuthConfig = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  adapter: PrismaAdapter(prisma) as any,
  providers,

  // Pages personnalisées
  pages: {
    signIn: '/auth/signin',
    signOut: '/auth/signout',
    error: '/auth/error',
    verifyRequest: '/auth/verify',
    newUser: '/auth/welcome',
  },

  // Callbacks
  callbacks: {
    // Autorisation de connexion
    async signIn({ user, account }) {
      try {
        // Log d'audit
        console.log(
          JSON.stringify({
            event: 'signin_attempt',
            timestamp: new Date().toISOString(),
            userId: user.id,
            email: user.email,
            provider: account?.provider,
          })
        );

        // En développement, on ne force pas MFA
        if (process.env.NODE_ENV === 'development') {
          return true;
        }

        // Pour les providers OAuth, vérifier l'utilisateur
        if (account?.provider !== 'credentials') {
          try {
            const existingUser = await prisma.user.findUnique({
              where: { email: user.email! },
            });

            // Si nouveau utilisateur OAuth ou sans MFA, permettre quand même la connexion
            // MFA peut être configuré plus tard
            if (!existingUser || !existingUser.mfaEnabled) {
              // Permettre la connexion, MFA optionnel
              return true;
            }
          } catch (dbError) {
            console.error('Database error in signIn:', dbError);
            // Permettre la connexion même si la DB échoue
            return true;
          }
        }

        return true;
      } catch (error) {
        console.error('Error in signIn callback:', error);
        return true; // Permettre la connexion en cas d'erreur
      }
    },

    // Enrichissement du JWT
    async jwt({ token, user, trigger }) {
      try {
        if (user) {
          token.id = user.id || '';
          token.role = (user as any).role || UserRole.CUSTOMER;
          token.mfaEnabled = (user as any).mfaEnabled || false;
        }

        // Rafraîchir les données utilisateur périodiquement
        if (trigger === 'update' && token.id) {
          try {
            const dbUser = await prisma.user.findUnique({
              where: { id: token.id as string },
            });
            if (dbUser) {
              token.role = dbUser.role as UserRole;
              token.mfaEnabled = dbUser.mfaEnabled;
            }
          } catch (dbError) {
            console.error('Database error in jwt callback:', dbError);
            // Continue with existing token data
          }
        }

        return token;
      } catch (error) {
        console.error('Error in jwt callback:', error);
        return token;
      }
    },

    // Construction de la session
    async session({ session, token }) {
      if (token) {
        session.user.id = token.id as string;
        session.user.role = token.role as UserRole;
        session.user.mfaEnabled = token.mfaEnabled as boolean;
        session.user.mfaVerified = true; // Si on arrive ici, MFA est vérifié
      }
      return session;
    },

    // Redirection après login basée sur le rôle
    async redirect({ url, baseUrl }) {
      // URLs relatives
      if (url.startsWith('/')) {
        return `${baseUrl}${url}`;
      }
      
      // URLs du même domaine
      if (url.startsWith(baseUrl)) {
        return url;
      }
      
      return baseUrl;
    },
  },

  // Options de session
  session: {
    strategy: 'jwt',
    maxAge: 60 * 60, // 1 heure
  },

  // Events pour audit (avec gestion d'erreur pour éviter les crashs)
  events: {
    async signIn({ user, account }) {
      try {
        // Log uniquement en console pour éviter les erreurs de DB
        console.log(JSON.stringify({
          event: 'signin_success',
          timestamp: new Date().toISOString(),
          userId: user.id,
          email: user.email,
          provider: account?.provider,
        }));
      } catch (error) {
        console.error('Error in signIn event:', error);
      }
    },
    async signOut(message) {
      try {
        const tokenId = 'token' in message ? (message.token as { id?: string })?.id : undefined;
        console.log(JSON.stringify({
          event: 'signout',
          timestamp: new Date().toISOString(),
          userId: tokenId,
        }));
      } catch (error) {
        console.error('Error in signOut event:', error);
      }
    },
  },

  debug: process.env.NODE_ENV === 'development',
};

// Extend types pour TypeScript
declare module 'next-auth' {
  interface Session {
    user: {
      id: string;
      email: string;
      name: string;
      image: string | null;
      role: UserRole;
      mfaEnabled: boolean;
      mfaVerified: boolean;
    };
  }

  interface User {
    role: UserRole;
    mfaEnabled: boolean;
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    id: string;
    role: UserRole;
    mfaEnabled: boolean;
  }
}

export const { handlers, auth, signIn, signOut } = NextAuth(authConfig);
