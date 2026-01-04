import { NextRequest, NextResponse } from 'next/server'
import { query, queryOne, execute } from '@/lib/db'
import { getCurrentUser, hashPassword } from '@/lib/auth'
import { sendEmail } from '@/lib/email'
import { enviarMensajeWhatsApp } from '@/lib/evolution'
import crypto from 'crypto'

export const dynamic = 'force-dynamic'

// Generar contraseña aleatoria segura
function generarPassword(longitud: number = 10): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789'
  let password = ''
  for (let i = 0; i < longitud; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return password
}

// GET - Listar usuarios
export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    let usuarios
    if (user.nivel >= 100) {
      // Super admin ve todos
      usuarios = await query(
        `SELECT u.id, u.nombre, u.email, u.telefono, u.estado, u.debe_cambiar_password, u.ultimo_login, u.created_at,
                r.nombre as rol, r.nivel,
                c.nombre_empresa as cliente_nombre
         FROM usuarios u
         LEFT JOIN roles r ON u.rol_id = r.id
         LEFT JOIN clientes c ON u.cliente_id = c.id
         ORDER BY u.created_at DESC`
      )
    } else {
      // Admin normal ve solo los de su cuenta
      usuarios = await query(
        `SELECT u.id, u.nombre, u.email, u.telefono, u.estado, u.debe_cambiar_password, u.ultimo_login, u.created_at,
                r.nombre as rol, r.nivel
         FROM usuarios u
         LEFT JOIN roles r ON u.rol_id = r.id
         WHERE u.cliente_id = $1
         ORDER BY u.created_at DESC`,
        [user.cliente_id]
      )
    }

    return NextResponse.json(usuarios)
  } catch (error) {
    console.error('Error:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

// POST - Crear nuevo usuario directamente
export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    // Solo admin o superadmin pueden crear usuarios
    if (user.nivel < 50) {
      return NextResponse.json({ error: 'No tienes permisos para crear usuarios' }, { status: 403 })
    }

    const body = await request.json()
    const { nombre, email, telefono, rol_id, cliente_id } = body

    if (!nombre || !email) {
      return NextResponse.json({ error: 'Nombre y email son requeridos' }, { status: 400 })
    }

    // Verificar que el email no exista
    const existeEmail = await queryOne(
      `SELECT id FROM usuarios WHERE email = $1`,
      [email.toLowerCase()]
    )
    if (existeEmail) {
      return NextResponse.json({ error: 'Este email ya esta registrado' }, { status: 400 })
    }

    // Determinar cliente_id
    let targetClienteId = cliente_id
    if (user.nivel < 100) {
      // Admin normal solo puede crear para su propio cliente
      targetClienteId = user.cliente_id
    }

    // Verificar límite de usuarios del plan
    if (user.nivel < 100) {
      const clienteInfo = await queryOne(
        `SELECT c.limite_usuarios, p.max_usuarios,
                (SELECT COUNT(*) FROM usuarios WHERE cliente_id = c.id) as usuarios_actuales
         FROM clientes c
         LEFT JOIN planes p ON c.plan_id = p.id
         WHERE c.id = $1`,
        [targetClienteId]
      )

      const limiteUsuarios = clienteInfo?.limite_usuarios || clienteInfo?.max_usuarios || 5
      if (parseInt(clienteInfo?.usuarios_actuales || '0') >= limiteUsuarios) {
        return NextResponse.json({
          error: `Has alcanzado el limite de ${limiteUsuarios} usuarios de tu plan`
        }, { status: 400 })
      }
    }

    // Generar contraseña temporal
    const passwordTemporal = generarPassword(10)
    const passwordHash = await hashPassword(passwordTemporal)

    // Determinar rol (por defecto operador si no se especifica)
    let targetRolId = rol_id
    if (!targetRolId) {
      const rolDefault = await queryOne(`SELECT id FROM roles WHERE nombre = 'operador'`)
      targetRolId = rolDefault?.id || 4
    }

    // Verificar que solo super admin puede crear super admins
    if (targetRolId) {
      const rolInfo = await queryOne(`SELECT nivel FROM roles WHERE id = $1`, [targetRolId])
      if (rolInfo?.nivel >= 100 && user.nivel < 100) {
        return NextResponse.json({ error: 'No tienes permisos para crear usuarios super admin' }, { status: 403 })
      }
    }

    // Crear usuario
    const nuevoUsuario = await queryOne(
      `INSERT INTO usuarios (cliente_id, nombre, email, telefono, password_hash, rol_id, estado, debe_cambiar_password, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, 'activo', true, NOW())
       RETURNING id, nombre, email, telefono`,
      [targetClienteId, nombre, email.toLowerCase(), telefono || null, passwordHash, targetRolId]
    )

    if (!nuevoUsuario) {
      return NextResponse.json({ error: 'Error al crear usuario' }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      usuario: nuevoUsuario,
      credenciales: {
        email: email.toLowerCase(),
        password: passwordTemporal
      },
      mensaje: 'Usuario creado. Debe cambiar su contrasena en el primer inicio de sesion.'
    })
  } catch (error) {
    console.error('Error creando usuario:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

// PUT - Actualizar usuario
export async function PUT(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const body = await request.json()
    const { id, nombre, telefono, rol_id, estado } = body

    if (!id) {
      return NextResponse.json({ error: 'ID requerido' }, { status: 400 })
    }

    // Verificar que el usuario pertenezca al mismo cliente (o sea superadmin)
    if (user.nivel < 100) {
      const targetUser = await queryOne(
        `SELECT cliente_id FROM usuarios WHERE id = $1`,
        [id]
      )
      if (targetUser?.cliente_id !== user.cliente_id) {
        return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
      }
    }

    await execute(
      `UPDATE usuarios SET
        nombre = COALESCE($2, nombre),
        telefono = COALESCE($3, telefono),
        rol_id = COALESCE($4, rol_id),
        estado = COALESCE($5, estado),
        updated_at = NOW()
       WHERE id = $1`,
      [id, nombre, telefono, rol_id, estado]
    )

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

// DELETE - Desactivar usuario
export async function DELETE(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json({ error: 'ID requerido' }, { status: 400 })
    }

    // No permitir eliminarse a si mismo
    if (parseInt(id) === user.id) {
      return NextResponse.json({ error: 'No puedes desactivar tu propia cuenta' }, { status: 400 })
    }

    // Verificar permisos
    if (user.nivel < 100) {
      const targetUser = await queryOne(
        `SELECT cliente_id, r.nivel FROM usuarios u
         LEFT JOIN roles r ON u.rol_id = r.id
         WHERE u.id = $1`,
        [id]
      )
      if (targetUser?.cliente_id !== user.cliente_id) {
        return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
      }
      // No puede desactivar a alguien de mayor nivel
      if (targetUser?.nivel >= user.nivel) {
        return NextResponse.json({ error: 'No puedes desactivar a un usuario de igual o mayor nivel' }, { status: 403 })
      }
    }

    await execute(
      `UPDATE usuarios SET estado = 'inactivo', updated_at = NOW() WHERE id = $1`,
      [id]
    )

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
