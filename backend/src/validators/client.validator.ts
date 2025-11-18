// src/validators/client.validator.ts
import { z } from "zod";
import { CountrySelection } from "@prisma/client";

// Common country validation
const countrySchema = z.nativeEnum(CountrySelection, {
  errorMap: () => ({ message: "Invalid country selection" }),
});

// Legal form validation
const legalFormSchema = z.enum(["SARL", "SA", "SUARL", "INDIVIDUAL", "OTHER"], {
  errorMap: () => ({ message: "Invalid legal form" }),
});

// Base client schema
const clientBaseSchema = z.object({
  name: z.string().min(1, "Name is required").max(255, "Name too long"),
  legalForm: legalFormSchema,
  taxNumber: z.string().optional().nullable(),
  address: z.string().optional().nullable(),
  city: z.string().optional().nullable(),
  phone: z.string().optional().nullable(),
  country: countrySchema,
});

// Create client schema (all required fields)
export const createClientSchema = z.object({
  body: clientBaseSchema.refine(
    (data) => data.name && data.legalForm && data.country,
    {
      message: "Name, legal form, and country are required",
    }
  ),
});

// Update client schema (all fields optional)
export const updateClientSchema = z.object({
  body: z
    .object({
      name: z
        .string()
        .min(1, "Name is required")
        .max(255, "Name too long")
        .optional(),
      legalForm: legalFormSchema.optional(),
      taxNumber: z.string().optional().nullable(),
      address: z.string().optional().nullable(),
      city: z.string().optional().nullable(),
      phone: z.string().optional().nullable(),
      country: countrySchema.optional(),
    })
    .refine((data) => Object.keys(data).length > 0, {
      message: "At least one field must be provided for update",
    }),
  params: z.object({
    id: z.string().uuid("Invalid client ID format"),
  }),
});

// ID parameter schema for routes with ID
export const clientIdSchema = z.object({
  params: z.object({
    id: z.string().uuid("Invalid client ID format"),
  }),
});

// Country query schema
export const countryQuerySchema = z.object({
  query: z.object({
    country: countrySchema.optional(),
  }),
});
