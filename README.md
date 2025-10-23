# RFID Access Control

Aplicación fullstack basada en Next.js para gestionar accesos con lectores RFID Zebra FX9600.

## Características principales

- API REST (`POST /api/rfid`) para registrar lecturas procedentes del lector FX9600.
- Broadcast en tiempo real de nuevos eventos usando Socket.IO.
- Dashboard con tarjetas métricas y actividad reciente actualizada al instante.
- Integración con PostgreSQL mediante `pg`.

## Flujo de control de acceso y GPO

1. Se recibe el evento RFID y se normaliza el payload (JSON, XML o texto plano).
2. Se valida la autorización consultando las tablas `personas`, `objetos`, `asignaciones_activos`, `puertas`, `rfid_lectores`, `rfid_antenas` y `door_io_map`.
3. Se genera auditoría en `movimientos.extra.accessControl` con el detalle de la decisión y la fuente de cada entidad.
4. Si procede, se envía un pulso GPO al lector FX9600, respetando el anti-rebote configurado en `door_io_map`.
5. La respuesta se publica en tiempo real (Socket.IO) y queda registrada para consultas posteriores en el dashboard (`/dashboard/api-test`).

## Variables de entorno adicionales

- `FX9600_PROTOCOL` / `FX9600_PORT`: protocolo y puerto para construir la URL del lector (por defecto `http` y vacío).
- `FX9600_GPO_URL_TEMPLATE`: plantilla de URL con placeholders `{readerIp}` y `{pin}` para apuntar al endpoint del FX9600.
- `FX9600_GPO_HTTP_METHOD`: método HTTP a utilizar (`POST` por defecto).
- `FX9600_GPO_BODY_TEMPLATE`: plantilla opcional para el cuerpo de la solicitud (usa `{{pulseMs}}`, `{{postState}}`, `{{gpoPin}}`, `{{readerIp}}`).
- `FX9600_DEFAULT_PULSE_MS` / `FX9600_HTTP_TIMEOUT_MS`: duración por defecto del pulso y timeout de la petición.
- `FX9600_USERNAME` / `FX9600_PASSWORD`: credenciales básicas para el lector FX9600.
- `ACCESS_ALLOWED_OBJECT_STATES`: lista separada por comas con estados válidos para permitir acceso (por defecto `activo,active,en_servicio`).
- `ACCESS_REQUIRE_ASSIGNMENT`: controla si es obligatorio que persona y objeto tengan una asignación vigente (por defecto `true`).

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
