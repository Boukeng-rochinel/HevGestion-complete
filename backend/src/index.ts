// src/index.ts
import express, { Express, Request, Response, NextFunction } from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import cookieParser from "cookie-parser";
import { config } from "./config";
import { errorHandler } from "./middleware/errorHandler";
import authRoutes from "./routes/auth.routes";
import countryRoutes from "./routes/country.routes";
import clientRoutes from "./routes/client.routes";
import folderRoutes from "./routes/folder.routes";
import balanceRoutes from "./routes/balance.routes";
import dsfRoutes from "./routes/dsf.routes";
import dsfImportRoutes from "./routes/dsf-import.routes";
import declarationRoutes from "./routes/declaration.routes";
import dsfConfigRoutes from "./routes/dsf-config.routes";
import dgiDeclarationRoutes from "./routes/dgi-declaration.routes";
import assistantRoutes from "./routes/assistant.routes";
import reportRoutes from "./routes/report.routes";
import auditRoutes from "./routes/audit.routes";
import notesRoutes from "./routes/notes.routes";
import dsfMappingRoutes from "./routes/dsf-mapping.routes";

const app: Express = express();

// Security middleware
app.use(helmet());
app.use(
  cors({
    origin: config.cors.origin,
    credentials: true,
  })
);

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10000, // Increased for development
  standardHeaders: true,
  legacyHeaders: false,
});
app.use("/api/", limiter);

// Body parsing
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));

// Cookie parsing for HttpOnly cookies
app.use(cookieParser());

// Health check
app.get("/health", (req: Request, res: Response) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// API Routes
app.use("/api/auth", authRoutes);
app.use("/api/countries", countryRoutes);
app.use("/api/clients", clientRoutes);
app.use("/api/folders", folderRoutes);
app.use("/api/balances", balanceRoutes);
app.use("/api/dsf", dsfRoutes);
app.use("/api/dsf-import", dsfImportRoutes);
app.use("/api/declarations", declarationRoutes);
app.use("/api/dsf-configs", dsfConfigRoutes);
app.use("/api/dgi", dgiDeclarationRoutes);
app.use("/api/assistants", assistantRoutes);
app.use("/api/reports", reportRoutes);
app.use("/api/audit", auditRoutes);
app.use("/api/notes", notesRoutes);
app.use("/api/dsf-mapping", dsfMappingRoutes);

// Error handling
app.use(errorHandler);

// 404 handler
app.use((req: Request, res: Response) => {
  res.status(404).json({ error: "Route not found" });
});

const PORT = config.port || 5000;

console.log(`🔑 JWT Secret loaded: ${config.jwt.secret ? "YES" : "NO"}`);
console.log(
  `🔄 Refresh Secret loaded: ${config.jwt.refreshSecret ? "YES" : "NO"}`
);
console.log(`🗄️ Database URL: ${config.database.url ? "SET" : "NOT SET"}`);

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📝 Environment: ${config.env}`);
});

// Graceful shutdown
process.on("SIGTERM", async () => {
  console.log("🛑 SIGTERM received, shutting down gracefully");
  process.exit(0);
});

process.on("SIGINT", async () => {
  console.log("🛑 SIGINT received, shutting down gracefully");
  process.exit(0);
});

export default app;
