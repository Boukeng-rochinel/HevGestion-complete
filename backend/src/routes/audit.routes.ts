import { Router } from "express";
import { auditController } from "../controllers/audit.controller";
import { authenticate } from "../middleware/auth.middleware";

const router = Router();

// All routes require authentication
router.use(authenticate);

// Get audit logs with filtering and pagination
router.get("/", auditController.getAuditLogs.bind(auditController));

// Get audit statistics
router.get("/stats", auditController.getAuditStats.bind(auditController));

// Get specific audit log by ID
router.get("/:id", auditController.getAuditLogById.bind(auditController));

export default router;
