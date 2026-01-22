/**
 * ADMIN CHAT DASHBOARD
 * Gestion des conversations support
 */

import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth-config';
import { prisma } from '@/lib/db';
import { UserRole } from '@/types';
import { ChatDashboard } from './ChatDashboard';

async function getConversationStats() {
  const [open, pending, resolved, total] = await Promise.all([
    prisma.conversation.count({ where: { status: 'OPEN' } }),
    prisma.conversation.count({ where: { status: 'PENDING' } }),
    prisma.conversation.count({ where: { status: 'RESOLVED' } }),
    prisma.conversation.count(),
  ]);

  const unread = await prisma.conversation.aggregate({
    _sum: { unreadCount: true },
  });

  return {
    open,
    pending,
    resolved,
    total,
    unread: unread._sum.unreadCount || 0,
  };
}

async function getAgents() {
  return prisma.user.findMany({
    where: {
      role: { in: ['EMPLOYEE', 'OWNER'] },
    },
    select: {
      id: true,
      name: true,
      email: true,
      image: true,
      _count: {
        select: {
          assignedChats: {
            where: { status: { in: ['OPEN', 'PENDING'] } },
          },
        },
      },
    },
  });
}

async function getQuickReplies() {
  return prisma.quickReply.findMany({
    where: { isActive: true },
    orderBy: { sortOrder: 'asc' },
  });
}

export default async function AdminChatPage() {
  const session = await auth();

  if (!session?.user) {
    redirect('/auth/signin?callbackUrl=/admin/chat');
  }

  if (![UserRole.EMPLOYEE, UserRole.OWNER].includes(session.user.role as UserRole)) {
    redirect('/');
  }

  const [stats, agents, quickReplies] = await Promise.all([
    getConversationStats(),
    getAgents(),
    getQuickReplies(),
  ]);

  return (
    <ChatDashboard
      initialStats={stats}
      agents={agents}
      quickReplies={quickReplies}
      currentUserId={session.user.id}
    />
  );
}
