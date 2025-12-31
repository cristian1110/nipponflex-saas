# Cómo restaurar el proyecto

## Opción 1: Desde GitHub (solo código)
```bash
cd ~
git clone https://github.com/cristian1110/nipponflex-saas.git
cd nipponflex-saas
# Copiar .env manualmente
docker-compose up -d --build
```

## Opción 2: Desde Mega (código + BD completa)
```bash
mega-login 'email' 'password'
mega-get /NipponFlex-Backups/nipponflex_full_FECHA.tar.gz
tar -xzf nipponflex_full_FECHA.tar.gz
cd nipponflex_full_FECHA
./RESTORE.sh
```

## Verificar funcionamiento
```bash
docker ps
docker logs nipponflex-saas-app --tail 20
curl -I https://nipponflex.84.247.166.88.sslip.io
```
