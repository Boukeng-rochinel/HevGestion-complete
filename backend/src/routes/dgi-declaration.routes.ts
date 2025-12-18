// routes/dgi-declaration.routes.ts
import { Router } from "express";
import { dgiDeclarationController } from "../controllers/dgi-declaration.controller";
import { authenticate } from "../middleware/auth.middleware";

const router = Router();

// All routes require authentication
router.use(authenticate);

// DGI Configuration routes
router.get(
  "/config/:userId",
  dgiDeclarationController.getConfig.bind(dgiDeclarationController)
);
router.post(
  "/config",
  dgiDeclarationController.saveConfig.bind(dgiDeclarationController)
);
router.put(
  "/config/:id",
  dgiDeclarationController.updateConfig.bind(dgiDeclarationController)
);

// Declaration routes
router.post(
  "/declaration",
  dgiDeclarationController.submitDeclaration.bind(dgiDeclarationController)
);
router.get(
  "/declarations/:userId",
  dgiDeclarationController.getDeclarationHistory.bind(dgiDeclarationController)
);
router.get(
  "/declaration/:declarationId",
  dgiDeclarationController.getDeclarationStatus.bind(dgiDeclarationController)
);

// Validation routes
router.post(
  "/validate-credentials",
  dgiDeclarationController.validateCredentials.bind(dgiDeclarationController)
);

export default router;
