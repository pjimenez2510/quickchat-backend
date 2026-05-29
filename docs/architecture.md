# QuickChat Backend — Arquitectura y funcionalidades

Referencia para que cualquier desarrollador entienda **qué hace** el backend, sus
**módulos/endpoints**, el **tiempo real** y el **modelo de datos**.

## Visión general

API del servicio de mensajería QuickChat (estilo Messenger, **1:1**). Expone una
**API REST** y un **gateway WebSocket** (Socket.io) para mensajería en tiempo real
y señalización de llamadas WebRTC. Toda la comunicación va **cifrada a nivel de
aplicación** (ver [`encryption.md`](encryption.md)).

## Stack

- **NestJS 11** + TypeScript (strict), arquitectura modular.
- **PostgreSQL** + **Prisma 7** (cliente generado en `src/generated`).
- **Socket.io 4** (gateway WebSocket).
- **Passport + JWT** (access + refresh tokens).
- **AWS S3** (subida de multimedia), **Giphy** (GIFs).
- **Swagger/OpenAPI** (`@nestjs/swagger`), **Helmet**, `class-validator`.
- **Redis** (configurado para colas/escala).

## Patrón por capas (obligatorio)

```
Controller  → recibe request, valida DTO, llama al service, devuelve respuesta
Service     → lógica de negocio / orquestación
Repository  → acceso a datos vía Prisma
```
Más el **gateway** WebSocket para eventos en tiempo real y los **interceptors/filters**
transversales (respuesta genérica, cifrado, excepciones).

## Respuesta genérica

Todas las respuestas REST siguen el formato (antes de cifrarse):

```jsonc
// éxito
{ "statusCode": 200, "message": "...", "data": { /*…*/ }, "timestamp": "ISO" }
// error
{ "statusCode": 400, "message": "...", "error": "BadRequest", "timestamp": "ISO" }
```

Generado por `TransformResponseInterceptor` y `HttpExceptionFilter`. Después se
**cifra** con la clave de transporte (ver encryption.md), por lo que en el cable se
ve `{ v, iv, ct }`.

## Módulos y endpoints REST

Prefijo global de API según `API_PREFIX`. Documentación interactiva en **`/api/docs`**
(Swagger, solo fuera de producción).

| Módulo | Prefijo | Responsabilidad |
|--------|---------|-----------------|
| `auth` | `/auth` | Registro, login, refresh, logout, `GET /me` |
| `users` | `/users` | Perfil de usuario, actualización, avatar |
| `contacts` | `/contacts` | Gestión de contactos |
| `blocked-users` | `/blocked-users` | Bloquear / desbloquear usuarios |
| `conversations` | `/conversations` | Listar, buscar, archivar, no leídos |
| `messages` | `/messages` | Historial, búsqueda, fijados, acciones |
| `calls` | `/calls` | Registro/estado de llamadas |
| `upload` | `/upload` | Subida de multimedia a S3 |

> La lista exacta de rutas, parámetros y DTOs está en **Swagger (`/api/docs`)**,
> generado automáticamente desde los decoradores `@nestjs/swagger`.

## Tiempo real — Gateway WebSocket (`ChatGateway`)

Autenticación por `socket.handshake.auth.token` (JWT). Todos los payloads van
cifrados (`WsCryptoInterceptor` + `encryptTransport` en los broadcasts).

### Eventos cliente → servidor (`@SubscribeMessage`)
| Evento | Propósito |
|--------|-----------|
| `message:send` | Enviar mensaje |
| `message:edit` | Editar mensaje |
| `message:delete` | Eliminar mensaje |
| `message:forward` | Reenviar mensaje |
| `message:reaction` | Reaccionar |
| `message:read` | Marcar como leído |
| `typing:start` / `typing:stop` | Indicador de escritura |
| `call:initiate` / `call:answer` / `call:reject` / `call:end` | Control de llamada |
| `call:offer` / `call:answer-sdp` / `call:ice-candidate` | Señalización WebRTC |
| `ping` | Keep-alive |

### Eventos servidor → cliente (`server.emit` / `client.emit`)
`message:new`, `message:updated`, `message:deleted`, `message:delivered`,
`message:read`, `message:reaction`, `user:typing`, `user:online`,
`call:incoming`, `call:accepted`, `call:rejected`, `call:ended`, `call:offer`,
`call:answer-sdp`, `call:ice-candidate`.

> El flujo detallado de señalización WebRTC está documentado en el frontend:
> `quickchat-frontend/docs/features.md` (sección *Llamadas (WebRTC)*).

## Modelo de datos (Prisma)

Modelos en `prisma/schema.prisma` (tablas y columnas en `snake_case`):

| Modelo | Descripción |
|--------|-------------|
| `User` | Usuario (credenciales, perfil, estado online) |
| `RefreshToken` | Tokens de refresco emitidos |
| `Contact` | Relación de contacto entre usuarios |
| `BlockedUser` | Bloqueos entre usuarios |
| `Conversation` | Conversación 1:1 (incluye `last_message`) |
| `Message` | Mensaje (texto/multimedia), `content`, tipo, `reply_to`, fijado |
| `DeletedMessage` | "Eliminar para mí" (por usuario) |
| `MessageReaction` | Reacciones (emoji) por usuario |
| `Call` | Registro de llamadas |

Campos cifrados en BD: ver [`encryption.md`](encryption.md) (`Message.content`,
`User.password`, `RefreshToken.token_hash`).

## Seguridad

- **Helmet**, CORS configurable (`CORS_ORIGINS`).
- **JWT** access + refresh; `GET /me` consulta la BD.
- **Swagger** condicionado a entorno (no en producción).
- **Cifrado de capa de aplicación** (transporte + at-rest) — ver
  [`encryption.md`](encryption.md), incluida la **advertencia crítica** sobre el
  almacenamiento reversible de contraseñas/refresh tokens.

## Variables de entorno

Ver [`.env.example`](../.env.example). Grupos principales: servidor
(`NODE_ENV`, `PORT`, `API_PREFIX`, `CORS_ORIGINS`), base de datos (`DATABASE_URL`,
`DB_*`), Redis (`REDIS_*`), JWT (`JWT_SECRET`, `JWT_REFRESH_SECRET`, expiraciones),
AWS S3 (`AWS_*`), Giphy (`GIPHY_API_KEY`), WebSocket (`WS_*`), límites
(`MAX_FILE_SIZE_MB`, `MESSAGE_EDIT_TIME_LIMIT_MIN`, `MAX_PINNED_MESSAGES_PER_CONVERSATION`),
y **cifrado** (`CRYPTO_TRANSPORT_KEY`, `CRYPTO_AT_REST_KEY`).
