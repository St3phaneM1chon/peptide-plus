export const dynamic = 'force-dynamic';
/**
 * API - Seed Forum Categories
 * POST: Create the 5 default forum categories if they don't already exist.
 *
 * Uses upsert by slug to be idempotent (safe to call multiple times).
 * Should be called once during initial setup or after DB reset.
 *
 * SEC-FIX: Requires OWNER authentication to prevent unauthorized seeding.
 */

import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { auth } from '@/lib/auth-config';
import { apiSuccess, apiError } from '@/lib/api-response';
import { ErrorCode } from '@/lib/error-codes';

const DEFAULT_CATEGORIES = [
  {
    name: 'General Discussion',
    slug: 'general',
    description:
      'General conversations about peptides, research, and the community.',
    icon: '🗣️',
    sortOrder: 1,
  },
  {
    name: 'Research & Science',
    slug: 'research',
    description:
      'Share and discuss scientific research, studies, and publications on peptides.',
    icon: '🔬',
    sortOrder: 2,
  },
  {
    name: 'How-To & Guides',
    slug: 'howto',
    description:
      'Step-by-step guides, tutorials, and practical advice for peptide research.',
    icon: '📖',
    sortOrder: 3,
  },
  {
    name: 'Results & Experiences',
    slug: 'results',
    description:
      'Share your research results, experiences, and observations with the community.',
    icon: '📊',
    sortOrder: 4,
  },
  {
    name: 'Support & Help',
    slug: 'support',
    description:
      'Get help with orders, accounts, product questions, or technical issues.',
    icon: '🆘',
    sortOrder: 5,
  },
];

export async function POST(request: NextRequest) {
  try {
    // SEC-FIX: Require OWNER authentication — seeding categories is an admin-only action
    const session = await auth();
    if (!session?.user) {
      return apiError('Authentication required', ErrorCode.UNAUTHORIZED, { request });
    }
    if (session.user.role !== 'OWNER') {
      return apiError('Only the owner can seed forum categories', ErrorCode.FORBIDDEN, { request });
    }

    const results = await Promise.all(
      DEFAULT_CATEGORIES.map((cat) =>
        prisma.forumCategory.upsert({
          where: { slug: cat.slug },
          update: {
            // Update name, description, icon, sortOrder if category already exists
            name: cat.name,
            description: cat.description,
            icon: cat.icon,
            sortOrder: cat.sortOrder,
          },
          create: {
            name: cat.name,
            slug: cat.slug,
            description: cat.description,
            icon: cat.icon,
            sortOrder: cat.sortOrder,
          },
        })
      )
    );

    return apiSuccess(
      {
        message: `Seeded ${results.length} forum categories`,
        categories: results.map((cat) => ({
          id: cat.id,
          name: cat.name,
          slug: cat.slug,
          description: cat.description,
          icon: cat.icon,
          sortOrder: cat.sortOrder,
        })),
      },
      { status: 201, request }
    );
  } catch (error) {
    console.error('Error seeding forum categories:', error);
    return apiError(
      'Failed to seed forum categories',
      ErrorCode.INTERNAL_ERROR,
      { request }
    );
  }
}
