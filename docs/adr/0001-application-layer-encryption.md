# ADR 0001 — Cifrado de capa de aplicación (QCipher)

- **Estado:** Aceptado (con riesgo de seguridad asumido — ver Consecuencias)
- **Fecha:** 2026-05-29

## Contexto

QuickChat es un proyecto de naturaleza académica que busca demostrar cifrado de la
comunicación y de datos sensibles **sin** depender de TLS como única protección.
Se introduce un cifrado simétrico propio (**QCipher**) aplicado en la capa de
aplicación, en coordinación con el frontend.

## Decisión

Aplicar QCipher en **dos capas** con **claves distintas**:

1. **Transporte** (`CRYPTO_TRANSPORT_KEY`, compartida con el frontend): cifra el
   cuerpo completo de peticiones/respuestas HTTP (incl. errores) y los payloads de
   eventos WebSocket, mediante interceptors globales y un interceptor de gateway.
2. **At-rest** (`CRYPTO_AT_REST_KEY`, solo backend): cifra campos sensibles en BD
   — `Message.content`, `Conversation.last_message`, `User.password` y
   `RefreshToken.token_hash`.

Como parte de la decisión, `auth.service` **dejó de usar bcrypt** y pasó a guardar
la contraseña y el refresh token con cifrado at-rest reversible.

Detalle técnico en [`../encryption.md`](../encryption.md).

## Alternativas

- **TLS únicamente** (sin cifrado de aplicación): más simple, pero no cumple el
  objetivo didáctico de cifrar a nivel de aplicación.
- **AES-256-GCM (Web Crypto / Node crypto)** + bcrypt/argon2 para contraseñas:
  opción **recomendada** en producción (estándar, autenticado, hashing de un solo
  sentido). No adoptada por el enfoque académico del proyecto.

## Consecuencias

**Positivas**
- Confidencialidad de aplicación sobre HTTP y WebSocket, además de TLS.
- Cifrado at-rest del contenido de mensajes: un volcado de BD no expone los textos
  *si* la clave at-rest no está comprometida.

**Negativas / riesgos asumidos**
- 🔴 **Crítico:** contraseñas y refresh tokens **reversibles** (no hasheados). Si
  `CRYPTO_AT_REST_KEY` se filtra o se deja el valor por defecto, las credenciales
  quedan expuestas. **Viola OWASP y las reglas internas.**
- QCipher es un cifrado **didáctico**, débil y **sin integridad** (no AEAD); no es
  un algoritmo estándar ni auditado.
- **No es E2E**: el servidor posee las claves y descifra para operar.
- La **búsqueda** de mensajes descifra en memoria (no escala).
- La suite de **tests** quedó desactualizada tras el cambio (auth y gateway).

## Recomendación de mitigación (no aplicada por decisión del proyecto)

- Contraseñas → `bcrypt`/`argon2`; refresh tokens → hash.
- At-rest → AES-256-GCM con gestión de claves (KMS/secretos), no clave por defecto.
- Actualizar los tests afectados.
