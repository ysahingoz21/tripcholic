import { Module } from '@nestjs/common';
import { APP_FILTER, APP_INTERCEPTOR } from '@nestjs/core';
import { ApiExceptionFilter } from './filters/api-exception.filter';
import { ApiSuccessInterceptor } from './interceptors/api-success.interceptor';

@Module({
  providers: [
    {
      provide: APP_INTERCEPTOR,
      useClass: ApiSuccessInterceptor,
    },
    {
      provide: APP_FILTER,
      useClass: ApiExceptionFilter,
    },
  ],
})
export class CommonModule {}
