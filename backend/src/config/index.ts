// src/config/index.ts
import dotenv from "dotenv";
dotenv.config();

export const config = {
  env: process.env.NODE_ENV || "development",
  port: parseInt(process.env.PORT || "3000", 10),

  // Database
  database: {
    url:
      process.env.DATABASE_URL ||
      "postgresql://user:password@localhost:5432/financial_app",
  },

  // JWT
  jwt: {
    secret: process.env.JWT_SECRET as string,
    expiresIn: process.env.JWT_EXPIRES_IN || "7d",
    refreshSecret: process.env.JWT_REFRESH_SECRET as string,
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || "30d",
  },

  // CORS
  cors: {
    origin: process.env.CORS_ORIGIN?.split(",") || [
      "http://localhost:3000",
      "http://localhost:5173",
    ],
  },

  // File Upload
  upload: {
    maxSize: parseInt(process.env.MAX_UPLOAD_SIZE || "52428800", 10), // 50MB
    allowedTypes: [
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "application/vnd.ms-excel",
    ],
    directory: process.env.UPLOAD_DIR || "./uploads",
  },

  // DGI API
  dgi: {
    apiUrl: process.env.DGI_API_URL || "https://api.impots.cm",
    timeout: parseInt(process.env.DGI_TIMEOUT || "60000", 10),
  },

  // Encryption
  encryption: {
    algorithm: "aes-256-gcm",
    key: process.env.ENCRYPTION_KEY || "your-32-character-encryption-key!",
  },

  // Countries
  supportedCountries: ["CM", "CI", "SN", "BF", "TG", "BJ"],
};
