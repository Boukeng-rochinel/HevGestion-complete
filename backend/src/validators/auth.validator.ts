// src/validators/auth.validator.ts
import { z } from "zod";

export const registerSchema = z.object({
  body: z.object({
    email: z.string().email("Invalid email format").optional(),
    phoneCountryCode: z.string().min(1, "Country code is required").optional(),
    phoneNumber: z.string().min(8, "Phone number must be at least 8 digits").optional(),
    password: z
      .string()
      .min(8, "Password must be at least 8 characters")
      .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
      .regex(/[a-z]/, "Password must contain at least one lowercase letter")
      .regex(/[0-9]/, "Password must contain at least one number")
      .regex(
        /[^A-Za-z0-9]/,
        "Password must contain at least one special character"
      ),
    firstName: z.string().min(2, "First name must be at least 2 characters"),
    lastName: z.string().min(2, "Last name must be at least 2 characters"),
    role: z.enum(["ASSISTANT", "COMPTABLE", "ADMIN"]),
    companyName: z.string().optional(),
    legalForm: z
      .enum(["SARL", "SA", "SUARL", "INDIVIDUAL", "OTHER"])
      .optional(),
    taxNumber: z.string().optional(),
    country: z.string().length(2, "Country code must be 2 characters"),
    address: z.string().optional(),
    city: z.string().optional(),
    phone: z.string().optional(),
  }).refine((data) => data.email || (data.phoneCountryCode && data.phoneNumber), {
    message: "Either email or phone number is required",
    path: ["email"],
  }),
});

export const loginSchema = z.object({
  body: z.object({
    email: z.string().email("Invalid email format").optional(),
    phone: z.string().min(8, "Phone number must be at least 8 digits").optional(),
    password: z.string().min(1, "Password is required"),
  }).refine((data) => data.email || data.phone, {
    message: "Either email or phone number is required",
    path: ["email"],
  }),
});
