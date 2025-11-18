// src/validators/exercise.validator.ts
import { z } from "zod";

export const createExerciseSchema = z.object({
  body: z
    .object({
      name: z.string().min(3, "Name must be at least 3 characters"),
      description: z.string().optional(),
      clientId: z.string().min(1, "Client ID is required"),
      fiscalYear: z.number().int().min(2015).max(2100),
      startDate: z
        .string()
        .regex(
          /^\d{4}-\d{1,2}-\d{1,2}$/,
          "Start date must be in YYYY-MM-DD format"
        ),
      endDate: z
        .string()
        .regex(
          /^\d{4}-\d{1,2}-\d{1,2}$/,
          "End date must be in YYYY-MM-DD format"
        ),
    })
    .refine((data) => new Date(data.endDate) > new Date(data.startDate), {
      message: "End date must be after start date",
      path: ["endDate"],
    }),
});
