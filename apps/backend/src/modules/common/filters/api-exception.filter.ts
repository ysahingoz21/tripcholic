import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { ApiErrorResponse } from '../types/api-response.type';

@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
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
