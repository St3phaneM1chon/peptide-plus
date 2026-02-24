export const dynamic = 'force-dynamic';

/**
 * Public API - Returns enabled communication platforms with their public links
 * Used by the contact page to show Zoom/WhatsApp/Teams buttons dynamically
 */

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

const PLATFORMS = ['zoom', 'whatsapp', 'teams'] as const;

export async function GET() {
  try {
    const settings = await prisma.siteSetting.findMany({
      where: {
        module: 'integrations',
        key: {
          in: PLATFORMS.flatMap(p => [
            `integration.${p}.enabled`,
            `integration.${p}.publicLink`,
          ]),
        },
      },
    });

    const getVal = (key: string) => settings.find(s => s.key === key)?.value || '';

    const platforms = PLATFORMS
      .filter(p => getVal(`integration.${p}.enabled`) === 'true')
      .filter(p => getVal(`integration.${p}.publicLink`))
      .map(p => ({
        id: p,
        link: getVal(`integration.${p}.publicLink`),
      }));

    return NextResponse.json({ platforms });
  } catch {
    return NextResponse.json({ platforms: [] });
  }
}
