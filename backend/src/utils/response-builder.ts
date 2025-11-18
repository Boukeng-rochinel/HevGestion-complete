// src/utils/response-builder.ts
import { Response } from 'express';

export class ResponseBuilder {
  static success(res: Response, data: any, message?: string, statusCode: number = 200) {
    return res.status(statusCode).json({
      success: true,
      message: message || 'Operation successful',
      data,
      timestamp: new Date().toISOString(),
    });
  }

  static error(res: Response, message: string, statusCode: number = 400, errors?: any[]) {
    return res.status(statusCode).json({
      success: false,
      message,
      errors,
      timestamp: new Date().toISOString(),
    });
  }

  static paginated(
    res: Response,
    data: any[],
    page: number,
    limit: number,
    total: number
  ) {
    return res.json({
      success: true,
      data,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasNext: page * limit < total,
        hasPrev: page > 1,
      },
      timestamp: new Date().toISOString(),
    });
  }
}