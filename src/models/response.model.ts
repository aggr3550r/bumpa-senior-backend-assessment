import { HttpStatus } from '@nestjs/common';

export class ResponseModel<T = unknown, U = Record<string, unknown>> {
  constructor(
    public status: boolean,
    public statusCode: HttpStatus,
    public message?: string,
    public data?: T,
    public meta?: U,
  ) {}

  static success<T = unknown, U = Record<string, unknown>>(
    message?: string,
    data?: T,
    meta?: U,
    statusCode: HttpStatus = HttpStatus.OK,
  ): ResponseModel<T, U> {
    return new ResponseModel(true, statusCode, message, data, meta);
  }

  static error<T = unknown>(
    message?: string,
    statusCode: HttpStatus = HttpStatus.INTERNAL_SERVER_ERROR,
    data?: T,
  ): ResponseModel<T> {
    return new ResponseModel(false, statusCode, message, data);
  }
}
