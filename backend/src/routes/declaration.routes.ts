// src/routes/declaration.routes.ts
import { Router } from "express";
import { declarationController } from "../controllers/declaration.controller";
import { authenticate } from "../middleware/auth.middleware";

const router = Router();

router.get("/", authenticate, declarationController.getDeclarations);
router.post("/", authenticate, declarationController.createDeclaration);
router.put(
  "/:id/configure",
  authenticate,
  declarationController.configureDeclaration
);
router.post(
  "/:id/submit-to-dgi",
  authenticate,
  declarationController.submitToDGI
);
router.get(
  "/:id/status",
  authenticate,
  declarationController.getDeclarationStatus
);
router.post(
  "/process/:declaration_year/:declaration_type",
  authenticate,
  declarationController.createProcess
);
router.delete("/process", authenticate, declarationController.deleteProcess);
router.get("/process", authenticate, declarationController.getProcesses);
router.get(
  "/process/:declaration_year",
  authenticate,
  declarationController.getProcessesByYear
);
router.post("/auth", declarationController.loginDGI);

export default router;
