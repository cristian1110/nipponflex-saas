import { NextRequest, NextResponse } from 'next/server'
import { queryOne } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth'
import { sendEmail } from '@/lib/email'
import { enviarMensajeWhatsApp } from '@/lib/evolution'

export const dynamic = 'force-dynamic'

// POST - Enviar credenciales por email o WhatsApp
export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    if (user.nivel < 50) {
      return NextResponse.json({ error: 'No tienes permisos' }, { status: 403 })
    }

    const body = await request.json()
    const { usuario_id, email, password, metodo, telefono } = body

    if (!email || !password || !metodo) {
      return NextResponse.json({ error: 'Datos incompletos' }, { status: 400 })
    }

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://nipponflex.84.247.166.88.sslip.io'

    if (metodo === 'email') {
      // Enviar por email
      const emailResult = await sendEmail({
        to: email,
        subject: 'Tus credenciales de acceso - NipponFlex',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #111827; border-radius: 16px; overflow: hidden;">
            <div style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); padding: 40px; text-align: center;">
              <h1 style="color: white; margin: 0; font-size: 28px;">NipponFlex</h1>
              <p style="color: rgba(255,255,255,0.9); margin-top: 10px;">Tu asistente IA para WhatsApp</p>
            </div>
            <div style="padding: 40px; background: #1f2937;">
              <h2 style="color: #10b981; margin-top: 0;">Bienvenido!</h2>
              <p style="color: #d1d5db; font-size: 16px; line-height: 1.6;">Tu cuenta ha sido creada. Aqui estan tus credenciales de acceso:</p>
              <div style="background: #374151; border-radius: 8px; padding: 20px; margin: 20px 0;">
                <p style="color: #9ca3af; margin: 0 0 10px 0; font-size: 14px;">Email:</p>
                <p style="color: #10b981; margin: 0 0 20px 0; font-size: 18px; font-weight: bold;">${email}</p>
                <p style="color: #9ca3af; margin: 0 0 10px 0; font-size: 14px;">Contrasena temporal:</p>
                <p style="color: #10b981; margin: 0; font-size: 18px; font-weight: bold; font-family: monospace;">${password}</p>
              </div>
              <p style="color: #fbbf24; font-size: 14px;">* Deberas cambiar tu contrasena en el primer inicio de sesion.</p>
              <div style="text-align: center; margin: 30px 0;">
                <a href="${baseUrl}/login" style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: white; padding: 15px 40px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 16px; display: inline-block;">
                  INICIAR SESION
                </a>
              </div>
            </div>
          </div>
        `
      })

      return NextResponse.json({
        success: emailResult.success,
        mensaje: emailResult.success
          ? 'Credenciales enviadas por email'
          : 'Error al enviar email (verifica configuracion SMTP)'
      })
    }

    if (metodo === 'whatsapp') {
      if (!telefono) {
        return NextResponse.json({ error: 'Telefono requerido para WhatsApp' }, { status: 400 })
      }

      // Buscar instancia de WhatsApp del admin
      const instancia = await queryOne(
        `SELECT iw.evolution_instance, iw.evolution_api_key
         FROM instancias_whatsapp iw
         WHERE iw.cliente_id = $1 AND iw.estado = 'conectado'
         LIMIT 1`,
        [user.cliente_id]
      )

      if (!instancia) {
        return NextResponse.json({
          error: 'No tienes WhatsApp conectado. Conecta tu WhatsApp primero.'
        }, { status: 400 })
      }

      const mensaje = `*NipponFlex - Credenciales de Acceso*

Hola! Tu cuenta ha sido creada.

*Email:* ${email}
*Contrasena:* ${password}

Ingresa en: ${baseUrl}/login

_Deberas cambiar tu contrasena en el primer inicio de sesion._`

      const resultado = await enviarMensajeWhatsApp({
        instancia: instancia.evolution_instance,
        apiKey: instancia.evolution_api_key || process.env.EVOLUTION_API_KEY || '',
        numero: telefono,
        mensaje
      })

      return NextResponse.json({
        success: resultado.success,
        mensaje: resultado.success
          ? 'Credenciales enviadas por WhatsApp'
          : 'Error al enviar WhatsApp: ' + resultado.error
      })
    }

    return NextResponse.json({ error: 'Metodo no valido' }, { status: 400 })
  } catch (error) {
    console.error('Error enviando credenciales:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
