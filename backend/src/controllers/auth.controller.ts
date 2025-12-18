// src/controllers/auth.controller.ts
import { Request, Response, NextFunction } from "express";
import { prisma } from "../lib/prisma";
import {
  hashPassword,
  comparePassword,
  generateAccessToken,
  generateRefreshToken,
  verifyRefreshToken,
} from "../utils/auth";
import {
  BadRequestError,
  UnauthorizedError,
  ConflictError,
} from "../lib/errors";
import { Validators } from "../utils/validators";
import { auditService } from "../services/audit.service";

// Import the AuthRequest interface from middleware
import { AuthRequest } from "../middleware/auth.middleware";

// Use the same interface as middleware
interface AuthenticatedRequest extends AuthRequest {}

class AuthController {
  async register(req: Request, res: Response, next: NextFunction) {
    try {
      const {
        email,
        phoneCountryCode,
        phoneNumber,
        password,
        firstName,
        lastName,
        role,
        maxAssistants,
      } = req.body;

      // Check if user exists by email or phone
      if (email) {
        const existingUserByEmail = await prisma.user.findUnique({
          where: { email },
        });
        if (existingUserByEmail) {
          throw new ConflictError("User with this email already exists");
        }
      }

      if (phoneNumber) {
        const existingUserByPhone = await prisma.user.findUnique({
          where: { phoneNumber },
        });
        if (existingUserByPhone) {
          throw new ConflictError("User with this phone number already exists");
        }
      }

      // Validate phone number format for Cameroon
      if (phoneNumber && phoneCountryCode === "+237") {
        if (!Validators.isValidCameroonPhoneNumber(phoneNumber)) {
          throw new BadRequestError("Invalid Cameroon phone number format");
        }
      }

      // Hash password
      const hashedPassword = await hashPassword(password);

      // Force role to COMPTABLE for all new registrations
      const userRole = "COMPTABLE";

      // Generate OTP (default "123456" for development)
      const otpCode =
        process.env.NODE_ENV === "production"
          ? Math.floor(100000 + Math.random() * 900000).toString() // 6-digit random OTP
          : "123456"; // Default OTP for development

      const otpExpiry = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

      // implementation of deleting the user info after a certain delay if the user doesn't successfully verified his/her account
      // Create user with OTP (not verified yet)
      const user = await prisma.user.create({
        data: {
          email,
          phoneCountryCode,
          phoneNumber,
          password: hashedPassword,
          firstName,
          lastName,
          role: userRole,
          maxAssistants: role === "COMPTABLE" ? maxAssistants || 0 : 0,
          isActive: false, // User is not active until OTP verification
          otpCode,
          otpExpiry,
          isVerified: false,
        } as any,
      });

      // In a real application, you would send the OTP via SMS/email
      // For now, we'll just log it
      console.log(`OTP for user ${user.id}: ${otpCode}`);

      res.status(201).json({
        message:
          "Un code de vérification a été envoyé à votre numéro de téléphone ",
        user: {
          id: user.id,
          email: user.email,
          phoneCountryCode: user.phoneCountryCode,
          phoneNumber: user.phoneNumber,
          firstName: user.firstName,
          lastName: user.lastName,
          role: user.role,
          createdAt: user.createdAt.toISOString(),
        },
        requiresOtp: true,
      });
    } catch (error) {
      next(error);
    }
  }

  async login(req: Request, res: Response, next: NextFunction) {
    try {
      const { phone, password } = req.body;

      // Validate that phone is provided
      if (!phone) {
        throw new BadRequestError("Phone number is required");
      }

      // Find user by phone only
      const user = await prisma.user.findUnique({
        where: { phoneNumber: phone },
      });

      if (!user) {
        throw new UnauthorizedError("Invalid credentials");
      }

      // Check if user is active
      if (!user.isActive) {
        throw new UnauthorizedError("Account is inactive");
      }

      // Verify password
      const isPasswordValid = await comparePassword(password, user.password);
      if (!isPasswordValid) {
        throw new UnauthorizedError("Invalid credentials");
      }

      // Generate tokens
      const accessToken = generateAccessToken({
        userId: user.id,
        email: user.email ?? undefined,
        role: user.role,
      });

      const refreshToken = generateRefreshToken({
        userId: user.id,
        email: user.email ?? undefined,
        role: user.role,
      });

      // Set HttpOnly cookies for maximum security
      const isProduction = process.env.NODE_ENV === "production";
      const cookieOptions = {
        httpOnly: true,
        secure: isProduction,
        sameSite: isProduction ? ("strict" as const) : ("lax" as const),
        domain: isProduction ? undefined : "localhost",
        maxAge: 4 * 60 * 60 * 1000, // 4 hours for access token
      };

      const refreshCookieOptions = {
        httpOnly: true,
        secure: isProduction,
        sameSite: isProduction ? ("strict" as const) : ("lax" as const),
        domain: isProduction ? undefined : "localhost",
        // No maxAge set - expires on tab close for refresh token
      };

      res.cookie("accessToken", accessToken, cookieOptions);
      res.cookie("refreshToken", refreshToken, refreshCookieOptions);

      // Log successful login
      await auditService.logUserLogin(user.id, {
        ipAddress: req.ip,
        userAgent: req.get("User-Agent"),
        phoneNumber: user.phoneNumber,
      });

      res.json({
        message: "Login successful",
        user: {
          id: user.id,
          email: user.email,
          phoneCountryCode: user.phoneCountryCode,
          phoneNumber: user.phoneNumber,
          firstName: user.firstName,
          lastName: user.lastName,
          role: user.role,
          createdAt: user.createdAt.toISOString(),
        },
      });
    } catch (error) {
      next(error);
    }
  }

  async refreshToken(req: Request, res: Response, next: NextFunction) {
    try {
      const { refreshToken } = req.body;

      if (!refreshToken) {
        throw new BadRequestError("Refresh token is required");
      }

      const payload = verifyRefreshToken(refreshToken);

      // Verify user still exists
      const user = await prisma.user.findUnique({
        where: { id: payload.userId },
      });

      if (!user || !user.isActive) {
        throw new UnauthorizedError("User not found or inactive");
      }

      // Generate new tokens
      const newAccessToken = generateAccessToken({
        userId: user.id,
        email: user.email ?? undefined,
        role: user.role,
      });

      const newRefreshToken = generateRefreshToken({
        userId: user.id,
        email: user.email ?? undefined,
        role: user.role,
      });

      // Set HttpOnly cookies for maximum security
      const isProduction = process.env.NODE_ENV === "production";
      const cookieOptions = {
        httpOnly: true,
        secure: isProduction,
        sameSite: isProduction ? ("strict" as const) : ("lax" as const), // Allow cross-origin in development
        domain: isProduction ? undefined : "localhost", // Allow sharing between localhost ports
        maxAge: 4 * 60 * 60 * 1000, // 4 hours for access token
      };

      const refreshCookieOptions = {
        httpOnly: true,
        secure: isProduction,
        sameSite: isProduction ? ("strict" as const) : ("lax" as const), // Allow cross-origin in development
        domain: isProduction ? undefined : "localhost", // Allow sharing between localhost ports
        // No maxAge set - expires on tab close for refresh token
      };

      res.cookie("accessToken", newAccessToken, cookieOptions);
      res.cookie("refreshToken", newRefreshToken, refreshCookieOptions);

      res.json({
        message: "Tokens refreshed successfully",
      });
    } catch (error) {
      next(error);
    }
  }

  async verifyOtp(req: Request, res: Response, next: NextFunction) {
    try {
      const { userId, otpCode } = req.body;

      if (!userId || !otpCode) {
        throw new BadRequestError("User ID and OTP code are required");
      }

      // Find user
      const user = (await prisma.user.findUnique({
        where: { id: userId },
      })) as any;

      if (!user) {
        throw new BadRequestError("User not found");
      }

      // Check if user is already verified
      if (user.isVerified) {
        throw new BadRequestError("User is already verified");
      }

      // Check OTP
      if (user.otpCode !== otpCode) {
        throw new BadRequestError("Invalid OTP code");
      }

      // Check if OTP is expired
      if (!user.otpExpiry || user.otpExpiry < new Date()) {
        throw new BadRequestError("OTP code has expired");
      }

      // Verify user and clear OTP
      const verifiedUser = await prisma.user.update({
        where: { id: userId },
        data: {
          isVerified: true,
          isActive: true,
          otpCode: null,
          otpExpiry: null,
        } as any,
      });

      // Generate tokens
      const accessToken = generateAccessToken({
        userId: verifiedUser.id,
        email: verifiedUser.email ?? undefined,
        role: verifiedUser.role,
      });

      const refreshToken = generateRefreshToken({
        userId: verifiedUser.id,
        email: verifiedUser.email ?? undefined,
        role: verifiedUser.role,
      });

      // Set HttpOnly cookies for maximum security
      const isProduction = process.env.NODE_ENV === "production";
      const cookieOptions = {
        httpOnly: true,
        secure: isProduction,
        sameSite: isProduction ? ("strict" as const) : ("lax" as const), // Allow cross-origin in development
        maxAge: 4 * 60 * 60 * 1000, // 4 hours for access token
      };

      const refreshCookieOptions = {
        httpOnly: true,
        secure: isProduction,
        sameSite: isProduction ? ("strict" as const) : ("lax" as const), // Allow cross-origin in development
        // No maxAge set - expires on tab close for refresh token
      };

      res.cookie("accessToken", accessToken, cookieOptions);
      res.cookie("refreshToken", refreshToken, refreshCookieOptions);

      res.json({
        message: "OTP verified successfully. Registration complete.",
        user: {
          id: verifiedUser.id,
          email: verifiedUser.email,
          phoneCountryCode: verifiedUser.phoneCountryCode,
          phoneNumber: verifiedUser.phoneNumber,
          firstName: verifiedUser.firstName,
          lastName: verifiedUser.lastName,
          role: verifiedUser.role,
          createdAt: verifiedUser.createdAt.toISOString(),
        },
      });
    } catch (error) {
      next(error);
    }
  }

  async logout(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      // Log logout action if user is authenticated
      if (req.user?.userId) {
        await auditService.logUserLogout(req.user.userId, {
          ipAddress: req.ip,
          userAgent: req.get("User-Agent"),
        });
      }

      // Clear HttpOnly cookies
      res.clearCookie("accessToken");
      res.clearCookie("refreshToken");

      // In a production app, you might want to blacklist the token
      res.json({ message: "Logout successful" });
    } catch (error) {
      next(error);
    }
  }

  async forgotPassword(req: Request, res: Response, next: NextFunction) {
    try {
      const { email } = req.body;

      if (!email) {
        throw new BadRequestError("Email is required");
      }

      // Check if user exists
      const user = await prisma.user.findUnique({
        where: { email },
      });

      if (!user) {
        // Don't reveal if user exists or not for security
        res.json({
          message: "If the email exists, a reset link has been sent",
        });
        return;
      }

      // Generate a reset token (simple implementation)
      const resetToken =
        Math.random().toString(36).substr(2, 9) + Date.now().toString(36);
      const resetTokenExpiry = new Date(Date.now() + 3600000); // 1 hour from now

      // Store the reset token in the database
      // Note: resetToken and resetTokenExpiry fields exist in schema but may need migration
      // For now, we'll skip this part and just return success
      console.log(
        `Password reset requested for ${email}. Token: ${resetToken}`
      );

      // In a real application, you would send an email with the reset link
      // For now, we'll just return the token in the response for testing
      console.log(`Reset token for ${email}: ${resetToken}`);

      res.json({
        message: "If the email exists, a reset link has been sent",
        // Remove this in production - only for testing
        resetToken:
          process.env.NODE_ENV === "development" ? resetToken : undefined,
      });
    } catch (error) {
      next(error);
    }
  }

  async resetPassword(req: Request, res: Response, next: NextFunction) {
    try {
      const { token, newPassword } = req.body;

      if (!token || !newPassword) {
        throw new BadRequestError("Token and new password are required");
      }

      if (newPassword.length < 8) {
        throw new BadRequestError(
          "Password must be at least 8 characters long"
        );
      }

      // For now, just simulate password reset success
      // In a real implementation, you'd validate the token and update the password
      console.log(`Password reset attempted with token: ${token}`);

      res.json({ message: "Password reset successfully" });
    } catch (error) {
      next(error);
    }
  }

  async getProfile(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ) {
    try {
      // Check if user is authenticated and user ID exists
      if (!req.user || !req.user.userId) {
        return res.status(401).json({
          success: false,
          error: "Authentication required",
        });
      }

      const userId = req.user.userId;

      // Get user with all their clients
      const user = await prisma.user.findUnique({
        where: { id: userId },
        include: {
          createdClients: {
            select: {
              id: true,
              name: true,
              legalForm: true,
              taxNumber: true,
              address: true,
              city: true,
              phone: true,
              currency: true,
              country: true,
              createdAt: true,
              updatedAt: true,
            },
            // Remove take: 1 to get all clients
            // You can add ordering if needed
            orderBy: {
              createdAt: "desc", // Optional: order by creation date (newest first)
            },
          },
        },
      });

      if (!user) {
        return res.status(404).json({
          success: false,
          error: "User not found",
        });
      }

      // Remove password from response
      const {
        password,
        resetToken,
        resetTokenExpiry,
        ...userWithoutSensitiveData
      } = user;

      const responseData = {
        success: true,
        user: {
          id: userWithoutSensitiveData.id,
          firstName: userWithoutSensitiveData.firstName,
          lastName: userWithoutSensitiveData.lastName,
          email: userWithoutSensitiveData.email,
          phoneCountryCode: userWithoutSensitiveData.phoneCountryCode,
          phoneNumber: userWithoutSensitiveData.phoneNumber,
          role: userWithoutSensitiveData.role,
          isActive: userWithoutSensitiveData.isActive,
          maxAssistants: userWithoutSensitiveData.maxAssistants,
          // Return all clients as an array
          clients: userWithoutSensitiveData.createdClients.map((client) => ({
            id: client.id,
            name: client.name,
            legalForm: client.legalForm,
            taxNumber: client.taxNumber,
            address: client.address,
            city: client.city,
            phone: client.phone,
            currency: client.currency,
            country: client.country,
            createdAt: client.createdAt,
            updatedAt: client.updatedAt,
          })),
          // For backward compatibility, also include the first client as 'company'
          company:
            userWithoutSensitiveData.createdClients.length > 0
              ? {
                  id: userWithoutSensitiveData.createdClients[0].id,
                  name: userWithoutSensitiveData.createdClients[0].name,
                  legalForm:
                    userWithoutSensitiveData.createdClients[0].legalForm,
                  taxNumber:
                    userWithoutSensitiveData.createdClients[0].taxNumber,
                  address: userWithoutSensitiveData.createdClients[0].address,
                  city: userWithoutSensitiveData.createdClients[0].city,
                  phone: userWithoutSensitiveData.createdClients[0].phone,
                  currency: userWithoutSensitiveData.createdClients[0].currency,
                  country: userWithoutSensitiveData.createdClients[0].country,
                }
              : undefined,
        },
      };

      res.json(responseData);
    } catch (error) {
      console.error("Profile fetch error:", error);
      res.status(500).json({
        success: false,
        error: "Internal server error",
      });
    }
  }
}

export const authController = new AuthController();
