# RFID Access Control

Aplicación fullstack basada en Next.js para gestionar accesos con lectores RFID Zebra FX9600.

## Características principales

- API REST (`POST /api/rfid`) para registrar lecturas procedentes del lector FX9600.
- Broadcast en tiempo real de nuevos eventos usando Socket.IO.
- Dashboard con tarjetas métricas y actividad reciente actualizada al instante.
- Integración con PostgreSQL mediante `pg`.

## Requisitos

- Node.js 18+ (se recomienda 20 LTS).
- PNPM 8+.
- Base de datos PostgreSQL accesible mediante la variable de entorno `DATABASE_URL`.

## Puesta en marcha

```bash
pnpm install
pnpm dev
```

Crea o actualiza tu archivo `.env.local` con las credenciales de la base de datos y cualquier otra variable necesaria.

## Envío de lecturas de prueba

```bash
curl -X POST http://localhost:3000/api/rfid \
  -H "Content-Type: application/json" \
  -d '{
    "epc": "300833B2DDD9014000000000",
    "lectorId": 5,
    "puertaId": 3,
    "timestamp": "2025-10-18T19:32:10.123Z",
    "tipo": "Acceso concedido"
  }'
```

## Despliegue

Configura la variable `NEXT_PUBLIC_APP_ORIGIN` para definir el origen permitido de Socket.IO en producción.

Si tus tablas viven en un esquema distinto a `public` (por ejemplo `tenant_base`), define la variable `PG_SCHEMA` para que la aplicación ajuste automáticamente el `search_path` de PostgreSQL.
