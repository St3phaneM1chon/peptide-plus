export const dynamic = 'force-dynamic';

/**
 * ROUTE NEXTAUTH
 * Gestion de l'authentification
 */

import { handlers } from '@/lib/auth-config';

export const { GET, POST } = handlers;
