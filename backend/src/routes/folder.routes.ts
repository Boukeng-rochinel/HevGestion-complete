// src/routes/folder.routes.ts
import { Router } from "express";
import { folderController } from "../controllers/folder.controller";
import { authenticate } from "../middleware/auth.middleware";
import { validate } from "../middleware/validation.middleware";
import { createExerciseSchema } from "../validators/exercise.validator";

const router = Router();

router.get("/", authenticate, folderController.getFolders);
router.get("/current", authenticate, folderController.getCurrentFolder);
router.get("/:id", authenticate, folderController.getFolderById);
router.post(
  "/",
  authenticate,
  validate(createExerciseSchema),
  folderController.createFolder
);
router.post(
  "/:id/duplicate",
  authenticate,
  validate(createExerciseSchema),
  folderController.duplicateFolder
);
router.put("/:id/close", authenticate, folderController.closeFolder);
router.put("/:id", authenticate, folderController.updateFolder);

export default router;
