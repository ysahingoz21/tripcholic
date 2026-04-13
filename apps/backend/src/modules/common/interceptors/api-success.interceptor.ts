import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { ApiSuccessResponse } from '../types/api-response.type';

@Injectable()
export class ApiSuccessInterceptor<T>
  implements NestInterceptor<T, ApiSuccessResponse<T>>
{
  intercept(
    context: ExecutionContext,
    next: CallHandler<T>,
  ): Observable<ApiSuccessResponse<T>> {
    if (context.getType() !== 'http') {
      return next.handle() as Observable<ApiSuccessResponse<T>>;
    }

    return next.handle().pipe(
      map((data) => {
        if (
          typeof data === 'object' &&
          data !== null &&
          'success' in data &&
          'data' in data
        ) {
          return data as unknown as ApiSuccessResponse<T>;
        }

        return {
          success: true,
          data,
        };
      }),
    );
  }
}
