// src/middleware/auth.middleware.ts
import { Request, Response, NextFunction } from "express";
import { UnauthorizedError, ForbiddenError } from "../lib/errors";
import { verifyAccessToken } from "../utils/auth";
import { prisma } from "../lib/prisma";

export interface AuthRequest extends Request {
  user?: {
    userId: string;
    email?: string;
    role: string;
  };
}

export const authenticate = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    // Debug: Log cookies and headers
    console.log("🔍 Auth middleware - Cookies:", Object.keys(req.cookies || {}));
    console.log("🔍 Auth middleware - Cookie accessToken:", req.cookies?.accessToken ? "PRESENT" : "NOT PRESENT");
    console.log("🔍 Auth middleware - Authorization header:", req.headers.authorization ? "PRESENT" : "NOT PRESENT");

    // First try to get token from HttpOnly cookies (secure approach)
    let token = req.cookies?.accessToken;

    // Fallback to Authorization header for backward compatibility
    if (!token) {
      const authHeader = req.headers.authorization;
      if (authHeader && authHeader.startsWith("Bearer ")) {
        token = authHeader.substring(7);
      }
    }

    if (!token) {
      console.log("❌ Auth middleware - No token found in cookies or headers");
      throw new UnauthorizedError("No token provided");
    }

    console.log("✅ Auth middleware - Token found, proceeding with verification");

    const payload = verifyAccessToken(token);

    // Verify user still exists and is active
    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      select: { id: true, email: true, role: true, isActive: true },
    });

    if (!user || !user.isActive) {
      throw new UnauthorizedError("User not found or inactive");
    }

    req.user = {
      userId: user.id,
      email: user.email || undefined,
      role: user.role,
    };

    next();
  } catch (error) {
    next(error);
  }
};

export const authorize = (...allowedRoles: string[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return next(new UnauthorizedError());
    }

    if (!allowedRoles.includes(req.user.role)) {
      return next(new ForbiddenError("Insufficient permissions"));
    }

    next();
  };
};
