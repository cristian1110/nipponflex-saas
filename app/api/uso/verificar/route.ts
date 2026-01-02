import { NextRequest, NextResponse } from 'next/server'
import { query, queryOne } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const { cantidad = 1 } = await request.json().catch(() => ({}))

    const cliente = await queryOne(`
      SELECT id, nombre, email, limite_mensajes_mes, mensajes_usados_mes,
             alerta_80_enviada, alerta_100_enviada, ultimo_reset_mes, plan
      FROM clientes WHERE id = $1
    `, [user.cliente_id])

    if (!cliente) {
      return NextResponse.json({ error: 'Cliente no encontrado' }, { status: 404 })
    }

    const hoy = new Date()
    const ultimoReset = cliente.ultimo_reset_mes ? new Date(cliente.ultimo_reset_mes) : new Date()
    
    if (hoy.getMonth() !== ultimoReset.getMonth() || hoy.getFullYear() !== ultimoReset.getFullYear()) {
      await query(`
        UPDATE clientes SET mensajes_usados_mes = 0, alerta_80_enviada = false, 
               alerta_100_enviada = false, ultimo_reset_mes = CURRENT_DATE
        WHERE id = $1
      `, [user.cliente_id])
      cliente.mensajes_usados_mes = 0
    }

    const limite = cliente.limite_mensajes_mes || 500
    const usado = cliente.mensajes_usados_mes || 0
    const nuevoUso = usado + cantidad
    const porcentaje = Math.round((nuevoUso / limite) * 100)

    if (nuevoUso > limite) {
      if (!cliente.alerta_100_enviada) {
        await query(`INSERT INTO alertas_uso (cliente_id, tipo, porcentaje, mensaje) VALUES ($1, 'limite', 100, $2)`,
          [user.cliente_id, `Límite de ${limite} mensajes alcanzado`])
        await query(`UPDATE clientes SET alerta_100_enviada = true WHERE id = $1`, [user.cliente_id])
      }
      return NextResponse.json({
        puede_enviar: false,
        razon: 'limite_alcanzado',
        mensaje: `Has alcanzado el límite de ${limite} mensajes. Contacta al administrador para actualizar tu plan.`,
        uso: { usado, limite, porcentaje: 100 }
      })
    }

    if (porcentaje >= 80 && !cliente.alerta_80_enviada) {
      await query(`INSERT INTO alertas_uso (cliente_id, tipo, porcentaje, mensaje) VALUES ($1, 'advertencia', 80, $2)`,
        [user.cliente_id, `80% de mensajes usados (${nuevoUso}/${limite})`])
      await query(`UPDATE clientes SET alerta_80_enviada = true WHERE id = $1`, [user.cliente_id])
    }

    await query(`UPDATE clientes SET mensajes_usados_mes = $1 WHERE id = $2`, [nuevoUso, user.cliente_id])

    return NextResponse.json({
      puede_enviar: true,
      uso: { usado: nuevoUso, limite, porcentaje, disponible: limite - nuevoUso },
      advertencia: porcentaje >= 80 ? `${porcentaje}% de mensajes usados` : null
    })
  } catch (error: any) {
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
