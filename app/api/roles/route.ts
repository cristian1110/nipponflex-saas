import { NextResponse } from 'next/server'
import { query } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    const roles = await query(`SELECT id, nombre, nivel FROM roles ORDER BY nivel DESC`)
    return NextResponse.json(roles)
  } catch (error) {
    return NextResponse.json([
      { id: 1, nombre: 'superadmin', nivel: 100 },
      { id: 2, nombre: 'admin', nivel: 50 },
      { id: 3, nombre: 'supervisor', nivel: 30 },
      { id: 4, nombre: 'operador', nivel: 20 },
      { id: 5, nombre: 'vendedor', nivel: 10 }
    ])
  }
}
