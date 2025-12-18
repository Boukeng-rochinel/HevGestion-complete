// routes/assistant.routes.ts
import { Router } from "express";
import { assistantController } from "../controllers/assistant.controller";
import { authenticate } from "../middleware/auth.middleware";

const router = Router();

// All routes require authentication
router.use(authenticate);

// Assistant management routes
router.get("/", assistantController.getAssistants.bind(assistantController));
router.post("/", assistantController.createAssistant.bind(assistantController));
router.put("/:assistantId", assistantController.updateAssistant.bind(assistantController));
router.delete("/:assistantId", assistantController.deleteAssistant.bind(assistantController));

// Folder assignment routes
router.post("/:assistantId/assign", assistantController.assignToFolders.bind(assistantController));
router.get("/:assistantId/folders", assistantController.getAssistantFolders.bind(assistantController));
router.delete("/:assistantId/folders", assistantController.removeFromFolders.bind(assistantController));

export default router;