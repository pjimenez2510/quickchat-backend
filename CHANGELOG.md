# Changelog

Formato basado en [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/);
versionado [SemVer](https://semver.org/lang/es/).

## [Unreleased]

### Added

- **Cifrado de capa de aplicación (QCipher)** con dos capas:
  - **Transporte** (`CRYPTO_TRANSPORT_KEY`, compartida con el frontend): cifra el
    cuerpo de todas las respuestas/peticiones HTTP (incluidas las de error) y los
    payloads de eventos WebSocket, vía `DecryptRequestInterceptor`,
    `EncryptResponseInterceptor` y `WsCryptoInterceptor`.
  - **At-rest** (`CRYPTO_AT_REST_KEY`): cifra `Message.content`,
    `Conversation.last_message`, `User.password` y `RefreshToken.token_hash` en BD.
- Documentación: `README.md` reescrito, este `CHANGELOG.md`,
  `docs/architecture.md`, `docs/encryption.md` y ADR
  `docs/adr/0001-application-layer-encryption.md`.

### Changed

- `auth.service`: el almacenamiento de **contraseña y refresh token** pasó de
  **bcrypt (hash)** a **QCipher at-rest (reversible)**.

### Security

- ⚠️ **Riesgo conocido**: contraseñas y refresh tokens se guardan **cifrados de
  forma reversible** (recuperables con `CRYPTO_AT_REST_KEY`) en lugar de hasheados.
  Desviación de OWASP y de las reglas del proyecto, documentada en
  `docs/encryption.md`. La clave de cifrado tiene un valor por defecto que **debe
  cambiarse en producción**.
- ⚠️ Tras estos cambios, parte de la suite de tests quedó **desactualizada**
  (`auth.service.spec` por la salida de bcrypt; `chat.gateway.spec` por el cifrado
  de los broadcasts). Pendiente de actualizar/decidir.

---

## Historial previo (sin versionar)

- Llamadas de audio/vídeo con señalización WebRTC.
- Búsqueda, reenvío, archivado, no leídos en conversaciones.
- Perfil con avatar y `GET /me` extendido.
- Acciones sobre mensajes, indicadores de estado, multimedia, contactos, auth.

[Unreleased]: https://github.com/pjimenez2510/quickchat-backend/commits/main
