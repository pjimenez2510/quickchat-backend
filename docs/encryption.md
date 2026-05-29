# Cifrado de capa de aplicación (QCipher)

QuickChat aplica cifrado **a nivel de aplicación** con un algoritmo simétrico
propio, **QCipher**, en **dos capas independientes y con claves distintas**:

| Capa | Clave | Qué cifra | Dónde |
|------|-------|-----------|-------|
| **Transporte** | `CRYPTO_TRANSPORT_KEY` (compartida con el frontend) | El payload completo de **toda** request/response HTTP y de los eventos WebSocket | Interceptors globales |
| **En reposo (at-rest)** | `CRYPTO_AT_REST_KEY` (solo backend) | Campos sensibles en la **base de datos** | Repositorios y `auth.service` |

> ⚠️ **Lee la [sección de seguridad](#-seguridad-importante-léelo).** QCipher es un
> cifrado **didáctico**, y las **contraseñas y refresh tokens se guardan cifrados de
> forma reversible** (no hasheados). Esto es un riesgo conocido y documentado.

## El algoritmo: QCipher

`src/common/crypto/qcipher.ts` (espejo exacto de
`quickchat-frontend/src/lib/crypto/qcipher.ts`). Es un **cifrado de flujo
simétrico**: deriva un *keystream* a partir de `clave + IV` (usando una S-box de
256 entradas, rotaciones de bits y aritmética módulo 256) y hace XOR con el texto.

- Sobre (envelope): `{ "v": 1, "iv": "<base64 8 bytes>", "ct": "<base64>" }`.
- IV aleatorio de 8 bytes por operación → el mismo texto produce cifrados distintos.
- Cifrar y descifrar son la misma operación (XOR con keystream).

`src/common/crypto/keys.ts` expone las funciones de alto nivel:
`encryptTransport` / `decryptTransport` (clave de transporte) y
`encryptAtRest` / `decryptAtRest` (clave at-rest).

## Capa 1 — Cifrado de transporte

Cifra el **cuerpo completo** de cada mensaje entre cliente y servidor. Es
transparente: los handlers trabajan con objetos en claro.

**HTTP** (interceptors globales, registrados en `src/main.ts`):
- `DecryptRequestInterceptor` — descifra el `body` entrante si es un sobre QCipher.
- `EncryptResponseInterceptor` — cifra la respuesta **después** de que
  `TransformResponseInterceptor` la envuelve en `{ statusCode, message, data, timestamp }`.
- `HttpExceptionFilter` — **también cifra las respuestas de error**.
- Orden en `main.ts`: `[DecryptRequest, EncryptResponse, TransformResponse]`
  (NestJS aplica los `.map` en orden inverso, por lo que la respuesta se
  transforma → se cifra).

**WebSocket** (`WsCryptoInterceptor`, aplicado con `@UseInterceptors` en
`ChatGateway` — `APP_INTERCEPTOR` no es fiable en gateways):
- Descifra el `@MessageBody` entrante y cifra el valor de retorno/ack.
- Los **broadcasts** (`server.emit`) se cifran explícitamente con
  `encryptTransport(...)` en el gateway.

Lo que **no** se cifra: cabeceras HTTP (incl. `Authorization`), URL/path, eventos
reservados de Socket.io, ni los binarios de subida de archivos.

## Capa 2 — Cifrado en reposo (at-rest)

Cifra ciertos campos **antes de guardarlos en PostgreSQL** y los descifra al
leerlos. La columna sigue siendo `String`/`Text`, pero almacena el JSON
`{v,iv,ct}` serializado.

| Dato | Archivo | Operación |
|------|---------|-----------|
| `Message.content` (y `reply_to.content`) | `messages.repository.ts` | `encryptAtRest` al crear/editar; `decryptAtRest` al leer |
| `Conversation.last_message.content` (preview) | `conversations.repository.ts` | `decryptAtRest` al leer |
| `User.password` | `auth.service.ts` | `encryptAtRest` al registrar; `decryptAtRest` al hacer login ⚠️ |
| `RefreshToken.token_hash` | `auth.service.ts` | `encryptAtRest` al emitir; `decryptAtRest` al validar ⚠️ |

> La **búsqueda de mensajes** (`searchInConversation`) no puede filtrar en SQL
> sobre contenido cifrado: trae todos los mensajes, los descifra en memoria y
> filtra. Funciona pero **no escala** (acorde a la naturaleza académica del
> proyecto).

## Gestión de claves

| Variable | Ámbito | Uso |
|----------|--------|-----|
| `CRYPTO_TRANSPORT_KEY` | backend | Transporte. **Debe ser idéntica** a `NEXT_PUBLIC_CRYPTO_TRANSPORT_KEY` del frontend |
| `CRYPTO_AT_REST_KEY` | solo backend | Cifrado en BD. Si se pierde, **se pierde el acceso a los datos cifrados** |

Ambas tienen un **valor por defecto hardcodeado** en `keys.ts` que **debe
cambiarse en producción**.

## 🔒 Seguridad — IMPORTANTE (léelo)

Esta sección existe para que cualquier desarrollador entienda los **riesgos reales**
del diseño actual.

### Riesgo CRÍTICO: contraseñas y refresh tokens reversibles
`auth.service.ts` **sustituyó bcrypt por cifrado reversible** (`encryptAtRest`):

- Las **contraseñas se pueden recuperar en texto plano** descifrando con
  `CRYPTO_AT_REST_KEY`. En el login, se descifra la contraseña guardada y se
  compara en claro (`decryptAtRest(user.password) !== dto.password`).
- Igual para los **refresh tokens**.
- Como la clave tiene un **default hardcodeado**, si se despliega sin cambiarla (o
  si la clave se filtra), **todas las credenciales quedan expuestas**.
- QCipher es débil y **sin autenticación/integridad** (no es AEAD).

Esto **viola OWASP** (las contraseñas deben hashearse con una función lenta de un
solo sentido — bcrypt/argon2/scrypt — **nunca** cifrarse de forma reversible) y las
reglas internas del proyecto.

**Recomendación (no aplicada por decisión del proyecto):**
- Contraseñas → `bcrypt`/`argon2` (hash de un solo sentido). *El historial git
  conserva la versión con bcrypt previa a este cambio.*
- Refresh tokens → hash (bcrypt) o token aleatorio + hash.
- Cifrado at-rest de `content` → si se desea de verdad, usar un algoritmo estándar
  autenticado (AES-256-GCM) y gestión de claves (KMS/secretos), no una clave por
  defecto embebida.

### Otras consideraciones
- **No es E2E.** El servidor posee ambas claves; descifra para operar. No protege
  frente a un servidor comprometido (aunque el at-rest sí mitiga un volcado de BD
  *si* la clave no está comprometida).
- La confidencialidad real en tránsito la aporta **HTTPS/WSS (TLS)**; QCipher es
  una capa de ofuscación de aplicación por encima.

## Referencias en el código

- `src/common/crypto/qcipher.ts`, `src/common/crypto/keys.ts`
- `src/common/interceptors/{decrypt-request,encrypt-response,ws-crypto}.interceptor.ts`
- `src/common/filters/http-exception.filter.ts`
- `src/messages/messages.repository.ts`, `src/conversations/conversations.repository.ts`
- `src/auth/auth.service.ts`
- Frontend espejo: `quickchat-frontend/docs/transport-encryption.md`
