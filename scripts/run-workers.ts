#!/usr/bin/env npx ts-node
/**
 * Script para ejecutar los workers de BullMQ
 * Ejecutar con: npx ts-node scripts/run-workers.ts
 * O en producción: node scripts/run-workers.js
 */

import { initWorkers, closeWorkers } from '../lib/workers'

console.log('='.repeat(50))
console.log('NipponFlex SaaS - Workers de Procesamiento')
console.log('='.repeat(50))

// Inicializar workers
initWorkers()

// Manejo de señales para cierre graceful
const shutdown = async (signal: string) => {
  console.log(`\n[${signal}] Cerrando workers...`)
  try {
    await closeWorkers()
    console.log('Workers cerrados correctamente')
    process.exit(0)
  } catch (error) {
    console.error('Error cerrando workers:', error)
    process.exit(1)
  }
}

process.on('SIGTERM', () => shutdown('SIGTERM'))
process.on('SIGINT', () => shutdown('SIGINT'))

console.log('Workers escuchando jobs...')
console.log('Presiona Ctrl+C para detener')
