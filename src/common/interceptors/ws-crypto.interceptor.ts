import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { decryptTransport, encryptTransport } from '../crypto/keys.js';
import { isEncryptedPayload } from '../crypto/qcipher.js';

/**
 * Interceptor WebSocket: descifra el payload entrante (@MessageBody) y
 * cifra el ack/return value que devuelve el handler.
 *
 * IMPORTANTE: en NestJS, APP_INTERCEPTOR provider NO se aplica a gateways
 * WebSocket de forma fiable. Aplicar con @UseInterceptors() directamente
 * en la clase del gateway.
 */
@Injectable()
export class WsCryptoInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== 'ws') {
      return next.handle();
    }

    const args = context.getArgs<unknown[]>();
    const data = args[1];
    if (isEncryptedPayload(data)) {
      try {
        const plain = decryptTransport(data);
        args[1] = plain.length > 0 ? (JSON.parse(plain) as unknown) : {};
      } catch {
        // payload mal formado: dejar tal cual para que el handler decida
      }
    }

    return next.handle().pipe(
      map((response) => {
        if (response === undefined || response === null) return response;
        return encryptTransport(JSON.stringify(response));
      }),
    );
  }
}
