export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { withAdminGuard } from '@/lib/admin-api-guard';
import { prisma } from '@/lib/db';
import { z } from 'zod';

const actionSchema = z.object({
  action: z.enum(['start', 'stop']),
  projectId: z.string().optional(),
  description: z.string().max(500).optional(),
});

export const GET = withAdminGuard(async () => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const weekStart = new Date(today);
    weekStart.setDate(weekStart.getDate() - weekStart.getDay());

    const [runningTimer, todayEntries, weekEntries] = await Promise.all([
      prisma.timeEntry.findFirst({ where: { endTime: null }, orderBy: { startTime: 'desc' } }),
      prisma.timeEntry.findMany({ where: { startTime: { gte: today } }, orderBy: { startTime: 'desc' } }),
      prisma.timeEntry.findMany({ where: { startTime: { gte: weekStart } }, select: { hoursWorked: true } }),
    ]);

    const todayTotal = todayEntries.reduce((s, e) => s + Number(e.hoursWorked || 0), 0);
    const weekTotal = weekEntries.reduce((s, e) => s + Number(e.hoursWorked || 0), 0);

    return NextResponse.json({
      running: runningTimer ? {
        id: runningTimer.id,
        startTime: runningTimer.startTime?.toISOString() || null,
        projectName: runningTimer.projectName || null,
        description: runningTimer.description,
      } : null,
      todayEntries: todayEntries.map(e => ({
        id: e.id,
        description: e.description,
        startTime: e.startTime?.toISOString() || null,
        endTime: e.endTime?.toISOString() || null,
        duration: Number(e.hoursWorked || 0),
        projectName: e.projectName || null,
      })),
      todayTotal,
      weekTotal,
    });
  } catch (error) {
    return NextResponse.json({ error: 'Erreur récupération temps' }, { status: 500 });
  }
});

export const POST = withAdminGuard(async (request) => {
  try {
    const body = await request.json();
    const { action, projectId, description } = actionSchema.parse(body);

    if (action === 'start') {
      // Stop any running timer first
      const running = await prisma.timeEntry.findFirst({ where: { endTime: null } });
      if (running && running.startTime) {
        const hoursWorked = Math.round((Date.now() - running.startTime.getTime()) / 60000) / 60;
        await prisma.timeEntry.update({ where: { id: running.id }, data: { endTime: new Date(), hoursWorked } });
      }
      const entry = await prisma.timeEntry.create({
        data: { startTime: new Date(), description: description || 'Timer mobile', projectId: projectId || undefined, userName: 'Mobile User', hoursWorked: 0 },
      });
      return NextResponse.json(entry, { status: 201 });
    } else {
      const running = await prisma.timeEntry.findFirst({ where: { endTime: null } });
      if (!running) return NextResponse.json({ error: 'Aucun timer actif' }, { status: 404 });
      const hoursWorked = running.startTime ? Math.round((Date.now() - running.startTime.getTime()) / 60000) / 60 : 0;
      const entry = await prisma.timeEntry.update({ where: { id: running.id }, data: { endTime: new Date(), hoursWorked } });
      return NextResponse.json(entry);
    }
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Données invalides' }, { status: 400 });
    }
    return NextResponse.json({ error: 'Erreur timer' }, { status: 500 });
  }
});
