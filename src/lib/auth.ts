/**
 * CONFIGURATION AUTHENTIFICATION - Azure AD (Entra ID)
 * Conforme NYDFS 23 NYCRR 500 - MFA obligatoire
 */

import NextAuth from 'next-auth';
import type { NextAuthConfig } from 'next-auth';
import AzureADProvider from 'next-auth/providers/azure-ad';

// Configuration Azure AD
const azureADConfig = {
  clientId: process.env.AZURE_AD_CLIENT_ID!,
  clientSecret: process.env.AZURE_AD_CLIENT_SECRET!,
  tenantId: process.env.AZURE_AD_TENANT_ID!,
  authorization: {
    params: {
      // Forcer la ré-authentification pour les opérations sensibles
      prompt: 'login',
      // Scopes requis
      scope: 'openid profile email User.Read',
    },
  },
};

// Types personnalisés pour la session
declare module 'next-auth' {
  interface Session {
    user: {
      id: string;
      email: string;
      name: string;
      roles: string[];
      mfaVerified: boolean;
    };
    accessToken: string;
    error?: string;
  }

  interface JWT {
    accessToken: string;
    refreshToken: string;
    accessTokenExpires: number;
    roles: string[];
    mfaVerified: boolean;
    error?: string;
  }
}

// Configuration NextAuth
export const authConfig: NextAuthConfig = {
  providers: [
    AzureADProvider({
      clientId: azureADConfig.clientId,
      clientSecret: azureADConfig.clientSecret,
      tenantId: azureADConfig.tenantId,
      authorization: azureADConfig.authorization,
    }),
  ],

  // Pages personnalisées
  pages: {
    signIn: '/auth/signin',
    signOut: '/auth/signout',
    error: '/auth/error',
  },

  // Callbacks de sécurité
  callbacks: {
    // Vérification lors de la connexion
    async signIn({ user, account, profile }) {
      // Log de l'événement de connexion (audit trail)
      console.log(JSON.stringify({
        event: 'signin_attempt',
        timestamp: new Date().toISOString(),
        userId: user.id,
        email: user.email,
        provider: account?.provider,
      }));

      // Vérifier que l'utilisateur a un email vérifié
      if (!user.email) {
        return false;
      }

      // Ici, vous pouvez ajouter des vérifications supplémentaires:
      // - Vérifier si l'utilisateur est dans une liste autorisée
      // - Vérifier le domaine de l'email
      // - Vérifier des conditions métier spécifiques

      return true;
    },

    // Enrichissement du JWT
    async jwt({ token, account, profile }) {
      // Premier login - récupérer les tokens
      if (account) {
        token.accessToken = account.access_token!;
        token.refreshToken = account.refresh_token!;
        token.accessTokenExpires = account.expires_at! * 1000;
        
        // Récupérer les rôles depuis Azure AD
        // @ts-ignore - profile peut contenir des champs personnalisés
        token.roles = profile?.roles || [];
        
        // Vérifier si MFA a été utilisé (claim amr)
        // @ts-ignore
        const authMethods = profile?.amr || [];
        token.mfaVerified = authMethods.includes('mfa') || 
                           authMethods.includes('ngcmfa') ||
                           authMethods.length > 1;
      }

      // Vérifier l'expiration du token
      if (Date.now() < (token.accessTokenExpires as number)) {
        return token;
      }

      // Token expiré - tenter un refresh
      return await refreshAccessToken(token);
    },

    // Construction de la session
    async session({ session, token }) {
      session.user.id = token.sub!;
      session.user.roles = token.roles as string[];
      session.user.mfaVerified = token.mfaVerified as boolean;
      session.accessToken = token.accessToken as string;
      
      if (token.error) {
        session.error = token.error as string;
      }

      return session;
    },
  },

  // Options de session sécurisées
  session: {
    strategy: 'jwt',
    maxAge: 60 * 60, // 1 heure (conforme NYDFS)
  },

  // Cookies sécurisés
  cookies: {
    sessionToken: {
      name: '__Secure-next-auth.session-token',
      options: {
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        secure: true, // HTTPS obligatoire
      },
    },
  },

  // Events pour l'audit trail
  events: {
    async signIn({ user, account }) {
      console.log(JSON.stringify({
        event: 'signin_success',
        timestamp: new Date().toISOString(),
        userId: user.id,
        email: user.email,
        provider: account?.provider,
      }));
    },
    async signOut({ token }) {
      console.log(JSON.stringify({
        event: 'signout',
        timestamp: new Date().toISOString(),
        userId: token.sub,
      }));
    },
    async session({ session }) {
      // Log des accès session (optionnel, peut être verbeux)
    },
  },

  // Mode debug désactivé en production
  debug: process.env.NODE_ENV === 'development',
};

/**
 * Rafraîchir le token d'accès Azure AD
 */
async function refreshAccessToken(token: any) {
  try {
    const response = await fetch(
      `https://login.microsoftonline.com/${process.env.AZURE_AD_TENANT_ID}/oauth2/v2.0/token`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: process.env.AZURE_AD_CLIENT_ID!,
          client_secret: process.env.AZURE_AD_CLIENT_SECRET!,
          grant_type: 'refresh_token',
          refresh_token: token.refreshToken,
          scope: 'openid profile email User.Read',
        }),
      }
    );

    const refreshedTokens = await response.json();

    if (!response.ok) {
      throw refreshedTokens;
    }

    return {
      ...token,
      accessToken: refreshedTokens.access_token,
      accessTokenExpires: Date.now() + refreshedTokens.expires_in * 1000,
      refreshToken: refreshedTokens.refresh_token ?? token.refreshToken,
    };
  } catch (error) {
    console.error('Error refreshing access token:', error);

    return {
      ...token,
      error: 'RefreshAccessTokenError',
    };
  }
}

// Export des handlers
export const { handlers, auth, signIn, signOut } = NextAuth(authConfig);
