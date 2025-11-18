// src/middleware/errorHandler.ts
import { Request, Response, NextFunction } from "express";
import { AppError } from "../lib/errors";
import { Prisma } from "@prisma/client";

export const errorHandler = (
  err: Error,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  console.error("Error:", err);

  // Prisma errors
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === "P2002") {
      return res.status(409).json({
        error: "Conflict",
        message: "A record with this value already exists",
        field: err.meta?.target,
      });
    }
    if (err.code === "P2025") {
      return res.status(404).json({
        error: "Not Found",
        message: "Record not found",
      });
    }
  }

  if (err instanceof Prisma.PrismaClientValidationError) {
    return res.status(400).json({
      error: "Validation Error",
      message: "Invalid data provided",
    });
  }

  // App errors
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      error: err.message,
      ...(process.env.NODE_ENV === "development" && { stack: err.stack }),
    });
  }

  // Default error
  res.status(500).json({
    error: "Internal Server Error",
    message:
      process.env.NODE_ENV === "development"
        ? err.message
        : "Something went wrong",
    ...(process.env.NODE_ENV === "development" && { stack: err.stack }),
  });
};
