// routes/notes.routes.ts
import { Router } from "express";
import { notesController } from "../controllers/notes.controller";
import { authenticate } from "../middleware/auth.middleware";

const router = Router();

// All routes require authentication
router.use(authenticate);

// Note management routes
router.post("/save", notesController.saveNote.bind(notesController));
router.get(
  "/:folderId/:noteType",
  notesController.getNote.bind(notesController)
);
router.get(
  "/:folderId",
  notesController.getNotesForFolder.bind(notesController)
);

// Generate routes
router.get(
  "/generate/note1/:folderId",
  notesController.generateNote1.bind(notesController)
);

export default router;
