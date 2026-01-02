// routes/dsf-mapping.routes.ts
import { Router } from "express";
import { dsfMappingController } from "../controllers/dsf-mapping.controller";
import { authenticate } from "../middleware/auth.middleware";

const router = Router();

// All routes require authentication
router.use(authenticate);

// Mapping configuration routes
router.get("/configs", dsfMappingController.getMappingConfigs);
router.get("/configs/:sheetType", dsfMappingController.getMappingConfig);
router.post("/configs", dsfMappingController.saveMappingConfig);
router.delete("/configs/:id", dsfMappingController.deleteMappingConfig);

// Testing routes
router.post("/test", dsfMappingController.testMapping);

// Preset routes
router.get("/presets", dsfMappingController.getMappingPresets);
router.post("/presets", dsfMappingController.createMappingPreset);

export default router;
