import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

export interface ApiResponse<T> {
  statusCode: number;
  message: string;
  data: T;
  timestamp: string;
}

@Injectable()
export class TransformResponseInterceptor<T>
  implements NestInterceptor<T, ApiResponse<T>>
{
  intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Observable<ApiResponse<T>> {
    return next.handle().pipe(
      map((data: { message?: string; data?: T } | T) => ({
        statusCode: context.switchToHttp().getResponse<{ statusCode: number }>()
          .statusCode,
        message:
          (data as { message?: string }).message !== undefined
            ? (data as { message: string }).message
            : 'Success',
        data:
          (data as { message?: string }).message !== undefined
            ? (data as { data: T }).data
            : (data as T),
        timestamp: new Date().toISOString(),
      })),
    );
  }
}
