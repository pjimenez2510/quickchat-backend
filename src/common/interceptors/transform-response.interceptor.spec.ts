import { TransformResponseInterceptor } from './transform-response.interceptor';
import { ExecutionContext, CallHandler } from '@nestjs/common';
import { of } from 'rxjs';

describe('TransformResponseInterceptor', () => {
  let interceptor: TransformResponseInterceptor<unknown>;

  beforeEach(() => {
    interceptor = new TransformResponseInterceptor();
  });

  function buildContext(statusCode: number): ExecutionContext {
    return {
      switchToHttp: () => ({
        getResponse: () => ({ statusCode }),
      }),
    } as unknown as ExecutionContext;
  }

  function buildHandler(data: unknown): CallHandler {
    return {
      handle: () => of(data),
    };
  }

  it('should wrap plain data with default message', (done) => {
    const context = buildContext(200);
    const handler = buildHandler({ id: 1 });

    interceptor.intercept(context, handler).subscribe((result) => {
      expect(result.statusCode).toBe(200);
      expect(result.message).toBe('Success');
      expect(result.data).toEqual({ id: 1 });
      expect(result.timestamp).toBeDefined();
      done();
    });
  });

  it('should use message and data fields when present', (done) => {
    const context = buildContext(201);
    const handler = buildHandler({ message: 'Task created successfully', data: { id: 42 } });

    interceptor.intercept(context, handler).subscribe((result) => {
      expect(result.statusCode).toBe(201);
      expect(result.message).toBe('Task created successfully');
      expect(result.data).toEqual({ id: 42 });
      done();
    });
  });

  it('should handle null data', (done) => {
    const context = buildContext(200);
    const handler = buildHandler({ message: 'Task deleted successfully', data: null });

    interceptor.intercept(context, handler).subscribe((result) => {
      expect(result.message).toBe('Task deleted successfully');
      expect(result.data).toBeNull();
      done();
    });
  });
});
