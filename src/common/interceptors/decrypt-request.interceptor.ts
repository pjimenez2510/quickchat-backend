import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  BadRequestException,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { decryptTransport } from '../crypto/keys.js';
import { isEncryptedPayload } from '../crypto/qcipher.js';

@Injectable()
export class DecryptRequestInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== 'http') {
      return next.handle();
    }

    const req = context.switchToHttp().getRequest<{ body?: unknown }>();
    if (isEncryptedPayload(req.body)) {
      try {
        const plain = decryptTransport(req.body);
        req.body = plain.length > 0 ? (JSON.parse(plain) as unknown) : {};
      } catch {
        throw new BadRequestException('Invalid encrypted payload');
      }
    }
    return next.handle();
  }
}
