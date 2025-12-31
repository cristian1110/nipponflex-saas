#!/bin/bash

# ============================================
# NipponFlex AI SaaS - Script de Despliegue
# ============================================

set -e

echo "🚀 Iniciando despliegue de NipponFlex AI SaaS..."

# Colores
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Verificar Docker
if ! command -v docker &> /dev/null; then
    echo -e "${RED}❌ Docker no está instalado${NC}"
    exit 1
fi

if ! command -v docker-compose &> /dev/null; then
    echo -e "${RED}❌ Docker Compose no está instalado${NC}"
    exit 1
fi

# Verificar .env
if [ ! -f .env ]; then
    echo -e "${YELLOW}⚠️  Archivo .env no encontrado. Copiando desde .env.example...${NC}"
    cp .env.example .env
    echo -e "${YELLOW}📝 Por favor, edita .env con tus valores antes de continuar.${NC}"
    echo -e "${YELLOW}   nano .env${NC}"
    exit 1
fi

# Cargar variables
source .env

# Verificar variables críticas
if [ -z "$DB_PASSWORD" ] || [ "$DB_PASSWORD" = "cambiar_por_password_seguro" ]; then
    echo -e "${RED}❌ Por favor configura DB_PASSWORD en .env${NC}"
    exit 1
fi

if [ -z "$JWT_SECRET" ] || [ ${#JWT_SECRET} -lt 32 ]; then
    echo -e "${RED}❌ JWT_SECRET debe tener al menos 32 caracteres${NC}"
    exit 1
fi

# Crear directorios necesarios
echo -e "${GREEN}📁 Creando directorios...${NC}"
mkdir -p database

# Detener contenedores existentes
echo -e "${YELLOW}🛑 Deteniendo contenedores existentes...${NC}"
docker-compose down 2>/dev/null || true

# Construir imagen
echo -e "${GREEN}🔨 Construyendo imagen de la aplicación...${NC}"
docker-compose build

# Iniciar servicios
echo -e "${GREEN}▶️  Iniciando servicios...${NC}"
docker-compose up -d

# Esperar a que PostgreSQL esté listo
echo -e "${YELLOW}⏳ Esperando a PostgreSQL...${NC}"
sleep 10

# Verificar estado
echo -e "${GREEN}✅ Verificando estado de los servicios...${NC}"
docker-compose ps

# Mostrar URLs
echo ""
echo -e "${GREEN}============================================${NC}"
echo -e "${GREEN}🎉 ¡Despliegue completado!${NC}"
echo -e "${GREEN}============================================${NC}"
echo ""
echo -e "📱 App:          ${YELLOW}https://${DOMAIN}${NC}"
echo -e "📱 Evolution:    ${YELLOW}https://evolution.${DOMAIN}${NC}"
echo -e "📱 n8n:          ${YELLOW}https://n8n.${DOMAIN}${NC}"
echo -e "📱 Qdrant:       ${YELLOW}https://qdrant.${DOMAIN}${NC}"
echo ""
echo -e "${GREEN}Próximos pasos:${NC}"
echo "1. Registra tu cuenta en https://${DOMAIN}/registro"
echo "2. Configura WhatsApp en Integraciones"
echo "3. Crea tu primer agente IA"
echo ""
echo -e "${YELLOW}📋 Comandos útiles:${NC}"
echo "  Ver logs:        docker-compose logs -f"
echo "  Reiniciar:       docker-compose restart"
echo "  Detener:         docker-compose down"
echo "  Ver estado:      docker-compose ps"
