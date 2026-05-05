export type ApiResponse<T> = {
  statusCode: number;
  data: T;
  message: string;
  success: boolean;
};

export type ApiError = {
  statusCode: number;
  message: string;
  success: false;
  errors: unknown[];
  stack?: string;
};
