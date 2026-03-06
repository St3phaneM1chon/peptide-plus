export const dynamic = 'force-dynamic';

/**
 * Post-Call Surveys Page - CRUD survey configurations.
 */

import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth-config';
import { prisma } from '@/lib/db';
import { UserRole } from '@/types';
import SondagesClient from './SondagesClient';

export default async function SondagesPage() {
  const session = await auth();
  if (!session?.user || (session.user.role !== UserRole.EMPLOYEE && session.user.role !== UserRole.OWNER)) {
    redirect('/auth/signin');
  }

  // Fetch survey configs from SiteSetting
  const surveySettings = await prisma.siteSetting.findMany({
    where: { module: 'voip', key: { startsWith: 'voip:survey_config:' } },
    orderBy: { createdAt: 'desc' },
    take: 50,
  });

  // Parse survey configs from SiteSetting values
  const surveys = surveySettings.map((s) => {
    try {
      return { id: s.id, key: s.key, ...JSON.parse(s.value) };
    } catch {
      return { id: s.id, key: s.key, name: s.key, questions: [], active: false };
    }
  });

  // Fetch survey result stats
  const surveyResults = await prisma.callSurvey.groupBy({
    by: ['method'],
    _count: { id: true },
    _avg: { overallScore: true },
  });

  return (
    <SondagesClient
      surveys={JSON.parse(JSON.stringify(surveys))}
      resultStats={JSON.parse(JSON.stringify(surveyResults))}
    />
  );
}
