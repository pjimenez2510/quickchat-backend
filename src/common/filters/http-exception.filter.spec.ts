import { HttpExceptionFilter } from './http-exception.filter';
import { HttpException, HttpStatus, ArgumentsHost } from '@nestjs/common';

describe('HttpExceptionFilter', () => {
  let filter: HttpExceptionFilter;

  beforeEach(() => {
    filter = new HttpExceptionFilter();
  });

  function buildHost(statusFn: jest.Mock): ArgumentsHost {
    return {
      switchToHttp: () => ({
        getResponse: () => ({
          status: statusFn,
        }),
      }),
    } as unknown as ArgumentsHost;
  }

  it('should return error response with string exception message', () => {
    const jsonMock = jest.fn();
    const statusMock = jest.fn().mockReturnValue({ json: jsonMock });
    const host = buildHost(statusMock);

    const exception = new HttpException('Not found', HttpStatus.NOT_FOUND);
    filter.catch(exception, host);

    expect(statusMock).toHaveBeenCalledWith(404);
    const responseBody = jsonMock.mock.calls[0][0] as {
      statusCode: number;
      message: string;
      error: string;
      timestamp: string;
    };
    expect(responseBody.statusCode).toBe(404);
    expect(responseBody.message).toBe('Not found');
    expect(responseBody.error).toBe('Error');
    expect(responseBody.timestamp).toBeDefined();
  });

  it('should return error response with object exception', () => {
    const jsonMock = jest.fn();
    const statusMock = jest.fn().mockReturnValue({ json: jsonMock });
    const host = buildHost(statusMock);

    const exception = new HttpException(
      { message: 'Validation failed', error: 'BadRequest' },
      HttpStatus.BAD_REQUEST,
    );
    filter.catch(exception, host);

    expect(statusMock).toHaveBeenCalledWith(400);
    const responseBody = jsonMock.mock.calls[0][0] as {
      statusCode: number;
      message: string;
      error: string;
    };
    expect(responseBody.statusCode).toBe(400);
    expect(responseBody.message).toBe('Validation failed');
    expect(responseBody.error).toBe('BadRequest');
  });

  it('should fallback to HttpStatus key when error field is missing', () => {
    const jsonMock = jest.fn();
    const statusMock = jest.fn().mockReturnValue({ json: jsonMock });
    const host = buildHost(statusMock);

    const exception = new HttpException(
      { message: 'Conflict occurred' },
      HttpStatus.CONFLICT,
    );
    filter.catch(exception, host);

    const responseBody = jsonMock.mock.calls[0][0] as {
      error: string;
    };
    expect(responseBody.error).toBe(HttpStatus[HttpStatus.CONFLICT]);
  });
});
