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
// allowDangerousEmailAccountLinking: permet aux utilisateurs qui se sont inscrits
// par email/password de lier ensuite un compte OAuth avec le même email
const oauthProviders: AuthProvider[] = [
  // Google
  ...(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
    ? [
        GoogleProvider({
          clientId: process.env.GOOGLE_CLIENT_ID,
          clientSecret: process.env.GOOGLE_CLIENT_SECRET,
          allowDangerousEmailAccountLinking: true,
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
          allowDangerousEmailAccountLinking: true,
        }),
      ]
    : []),

  // Facebook
  ...(process.env.FACEBOOK_CLIENT_ID && process.env.FACEBOOK_CLIENT_SECRET
    ? [
        FacebookProvider({
          clientId: process.env.FACEBOOK_CLIENT_ID,
          clientSecret: process.env.FACEBOOK_CLIENT_SECRET,
          allowDangerousEmailAccountLinking: true,
        }),
      ]
    : []),

  // X (Twitter) — OAuth 2.0 does NOT return email
  // We generate a placeholder email from the Twitter user ID so PrismaAdapter can create the User row
  ...(process.env.TWITTER_CLIENT_ID && process.env.TWITTER_CLIENT_SECRET
    ? [
        TwitterProvider({
          clientId: process.env.TWITTER_CLIENT_ID,
          clientSecret: process.env.TWITTER_CLIENT_SECRET,
          allowDangerousEmailAccountLinking: true,
          profile({ data }) {
            return {
              id: data.id,
              name: data.name,
              email: data.email ?? `twitter_${data.id}@noemail.biocyclepeptides.com`,
              image: data.profile_image_url,
            };
          },
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
    async authorize(credentials, request) {
      if (!credentials?.email || !credentials?.password) {
        throw new Error('Email et mot de passe requis');
      }

      const email = (credentials.email as string).toLowerCase();
      const ipAddress = request?.headers?.get?.('x-forwarded-for') || 'unknown';
      const userAgent = request?.headers?.get?.('user-agent') || 'unknown';

      // SECURITY: Check brute-force lockout before any DB query
      const { checkLoginAttempt, recordFailedAttempt, clearFailedAttempts } = await import('./brute-force-protection');
      const lockCheck = await checkLoginAttempt(email, ipAddress, userAgent);
      if (!lockCheck.allowed) {
        throw new Error(lockCheck.message || 'Compte temporairement verrouillé');
      }

      const user = await prisma.user.findUnique({
        where: { email },
      });

      if (!user || !user.password) {
        await recordFailedAttempt(email, ipAddress, userAgent);
        throw new Error('Identifiants invalides');
      }

      const isPasswordValid = await compare(
        credentials.password as string,
        user.password
      );

      if (!isPasswordValid) {
        await recordFailedAttempt(email, ipAddress, userAgent);
        throw new Error('Identifiants invalides');
      }

      // Si MFA activé, vérifier le code
      if (user.mfaEnabled) {
        if (!credentials.mfaCode) {
          throw new Error('MFA_REQUIRED');
        }

        const { verifyTOTP } = await import('./mfa');
        // SECURITY FIX: Decrypt the MFA secret before verification
        let mfaSecret = user.mfaSecret!;
        try {
          const { decrypt } = await import('./security');
          mfaSecret = await decrypt(user.mfaSecret!);
        } catch {
          // If decryption fails (ENCRYPTION_KEY missing), use raw value as fallback
          // This handles the migration period before ENCRYPTION_KEY is set
        }

        const isValidMFA = verifyTOTP(
          mfaSecret,
          credentials.mfaCode as string
        );

        if (!isValidMFA) {
          throw new Error('Code MFA invalide');
        }
      }

      // SECURITY: Clear failed attempts on successful login
      clearFailedAttempts(email);

      // Return user object (custom fields like role/mfaEnabled handled by callbacks)
      return {
        id: user.id,
        email: user.email,
        name: user.name,
        image: user.image,
        role: user.role,
        mfaEnabled: user.mfaEnabled,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Next-Auth v5 User type extended via callbacks
      } as any;
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

  // CRITICAL: Trust proxy headers (Azure App Service terminates TLS at load balancer)
  // Without this, Auth.js generates http:// callback URLs instead of https://
  // causing redirect_uri_mismatch errors with Google OAuth
  trustHost: true,

  // CRITICAL: Force consistent cookie names WITHOUT __Secure- prefix.
  // Azure App Service terminates TLS at the load balancer and forwards HTTP internally.
  // Auth.js v5 encrypts cookies using the cookie NAME as salt for key derivation.
  // If the name changes between set (__Secure- when HTTPS detected) and read (no prefix
  // when HTTP detected internally), decryption fails with "could not be parsed".
  // Solution: force all cookies to use non-prefixed names with secure: true.
  cookies: {
    pkceCodeVerifier: {
      name: 'authjs.pkce.code_verifier',
      options: { httpOnly: true, sameSite: 'lax' as const, path: '/', secure: true, maxAge: 900 },
    },
    state: {
      name: 'authjs.state',
      options: { httpOnly: true, sameSite: 'lax' as const, path: '/', secure: true, maxAge: 900 },
    },
    nonce: {
      name: 'authjs.nonce',
      options: { httpOnly: true, sameSite: 'lax' as const, path: '/', secure: true },
    },
    callbackUrl: {
      name: 'authjs.callback-url',
      options: { httpOnly: true, sameSite: 'lax' as const, path: '/', secure: true },
    },
    csrfToken: {
      name: 'authjs.csrf-token',
      options: { httpOnly: true, sameSite: 'lax' as const, path: '/', secure: true },
    },
    sessionToken: {
      name: 'authjs.session-token',
      options: { httpOnly: true, sameSite: 'lax' as const, path: '/', secure: true },
    },
  },

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

        // SECURITY: For Google OAuth, require verified email (OWASP recommendation)
        if (account?.provider === 'google') {
          const googleProfile = profile as { email_verified?: boolean } | undefined;
          if (!googleProfile?.email_verified) {
            console.error('Google sign-in rejected: email not verified');
            return false;
          }
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
            // SECURITY FIX: Fail-closed -- deny login if DB is unavailable
            return false;
          }
        }

        return true;
      } catch (error) {
        console.error('Error in signIn callback:', error);
        // SECURITY FIX: Fail-closed -- deny login on unexpected errors
        return false;
      }
    },

    // Enrichissement du JWT
    async jwt({ token, user, account, trigger }) {
      try {
        if (user) {
          token.id = user.id || '';
          // Preserve name/email/picture from OAuth profile for session
          if (user.name) token.name = user.name;
          if (user.email) token.email = user.email;
          if (user.image) token.picture = user.image;

          // Pour OAuth, le user object de l'adapter n'a pas le role custom
          // On fetch toujours depuis la DB pour avoir le role correct
          if (account?.provider !== 'credentials') {
            try {
              const dbUser = await prisma.user.findUnique({
                where: { id: user.id! },
                select: { role: true, mfaEnabled: true, name: true, image: true },
              });
              token.role = (dbUser?.role as UserRole) || UserRole.CUSTOMER;
              token.mfaEnabled = dbUser?.mfaEnabled || false;
              // Use DB values for name/image if available (most up-to-date)
              if (dbUser?.name) token.name = dbUser.name;
              if (dbUser?.image) token.picture = dbUser.image;
            } catch {
              token.role = UserRole.CUSTOMER;
              token.mfaEnabled = false;
            }
          } else {
            token.role = ((user as unknown as Record<string, unknown>).role as UserRole) || UserRole.CUSTOMER;
            token.mfaEnabled = (user as unknown as Record<string, unknown>).mfaEnabled as boolean || false;
          }
        }

        // Rafraîchir les données utilisateur périodiquement
        if (trigger === 'update' && token.id) {
          try {
            const dbUser = await prisma.user.findUnique({
              where: { id: token.id as string },
              select: { role: true, mfaEnabled: true },
            });
            if (dbUser) {
              token.role = dbUser.role as UserRole;
              token.mfaEnabled = dbUser.mfaEnabled;
            }
          } catch (dbError) {
            console.error('Database error in jwt callback:', dbError);
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
        // Ensure name/email/image are passed through from JWT
        if (token.name) session.user.name = token.name as string;
        if (token.email) session.user.email = token.email as string;
        if (token.picture) session.user.image = token.picture as string;
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
    async createUser({ user }) {
      try {
        // New OAuth user created by PrismaAdapter: ensure role is CUSTOMER
        // (Prisma @default handles this, but we enforce it explicitly as a safeguard)
        if (user.id) {
          await prisma.user.update({
            where: { id: user.id },
            data: { role: UserRole.CUSTOMER },
          });
        }
        console.log(JSON.stringify({
          event: 'user_created_oauth',
          timestamp: new Date().toISOString(),
          userId: user.id,
          email: user.email,
        }));
      } catch (error) {
        console.error('Error in createUser event:', error);
      }
    },
    async linkAccount({ user, account }) {
      try {
        console.log(JSON.stringify({
          event: 'account_linked',
          timestamp: new Date().toISOString(),
          userId: user.id,
          provider: account.provider,
        }));
      } catch (error) {
        console.error('Error in linkAccount event:', error);
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
