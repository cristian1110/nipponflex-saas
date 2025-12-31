import { NextRequest, NextResponse } from 'next/server'
import { query, queryOne } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth'

export const dynamic = 'force-dynamic'

// Plantillas predefinidas
const PLANTILLAS = [
  {
    id: 'ventas',
    nombre: 'Ventas',
    descripcion: 'Pipeline estándar de ventas B2B/B2C',
    icono: '💰',
    color: '#3498db',
    etapas: ['Nuevo Lead', 'Contactado', 'Interesado', 'Cotización Enviada', 'Negociación', 'Cerrado Ganado', 'Cerrado Perdido']
  },
  {
    id: 'soporte',
    nombre: 'Soporte Técnico',
    descripcion: 'Gestión de tickets y soporte',
    icono: '🛠️',
    color: '#e74c3c',
    etapas: ['Ticket Nuevo', 'En Revisión', 'En Proceso', 'Esperando Cliente', 'Resuelto', 'Cerrado']
  },
  {
    id: 'inmobiliaria',
    nombre: 'Inmobiliaria',
    descripcion: 'Venta y alquiler de propiedades',
    icono: '🏠',
    color: '#27ae60',
    etapas: ['Interesado', 'Visita Programada', 'Visita Realizada', 'Documentación', 'Reserva', 'Escrituración', 'Entregado']
  },
  {
    id: 'reclutamiento',
    nombre: 'Reclutamiento',
    descripcion: 'Proceso de contratación de personal',
    icono: '👥',
    color: '#9b59b6',
    etapas: ['Aplicante', 'CV Revisado', 'Entrevista 1', 'Entrevista 2', 'Prueba Técnica', 'Oferta Enviada', 'Contratado', 'Rechazado']
  },
  {
    id: 'ecommerce',
    nombre: 'E-commerce',
    descripcion: 'Seguimiento de pedidos online',
    icono: '🛒',
    color: '#f39c12',
    etapas: ['Pedido Nuevo', 'Pago Confirmado', 'Preparando', 'Enviado', 'En Tránsito', 'Entregado', 'Devolución']
  },
  {
    id: 'educacion',
    nombre: 'Educación',
    descripcion: 'Inscripciones y matrículas',
    icono: '📚',
    color: '#1abc9c',
    etapas: ['Interesado', 'Info Enviada', 'Entrevista', 'Documentos', 'Pago Matrícula', 'Inscrito', 'No Interesado']
  },
  {
    id: 'eventos',
    nombre: 'Eventos',
    descripcion: 'Organización de eventos',
    icono: '🎉',
    color: '#e91e63',
    etapas: ['Cotización', 'Propuesta Enviada', 'Negociación', 'Contrato Firmado', 'Planificación', 'Evento Realizado', 'Cancelado']
  },
  {
    id: 'seguros',
    nombre: 'Seguros',
    descripcion: 'Venta de pólizas de seguro',
    icono: '🛡️',
    color: '#607d8b',
    etapas: ['Prospecto', 'Cotización', 'Propuesta', 'Documentos', 'Aprobación', 'Póliza Emitida', 'Rechazado']
  },
  {
    id: 'consultoria',
    nombre: 'Consultoría',
    descripcion: 'Proyectos de consultoría',
    icono: '💼',
    color: '#795548',
    etapas: ['Lead', 'Reunión Inicial', 'Propuesta', 'Negociación', 'Contrato', 'En Ejecución', 'Finalizado', 'Perdido']
  },
  {
    id: 'salud',
    nombre: 'Salud / Clínica',
    descripcion: 'Gestión de pacientes',
    icono: '🏥',
    color: '#00bcd4',
    etapas: ['Cita Solicitada', 'Cita Confirmada', 'En Consulta', 'Tratamiento', 'Seguimiento', 'Alta', 'Cancelado']
  }
]

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const { searchParams } = new URL(request.url)
    const plantillas = searchParams.get('plantillas')

    if (plantillas === 'true') {
      return NextResponse.json(PLANTILLAS)
    }

    const pipelines = await query(
      `SELECT p.*, 
        (SELECT COUNT(*) FROM leads l WHERE l.pipeline_id = p.id) as total_leads,
        (SELECT COUNT(*) FROM etapas_crm e WHERE e.pipeline_id = p.id) as total_etapas
       FROM pipelines p 
       WHERE p.cliente_id = $1 
       ORDER BY p.orden, p.created_at`,
      [user.cliente_id]
    )

    return NextResponse.json(pipelines)
  } catch (error) {
    console.error('Error pipelines:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const body = await request.json()
    const { nombre, descripcion, color, icono, plantilla_id } = body

    // Si es desde plantilla
    if (plantilla_id) {
      const plantilla = PLANTILLAS.find(p => p.id === plantilla_id)
      if (!plantilla) return NextResponse.json({ error: 'Plantilla no encontrada' }, { status: 400 })

      const pipeline = await queryOne(
        `INSERT INTO pipelines (cliente_id, nombre, descripcion, color, icono)
         VALUES ($1, $2, $3, $4, $5) RETURNING *`,
        [user.cliente_id, plantilla.nombre, plantilla.descripcion, plantilla.color, plantilla.icono]
      )

      // Crear etapas de la plantilla
      const colores = ['#9b59b6', '#3498db', '#f39c12', '#e67e22', '#1abc9c', '#27ae60', '#e74c3c', '#95a5a6']
      for (let i = 0; i < plantilla.etapas.length; i++) {
        const esGanado = plantilla.etapas[i].toLowerCase().includes('ganado') || 
                         plantilla.etapas[i].toLowerCase().includes('cerrado') ||
                         plantilla.etapas[i].toLowerCase().includes('resuelto') ||
                         plantilla.etapas[i].toLowerCase().includes('entregado') ||
                         plantilla.etapas[i].toLowerCase().includes('contratado') ||
                         plantilla.etapas[i].toLowerCase().includes('inscrito') ||
                         plantilla.etapas[i].toLowerCase().includes('finalizado') ||
                         plantilla.etapas[i].toLowerCase().includes('alta')
        const esPerdido = plantilla.etapas[i].toLowerCase().includes('perdido') || 
                          plantilla.etapas[i].toLowerCase().includes('rechazado') ||
                          plantilla.etapas[i].toLowerCase().includes('cancelado') ||
                          plantilla.etapas[i].toLowerCase().includes('devolución')
        
        await query(
          `INSERT INTO etapas_crm (cuenta_id, pipeline_id, nombre, color, orden, es_ganado, es_perdido)
           VALUES (1, $1, $2, $3, $4, $5, $6)`,
          [pipeline.id, plantilla.etapas[i], colores[i % colores.length], i + 1, esGanado, esPerdido]
        )
      }

      return NextResponse.json(pipeline, { status: 201 })
    }

    // Pipeline personalizado
    const pipeline = await queryOne(
      `INSERT INTO pipelines (cliente_id, nombre, descripcion, color, icono)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [user.cliente_id, nombre, descripcion || '', color || '#3498db', icono || '📊']
    )

    return NextResponse.json(pipeline, { status: 201 })
  } catch (error) {
    console.error('Error crear pipeline:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const body = await request.json()
    const { id, nombre, descripcion, color, icono } = body

    await query(
      `UPDATE pipelines SET nombre = $1, descripcion = $2, color = $3, icono = $4 
       WHERE id = $5 AND cliente_id = $6`,
      [nombre, descripcion, color, icono, id, user.cliente_id]
    )

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error actualizar pipeline:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    // Eliminar leads del pipeline
    await query(`DELETE FROM leads WHERE pipeline_id = $1`, [id])
    // Eliminar etapas del pipeline
    await query(`DELETE FROM etapas_crm WHERE pipeline_id = $1`, [id])
    // Eliminar pipeline
    await query(`DELETE FROM pipelines WHERE id = $1 AND cliente_id = $2`, [id, user.cliente_id])

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error eliminar pipeline:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
