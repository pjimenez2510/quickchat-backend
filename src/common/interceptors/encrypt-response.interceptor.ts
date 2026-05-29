import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { encryptTransport } from '../crypto/keys.js';

/**
 * Cifra la respuesta envuelta por TransformResponseInterceptor.
 * Debe registrarse DESPUÉS de TransformResponseInterceptor en main.ts
 * para que el shape { statusCode, message, data, timestamp } se cifre completo.
 */
@Injectable()
export class EncryptResponseInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== 'http') {
      return next.handle();
    }

    return next.handle().pipe(
      map((data) => {
        const serialized = JSON.stringify(data ?? null);
        return encryptTransport(serialized);
      }),
    );
  }
}
