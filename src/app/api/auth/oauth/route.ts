import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { SignJWT } from 'jose'

const JWT_SECRET = new TextEncoder().encode(
  process.env.NEXTAUTH_SECRET || 'fallback-secret-change-me'
)

async function generateToken(userId: string, email: string) {
  return await new SignJWT({ sub: userId, email })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('30d')
    .sign(JWT_SECRET)
}

function formatUser(user: any) {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role?.toLowerCase() || 'customer',
    image: user.image,
    mfaEnabled: user.mfaEnabled || false,
    phone: user.phone,
    locale: user.locale || 'fr',
    authProvider: user.accounts?.[0]?.provider || 'oauth',
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { provider, idToken, accessToken, email, fullName } = body

    if (!provider || !email) {
      return NextResponse.json(
        { message: 'Provider et email requis' },
        { status: 400 }
      )
    }

    // Find or create user
    let user = await prisma.user.findUnique({
      where: { email },
      include: { accounts: { select: { provider: true } } },
    })

    if (!user) {
      user = await prisma.user.create({
        data: {
          email,
          name: fullName || email.split('@')[0],
          emailVerified: new Date(),
          role: 'EMPLOYEE',
          locale: 'fr',
          accounts: {
            create: {
              type: 'oauth',
              provider,
              providerAccountId: email,
              id_token: idToken,
              access_token: accessToken,
            },
          },
        },
        include: { accounts: { select: { provider: true } } },
      })
    } else {
      // Link account if not already linked
      const existingAccount = await prisma.account.findFirst({
        where: { userId: user.id, provider },
      })
      if (!existingAccount) {
        await prisma.account.create({
          data: {
            userId: user.id,
            type: 'oauth',
            provider,
            providerAccountId: email,
            id_token: idToken,
            access_token: accessToken,
          },
        })
      }
    }

    const token = await generateToken(user.id, user.email)

    return NextResponse.json({
      token,
      user: formatUser(user),
      requiresMfa: false,
    })
  } catch (error: any) {
    console.error('[API] /auth/oauth error:', error)
    return NextResponse.json(
      { message: error.message || 'Erreur serveur' },
      { status: 500 }
    )
  }
}
