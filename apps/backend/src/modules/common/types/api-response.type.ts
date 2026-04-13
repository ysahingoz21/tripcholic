export type ApiSuccessResponse<T> = {
  success: true;
  data: T;
};

export type ApiErrorResponse = {
  success: false;
  error: {
    statusCode: number;
    message: string | string[];
    path: string;
    timestamp: string;
  };
};
