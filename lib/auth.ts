import jwt from 'jsonwebtoken'
import bcrypt from 'bcryptjs'
import { cookies } from 'next/headers'
import { query, queryOne } from './db'

const JWT_SECRET = process.env.JWT_SECRET || 'nipponflex_jwt_secret_2024'
const TOKEN_EXPIRY = '7d'

export interface JWTPayload {
  userId: number
  email: string
  rol: string
  nivel: number
  clienteId?: number
}

export interface Usuario {
  id: number
  email: string
  nombre: string
  apellido?: string
  telefono?: string
  rol: string
  nivel: number
  cliente_id?: number
  cliente_nombre?: string
  estado: string
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12)
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash)
}

export function generateToken(payload: JWTPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: TOKEN_EXPIRY })
}

export function verifyToken(token: string): JWTPayload | null {
  try {
    return jwt.verify(token, JWT_SECRET) as JWTPayload
  } catch {
    return null
  }
}

export async function getCurrentUser(): Promise<(Usuario & { debe_cambiar_password?: boolean }) | null> {
  try {
    const cookieStore = await cookies()
    const token = cookieStore.get('auth_token')?.value

    if (!token) return null

    const payload = verifyToken(token)
    if (!payload) return null

    const user = await queryOne<any>(
      `SELECT u.id, u.email, u.nombre, u.apellido, u.telefono, u.cliente_id, u.estado, u.debe_cambiar_password,
              r.nombre as rol, r.nivel,
              c.nombre_empresa as cliente_nombre,
              c.limite_usuarios, c.limite_contactos, c.limite_agentes, c.limite_mensajes_mes
       FROM usuarios u
       LEFT JOIN roles r ON u.rol_id = r.id
       LEFT JOIN clientes c ON u.cliente_id = c.id
       WHERE u.id = $1 AND u.estado = 'activo'`,
      [payload.userId]
    )

    return user
  } catch {
    return null
  }
}

export async function login(email: string, password: string): Promise<{ user: Usuario & { debe_cambiar_password?: boolean }; token: string } | null> {
  const user = await queryOne<any>(
    `SELECT u.id, u.email, u.password_hash, u.nombre, u.apellido, u.telefono, u.cliente_id, u.estado, u.debe_cambiar_password,
            r.nombre as rol, r.nivel,
            c.nombre_empresa as cliente_nombre
     FROM usuarios u
     LEFT JOIN roles r ON u.rol_id = r.id
     LEFT JOIN clientes c ON u.cliente_id = c.id
     WHERE u.email = $1 AND u.estado = 'activo'`,
    [email.toLowerCase()]
  )

  if (!user) return null

  const valid = await verifyPassword(password, user.password_hash)
  if (!valid) return null

  const token = generateToken({
    userId: user.id,
    email: user.email,
    rol: user.rol,
    nivel: user.nivel,
    clienteId: user.cliente_id,
  })

  // Actualizar ultimo_login
  await query(`UPDATE usuarios SET ultimo_login = NOW() WHERE id = $1`, [user.id])

  const { password_hash, ...userWithoutPassword } = user
  return { user: userWithoutPassword, token }
}

export function requireRole(user: Usuario | null, minLevel: number): boolean {
  if (!user) return false
  return user.nivel >= minLevel
}

export function requireSameClient(user: Usuario | null, clienteId: number): boolean {
  if (!user) return false
  if (user.nivel >= 100) return true // SuperAdmin
  return user.cliente_id === clienteId
}
