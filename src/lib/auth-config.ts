/**
 * CONFIGURATION AUTHENTIFICATION MULTI-PROVIDERS
 * Google, Apple, Facebook, X (Twitter), Email/Password + MFA
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

// =====================================================
// CONFIGURATION DES PROVIDERS
// =====================================================

const providers = [
  // Google
  GoogleProvider({
    clientId: process.env.GOOGLE_CLIENT_ID!,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    authorization: {
      params: {
        prompt: 'consent',
        access_type: 'offline',
        response_type: 'code',
      },
    },
  }),

  // Apple
  AppleProvider({
    clientId: process.env.APPLE_CLIENT_ID!,
    clientSecret: process.env.APPLE_CLIENT_SECRET!,
  }),

  // Facebook
  FacebookProvider({
    clientId: process.env.FACEBOOK_CLIENT_ID!,
    clientSecret: process.env.FACEBOOK_CLIENT_SECRET!,
  }),

  // X (Twitter)
  TwitterProvider({
    clientId: process.env.TWITTER_CLIENT_ID!,
    clientSecret: process.env.TWITTER_CLIENT_SECRET!,
    version: '2.0',
  }),

  // Email/Password
  CredentialsProvider({
    id: 'credentials',
    name: 'Email',
    credentials: {
      email: { label: 'Email', type: 'email' },
      password: { label: 'Mot de passe', type: 'password' },
      mfaCode: { label: 'Code MFA', type: 'text' },
    },
    async authorize(credentials) {
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

      return {
        id: user.id,
        email: user.email,
        name: user.name,
        image: user.image,
        role: user.role,
        mfaEnabled: user.mfaEnabled,
      };
    },
  }),
];

// =====================================================
// CONFIGURATION NEXTAUTH
// =====================================================

export const authConfig: NextAuthConfig = {
  adapter: PrismaAdapter(prisma),
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
    async signIn({ user, account, profile }) {
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

      // Pour les providers OAuth, créer/mettre à jour l'utilisateur
      if (account?.provider !== 'credentials') {
        const existingUser = await prisma.user.findUnique({
          where: { email: user.email! },
        });

        // Si nouveau utilisateur OAuth, il doit configurer MFA
        if (!existingUser) {
          // L'utilisateur sera créé par l'adapter
          // On force la configuration MFA au premier login
          return '/auth/setup-mfa';
        }

        // Si utilisateur existant sans MFA, forcer la configuration
        if (!existingUser.mfaEnabled) {
          return '/auth/setup-mfa';
        }
      }

      return true;
    },

    // Enrichissement du JWT
    async jwt({ token, user, account, trigger }) {
      if (user) {
        token.id = user.id;
        token.role = (user as any).role || UserRole.CUSTOMER;
        token.mfaEnabled = (user as any).mfaEnabled || false;
      }

      // Rafraîchir les données utilisateur périodiquement
      if (trigger === 'update') {
        const dbUser = await prisma.user.findUnique({
          where: { id: token.id as string },
        });
        if (dbUser) {
          token.role = dbUser.role;
          token.mfaEnabled = dbUser.mfaEnabled;
        }
      }

      return token;
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
      // Redirection par défaut vers le dashboard approprié
      if (url === baseUrl || url === `${baseUrl}/`) {
        return `${baseUrl}/dashboard`;
      }
      
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

  // Events pour audit
  events: {
    async signIn({ user, account }) {
      await prisma.auditLog.create({
        data: {
          userId: user.id,
          action: 'LOGIN',
          entityType: 'User',
          entityId: user.id,
          details: JSON.stringify({
            provider: account?.provider,
            timestamp: new Date().toISOString(),
          }),
        },
      });
    },
    async signOut({ token }) {
      if (token?.id) {
        await prisma.auditLog.create({
          data: {
            userId: token.id as string,
            action: 'LOGOUT',
            entityType: 'User',
            entityId: token.id as string,
          },
        });
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
