/**
 * CONFIGURATION AUTHENTIFICATION MULTI-PROVIDERS
 * Google, Apple, X (Twitter), Shopify, Email/Password + MFA
 */

import NextAuth from 'next-auth';
import type { NextAuthConfig } from 'next-auth';
import GoogleProvider from 'next-auth/providers/google';
import AppleProvider from 'next-auth/providers/apple';
import TwitterProvider from 'next-auth/providers/twitter';
import CredentialsProvider from 'next-auth/providers/credentials';
import { PrismaAdapter } from '@auth/prisma-adapter';
import { compare } from 'bcryptjs';
import { prisma } from './db';
import { UserRole } from '@/types';
import { logger } from '@/lib/logger';
import { encryptToken } from './token-encryption';

// TODO: FAILLE-085 - Replace 'any' with proper type: import type { Provider } from 'next-auth/providers'
// TODO: FAILLE-086 - Cookie name forced to authjs.session-token (no __Secure- prefix) for Azure; review when Azure supports HTTPS E2E
// TODO: FAILLE-091 - encryptedAdapter cast as any; type correctly or use 'satisfies' for partial verification
// TODO: FAILLE-092 - signOut event logs userId but not IP/user-agent; add for suspicious logout tracing
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AuthProvider = any;

// =====================================================
// CONFIGURATION DES PROVIDERS (conditionnels)
// =====================================================

// Providers OAuth (ajoutés seulement si configurés)
//
// SECURITY FIX (BE-SEC-13): allowDangerousEmailAccountLinking
// Only enabled for TRUSTED providers that verify email ownership:
//   - Google: We enforce email_verified in signIn callback
//   - Apple: Apple always verifies email ownership
// REMOVED from Facebook and Twitter to prevent account takeover:
//   - Facebook: email_verified is unreliable
//   - Twitter/X: does not reliably return email at all
const oauthProviders: AuthProvider[] = [
  // Google (TRUSTED - email_verified enforced in signIn callback)
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

  // Apple — email is verified by Apple, but we no longer enable dangerous linking
  // to reduce attack surface. Only Google retains it (needed for Gmail account merging).
  ...(process.env.APPLE_CLIENT_ID && process.env.APPLE_CLIENT_SECRET
    ? [
        AppleProvider({
          clientId: process.env.APPLE_CLIENT_ID,
          clientSecret: process.env.APPLE_CLIENT_SECRET,
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
          // SECURITY: allowDangerousEmailAccountLinking removed - Twitter email is unreliable
          profile({ data }) {
            return {
              id: data.id,
              name: data.name,
              // FAILLE-034 FIX: Use RFC 6761 .invalid TLD instead of a real domain
              email: data.email ?? `twitter_${data.id}@noreply.invalid`,
              image: data.profile_image_url ?? null,
              // Augmented User fields (role/mfaEnabled set from DB in jwt callback)
              role: UserRole.CUSTOMER,
              mfaEnabled: false,
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
    async authorize(credentials) {
      // NextAuth v5 beta: returning null shows "CredentialsSignin" error
      // throwing Error shows "Configuration" error (misleading)
      // So we return null for all auth failures
      if (!credentials?.email || !credentials?.password) {
        return null;
      }

      const email = String(credentials.email).toLowerCase();
      const password = String(credentials.password);

      try {
        // SECURITY: Check brute-force lockout before any DB query
        const { checkLoginAttempt, recordFailedAttempt, clearFailedAttempts } = await import('./brute-force-protection');
        const lockCheck = await checkLoginAttempt(email, 'unknown', 'unknown');
        if (!lockCheck.allowed) {
          return null;
        }

        const user = await prisma.user.findUnique({
          where: { email },
        });

        if (!user || !user.password) {
          await recordFailedAttempt(email, 'unknown', 'unknown');
          return null;
        }

        const isPasswordValid = await compare(password, user.password);

        if (!isPasswordValid) {
          await recordFailedAttempt(email, 'unknown', 'unknown');
          return null;
        }

        // Si MFA activé, vérifier le code
        if (user.mfaEnabled) {
          if (!credentials.mfaCode) {
            // Return null - frontend should handle MFA flow separately
            return null;
          }

          const { verifyTOTP } = await import('./mfa');
          let mfaSecret: string;
          try {
            const { decrypt } = await import('./security');
            mfaSecret = await decrypt(user.mfaSecret!);
          } catch (decryptError) {
            // SECURITY (FAILLE-003): Never fall back to raw secret.
            // On decryption failure, auth fails and user must re-setup MFA.
            logger.error('MFA: decryption failed. User must re-setup MFA.', { error: decryptError instanceof Error ? decryptError.message : String(decryptError) });
            return null;
          }

          const isValidMFA = verifyTOTP(
            mfaSecret,
            String(credentials.mfaCode)
          );

          if (!isValidMFA) {
            return null;
          }
        }

        // SECURITY: Clear failed attempts on successful login
        clearFailedAttempts(email);

        // Return user object
        return {
          id: user.id,
          email: user.email,
          name: user.name,
          image: user.image,
          role: user.role,
          mfaEnabled: user.mfaEnabled,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } as any;
      } catch (error) {
        logger.error('[auth] authorize error', { error: error instanceof Error ? error.message : String(error) });
        return null;
      }
    },
  }),
];

// =====================================================
// CONFIGURATION NEXTAUTH
// =====================================================

// Wrap PrismaAdapter to encrypt OAuth tokens before storing in DB
const baseAdapter = PrismaAdapter(prisma);
const encryptedAdapter = {
  ...baseAdapter,
  linkAccount: async (account: Parameters<NonNullable<typeof baseAdapter.linkAccount>>[0]) => {
    const encryptedAccount = {
      ...account,
      access_token: (await encryptToken(account.access_token ?? null)) ?? undefined,
      refresh_token: (await encryptToken(account.refresh_token ?? null)) ?? undefined,
      id_token: (await encryptToken(account.id_token ?? null)) ?? undefined,
    };
    return baseAdapter.linkAccount!(encryptedAccount);
  },
};

export const authConfig: NextAuthConfig = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  adapter: encryptedAdapter as any,
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
        // Log d'audit (FAILLE-021 FIX: mask email in logs)
        const maskedEmail = user.email
          ? user.email.replace(/^(.{2}).*(@.*)$/, '$1***$2')
          : undefined;
        logger.info('signin_attempt', {
            userId: user.id,
            email: maskedEmail,
            provider: account?.provider,
        });

        // SECURITY: For Google OAuth, require verified email (OWASP recommendation)
        if (account?.provider === 'google') {
          const googleProfile = profile as { email_verified?: boolean } | undefined;
          if (!googleProfile?.email_verified) {
            logger.error('Google sign-in rejected: email not verified');
            return false;
          }
        }

        // Pour les providers OAuth, vérifier l'utilisateur
        if (account?.provider !== 'credentials') {
          // FAILLE-075 FIX: Reject OAuth login if email is null/undefined
          if (!user.email) {
            logger.error('OAuth sign-in rejected: no email from provider', { provider: account?.provider });
            return false;
          }
          try {
            const existingUser = await prisma.user.findUnique({
              where: { email: user.email },
              select: { id: true, mfaEnabled: true, termsAcceptedAt: true },
            });

            // RGPD: If OAuth user hasn't accepted terms, redirect to accept-terms page
            // This covers new OAuth signups and existing users who never accepted terms.
            // We allow the signIn to proceed (user is authenticated) but flag
            // the need for terms acceptance in the JWT callback below.
            if (!existingUser || !existingUser.mfaEnabled) {
              // Permettre la connexion, MFA optionnel
              // TODO: FAILLE-053 - If existingUser has MFA enabled, OAuth login should redirect to MFA verification page
              return true;
            }
          } catch (dbError) {
            logger.error('Database error in signIn', { error: dbError instanceof Error ? dbError.message : String(dbError) });
            // SECURITY FIX: Fail-closed -- deny login if DB is unavailable
            return false;
          }
        }

        return true;
      } catch (error) {
        logger.error('Error in signIn callback', { error: error instanceof Error ? error.message : String(error) });
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
                select: { role: true, mfaEnabled: true, name: true, image: true, termsAcceptedAt: true },
              });
              token.role = (dbUser?.role as UserRole) || UserRole.CUSTOMER;
              token.mfaEnabled = dbUser?.mfaEnabled || false;
              // SECURITY FIX (FAILLE-059): OAuth users who have MFA enabled have NOT
              // verified MFA at this point. Mark as unverified so the session callback
              // propagates the correct state. They must complete MFA separately.
              token.mfaVerified = !(dbUser?.mfaEnabled);
              // RGPD: Flag OAuth users who haven't accepted terms yet
              token.needsTerms = !dbUser?.termsAcceptedAt;
              // Use DB values for name/image if available (most up-to-date)
              if (dbUser?.name) token.name = dbUser.name;
              if (dbUser?.image) token.picture = dbUser.image;
            } catch (error) {
              console.error('[AuthConfig] Failed to fetch user data for JWT token:', error);
              token.role = UserRole.CUSTOMER;
              token.mfaEnabled = false;
              token.mfaVerified = false;
              token.needsTerms = true;
            }
          } else {
            token.role = ((user as unknown as Record<string, unknown>).role as UserRole) || UserRole.CUSTOMER;
            token.mfaEnabled = (user as unknown as Record<string, unknown>).mfaEnabled as boolean || false;
            // SECURITY FIX (FAILLE-059): For credentials provider, MFA was already
            // verified during the authorize() call if mfaEnabled is true (the code
            // in authorize() validates the TOTP code). So if we reach here, MFA is verified.
            // If MFA is not enabled, mfaVerified is trivially true (no MFA to verify).
            token.mfaVerified = true;
          }
        }

        // Rafraîchir les données utilisateur périodiquement
        // TODO: FAILLE-054 - Role JWT is only refreshed on trigger 'update'. Consider adding periodic re-fetch
        //       (e.g., every 5 minutes based on token.iat) to detect role changes made by other admins.
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
            logger.error('Database error in jwt callback', { error: dbError instanceof Error ? dbError.message : String(dbError) });
          }
        }

        return token;
      } catch (error) {
        logger.error('Error in jwt callback', { error: error instanceof Error ? error.message : String(error) });
        return token;
      }
    },

    // Construction de la session
    async session({ session, token }) {
      if (token) {
        session.user.id = token.id as string;
        session.user.role = token.role as UserRole;
        session.user.mfaEnabled = token.mfaEnabled as boolean;
        // SECURITY FIX (FAILLE-059): Propagate actual MFA verification state from JWT.
        // For credentials login: MFA was verified in authorize() before token was issued.
        // For OAuth login: mfaVerified is false if user has MFA enabled but didn't verify yet.
        session.user.mfaVerified = (token.mfaVerified as boolean) ?? false;
        session.user.needsTerms = (token.needsTerms as boolean) || false;
        // Ensure name/email/image are passed through from JWT
        if (token.name) session.user.name = token.name as string;
        if (token.email) session.user.email = token.email as string;
        if (token.picture) session.user.image = token.picture as string;

        // SECURITY (FAILLE-006): Record user activity for session security tracking
        try {
          const { recordUserActivity } = await import('./session-security');
          recordUserActivity(token.id as string);
        } catch (error) {
          console.error('[AuthConfig] Session security activity recording failed (non-blocking):', error);
        }
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
        // FAILLE-021 FIX: mask email in logs
        const maskedEmail = user.email
          ? user.email.replace(/^(.{2}).*(@.*)$/, '$1***$2')
          : undefined;
        logger.info('signin_success', {
          userId: user.id,
          email: maskedEmail,
          provider: account?.provider,
        });

        // SECURITY (FAILLE-006): Record session creation for security tracking
        // FAILLE-001 FIX: Integrate enforceMaxSessions to limit concurrent sessions (NYDFS compliance)
        if (user.id) {
          try {
            const { recordSessionCreation, enforceMaxSessions } = await import('./session-security');
            recordSessionCreation(user.id);
            await enforceMaxSessions(user.id, 3);
          } catch (error) {
            logger.error('Session security recording failed (non-blocking)', { error: error instanceof Error ? error.message : String(error) });
          }
        }
      } catch (error) {
        // FAILLE-074 FIX: Use structured logger instead of console.error
        logger.error('Error in signIn event', { error: error instanceof Error ? error.message : String(error) });
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
        // FAILLE-021 FIX: mask email in logs
        const maskedNewEmail = user.email
          ? user.email.replace(/^(.{2}).*(@.*)$/, '$1***$2')
          : undefined;
        logger.info('user_created_oauth', {
          userId: user.id,
          email: maskedNewEmail,
        });
      } catch (error) {
        // FAILLE-074 FIX: Use structured logger instead of console.error
        logger.error('Error in createUser event', { error: error instanceof Error ? error.message : String(error) });
      }
    },
    async linkAccount({ user, account }) {
      try {
        logger.info('account_linked', {
          userId: user.id,
          provider: account.provider,
        });
      } catch (error) {
        // FAILLE-074 FIX: Use structured logger instead of console.error
        logger.error('Error in linkAccount event', { error: error instanceof Error ? error.message : String(error) });
      }
    },
    async signOut(message) {
      try {
        const tokenId = 'token' in message ? (message.token as { id?: string })?.id : undefined;
        logger.info('signout', {
          userId: tokenId,
        });
      } catch (error) {
        // FAILLE-074 FIX: Use structured logger instead of console.error
        logger.error('Error in signOut event', { error: error instanceof Error ? error.message : String(error) });
      }
    },
  },

  // FAILLE-100 FIX: Use dedicated env var to avoid accidental debug in production
  debug: process.env.AUTH_DEBUG === 'true',
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
      needsTerms: boolean;
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
    mfaVerified: boolean;
    needsTerms: boolean;
  }
}

export const { handlers, auth, signIn, signOut } = NextAuth(authConfig);
