import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { ApiErrorResponse } from '../types/api-response.type';

@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(ApiExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const statusCode =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    const exceptionResponse =
      exception instanceof HttpException ? exception.getResponse() : null;

    const message = this.getMessage(exceptionResponse);

    const errorStack = exception instanceof Error ? exception.stack : undefined;
    const errorName =
      exception instanceof Error ? exception.name : 'UnknownException';
    const serializedException =
      exception instanceof Error ? exception.message : JSON.stringify(exception);

    this.logger.error(
      `[AUTH_ERROR] ${request.method} ${request.url} status=${statusCode} exception=${errorName} message=${serializedException}`,
      errorStack,
    );

    const payload: ApiErrorResponse = {
      success: false,
      error: {
        statusCode,
        message,
        path: request.url,
        timestamp: new Date().toISOString(),
      },
    };

    response.status(statusCode).json(payload);
  }

  private getMessage(response: unknown): string | string[] {
    if (typeof response === 'string') {
      return response;
    }

    if (response && typeof response === 'object' && 'message' in response) {
      const message = response.message;
      if (typeof message === 'string' || Array.isArray(message)) {
        return message;
      }
    }

    return 'Internal server error';
  }
}
