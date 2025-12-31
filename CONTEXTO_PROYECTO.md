# NipponFlex SaaS - Contexto del Proyecto

## INFORMACIÓN DEL SERVIDOR
- **VPS**: 84.247.166.88
- **URL App**: https://nipponflex.84.247.166.88.sslip.io
- **PostgreSQL**: 84.247.166.88:5432 (container: postgres-nipponflex)
- **Docker App**: nipponflex-saas-app
- **Directorio**: /root/nipponflex-saas
- **GitHub**: https://github.com/cristian1110/nipponflex-saas

## CREDENCIALES
- **Superadmin**: estrategiacrisss1110@gmail.com
- **DB User**: nipponflex_admin
- **DB Name**: nipponflex_saas

## SERVICIOS EXTERNOS
- **Evolution API**: https://evolution-api-nipponflex.84.247.166.88.sslip.io
- **Instancia WhatsApp**: nipponflex (conectada a 593992635319)
- **n8n**: Configurado con flujo de agente IA
- **Groq AI**: Para respuestas automáticas
- **Mega Backup**: Backups diarios a las 3AM

## STACK TECNOLÓGICO
- Next.js 14 + TypeScript
- PostgreSQL
- Docker + Docker Compose
- Evolution API (WhatsApp)
- n8n (Automatizaciones)
- Groq AI (LLM)

## TABLAS PRINCIPALES DE BD
- clientes, usuarios, roles
- contactos (2794 registros)
- leads, etapas_crm, pipelines
- historial_conversaciones
- citas, calendario
- configuracion_agente, conocimientos
- campanias, campania_contactos

## FUNCIONALIDADES COMPLETADAS ✅
1. Login/Autenticación JWT
2. Dashboard con estadísticas
3. CRM con Pipelines (10 plantillas estilo Kommo)
4. Gestión de Contactos (importar Excel, editar, paginar)
5. Leads (crear nuevo o desde contactos, drag & drop)
6. Conversaciones WhatsApp (polling 3 seg, tiempo real)
7. Calendario con citas
8. Usuarios y roles
9. Integración WhatsApp (conectar/desconectar/QR)
10. Backups automáticos (Mega + GitHub)

## FUNCIONALIDADES PENDIENTES 🔧
1. **Agentes IA** - Página para configurar prompt, personalidad, conocimientos
2. **Campañas** - Envío masivo gradual anti-ban
3. **Automatizaciones** - Triggers visuales desde el SaaS
4. **Recordatorios de citas** - Workflow n8n
5. **Notificaciones** - Avisar al usuario de citas/ventas
6. **Detección "No interesa"** - Mover a Cerrado Perdido

## FLUJO N8N ACTUAL
- Webhook recibe mensaje WhatsApp
- Anti-bucle evita duplicados
- Carga config agente + conocimientos
- Groq AI genera respuesta
- Detecta y agenda citas automáticamente
- Guarda en historial_conversaciones
- Crea/actualiza leads
- Mueve a "Interesado" si agenda cita

## COMANDOS ÚTILES
```bash
# Reconstruir app
cd ~/nipponflex-saas && docker-compose down && docker-compose build --no-cache && docker-compose up -d

# Ver logs
docker logs nipponflex-saas-app --tail 50

# Acceder a BD
docker exec postgres-nipponflex psql -U nipponflex_admin -d nipponflex_saas

# Backup manual
~/backup-full-nipponflex.sh

# Push a GitHub
cd ~/nipponflex-saas && git add . && git commit -m "mensaje" && git push
```

## ESTRUCTURA DE ARCHIVOS PRINCIPALES
```
/root/nipponflex-saas/
├── app/
│   ├── api/
│   │   ├── auth/ (login, registro, me)
│   │   ├── contactos/ (CRUD + importar)
│   │   ├── conversaciones/
│   │   ├── crm/ (leads, etapas)
│   │   ├── mensajes/
│   │   ├── pipelines/
│   │   └── ...
│   ├── crm/page.tsx (CRM completo)
│   ├── conversaciones/page.tsx
│   ├── calendario/page.tsx
│   ├── usuarios/page.tsx
│   └── ...
├── components/
│   └── Sidebar.tsx
├── lib/
│   ├── db.ts
│   └── auth.ts
├── docker-compose.yml
└── .env
```

## NOTAS IMPORTANTES
- etapas_crm es la tabla correcta (NO etapas_pipeline)
- Los leads se relacionan con etapas_crm
- El polling de conversaciones es cada 3 segundos
- Backups en Mega: /NipponFlex-Backups/
