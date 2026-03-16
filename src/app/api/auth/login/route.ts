import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import bcrypt from 'bcryptjs'
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
    authProvider: 'email',
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { email, password } = body

    if (!email || !password) {
      return NextResponse.json(
        { message: 'Email et mot de passe requis' },
        { status: 400 }
      )
    }

    const user = await prisma.user.findUnique({
      where: { email },
    })

    if (!user || !user.password) {
      return NextResponse.json(
        { message: 'Email ou mot de passe incorrect' },
        { status: 401 }
      )
    }

    const valid = await bcrypt.compare(password, user.password)
    if (!valid) {
      return NextResponse.json(
        { message: 'Email ou mot de passe incorrect' },
        { status: 401 }
      )
    }

    const token = await generateToken(user.id, user.email)

    return NextResponse.json({
      token,
      user: formatUser(user),
      requiresMfa: false,
    })
  } catch (error: any) {
    console.error('[API] /auth/login error:', error)
    return NextResponse.json(
      { message: error.message || 'Erreur serveur' },
      { status: 500 }
    )
  }
}
