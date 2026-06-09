# QuickChat — Backend

API del servicio de mensajería en tiempo real **QuickChat** (estilo Messenger,
1:1). Este repositorio es el **backend** (NestJS + Socket.io + PostgreSQL). El
cliente vive en
[`quickchat-frontend`](https://github.com/pjimenez2510/quickchat-frontend).

## Stack

- **NestJS 11** + TypeScript (strict), arquitectura modular.
- **PostgreSQL** + **Prisma 7** (cliente en `src/generated`).
- **Socket.io 4** — gateway WebSocket (mensajería + señalización WebRTC).
- **Passport + JWT** (access + refresh tokens).
- **AWS S3** (multimedia) · **Giphy** (GIFs) · **Redis** (colas/escala).
- **Swagger/OpenAPI**, **Helmet**, `class-validator`/`class-transformer`.
- Cifrado de aplicación propio (**QCipher**) en transporte y at-rest.

## Requisitos

- Node.js ≥ 20
- PostgreSQL y Redis accesibles (o vía Docker Compose)

## Puesta en marcha

```bash
# 1. Dependencias
npm install

# 2. Entorno
cp .env.example .env          # rellena los valores (ver tabla abajo)

# 3. Base de datos (Prisma)
npx prisma migrate dev        # aplica migraciones
npx prisma generate           # genera el cliente (en src/generated)

# 4. Desarrollo (http://localhost:3002 por defecto)
npm run start:dev
```

Producción:

```bash
npm run build
npm run start:prod
```

API documentada (Swagger) en **`/api/docs`** (deshabilitado en producción).

## Variables de entorno

Ver [`.env.example`](.env.example). Resumen por grupos:

| Grupo | Variables |
|-------|-----------|
| Servidor | `NODE_ENV`, `PORT`, `API_PREFIX`, `CORS_ORIGINS` |
| Base de datos | `DATABASE_URL`, `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME` |
| Redis | `REDIS_URL`, `REDIS_HOST`, `REDIS_PORT` |
| JWT | `JWT_SECRET`, `JWT_ACCESS_EXPIRES_IN`, `JWT_REFRESH_SECRET`, `JWT_REFRESH_EXPIRES_IN` |
| AWS S3 | `AWS_S3_BUCKET`, `AWS_S3_REGION`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY` |
| Integraciones | `GIPHY_API_KEY`, `SENTRY_DSN` |
| WebSocket | `WS_PORT`, `WS_CORS_ORIGINS` |
| Límites | `MAX_FILE_SIZE_MB`, `MESSAGE_EDIT_TIME_LIMIT_MIN`, `MAX_PINNED_MESSAGES_PER_CONVERSATION` |
| **Cifrado** | `CRYPTO_TRANSPORT_KEY` (= `NEXT_PUBLIC_CRYPTO_TRANSPORT_KEY` del frontend), `CRYPTO_AT_REST_KEY` |

## Scripts

| Script | Acción |
|--------|--------|
| `npm run start:dev` | Servidor en watch mode |
| `npm run build` | Compilación (`nest build`) |
| `npm run start:prod` | Sirve la build |
| `npm test` | Tests unitarios (Jest) |
| `npm run test:e2e` | Tests end-to-end |
| `npm run lint` | ESLint |

## Arquitectura

Patrón por capas **Controller → Service → Repository** (Prisma), más el **gateway**
WebSocket y los **interceptors/filters** transversales (respuesta genérica,
cifrado, excepciones).

Módulos: `auth`, `users`, `contacts`, `blocked-users`, `conversations`,
`messages`, `calls`, `upload`.

Detalle completo (endpoints, eventos WebSocket, modelo de datos) en
**[`docs/architecture.md`](docs/architecture.md)**.

## Funcionalidades

- **Auth**: registro, login, refresh, logout, `GET /me` (JWT access + refresh).
- **Perfil y usuarios**: datos, avatar, estado online.
- **Contactos y bloqueos**.
- **Conversaciones 1:1**: listar, buscar, archivar, no leídos, último mensaje.
- **Mensajería**: texto y multimedia, responder, editar, eliminar (mí/todos),
  reaccionar, fijar, reenviar, buscar.
- **Tiempo real** (Socket.io): nuevos mensajes, estados (entregado/leído), typing,
  presencia online.
- **Llamadas WebRTC**: señalización (offer/answer/ICE) vía WebSocket.
- **Subida de multimedia** a S3 y **GIFs** vía Giphy.

## Seguridad y cifrado

- **Helmet**, CORS configurable, JWT con refresh, Swagger condicionado a entorno.
- **Cifrado de capa de aplicación (QCipher)** en dos capas (transporte + at-rest).

> ⚠️ **Importante:** el manejo actual de **contraseñas y refresh tokens usa cifrado
> reversible (no hashing bcrypt)**, lo cual es un **riesgo de seguridad conocido**.
> Lee la sección de seguridad de **[`docs/encryption.md`](docs/encryption.md)** antes
> de desplegar.

## Flujo de trabajo

- `main` protegida — todo cambio entra por **feature branch → PR → review → merge**.
- Conventional Commits.

## Licencia

Privado — QuickChat.
