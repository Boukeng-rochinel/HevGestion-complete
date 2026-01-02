// src/routes/dsf-import.routes.ts
import { Router } from "express";
import multer from "multer";
import path from "path";
import { dsfImportController } from "../controllers/dsf-import.controller";
import { authenticate } from "../middleware/auth.middleware";
import { config } from "../config";

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, config.upload.directory);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(
      null,
      file.fieldname + "-" + uniqueSuffix + path.extname(file.originalname)
    );
  },
});

const upload = multer({
  storage,
  limits: {
    fileSize: config.upload.maxSize,
  },
  fileFilter: (req, file, cb) => {
    if (config.upload.allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Invalid file type. Only Excel files are allowed."));
    }
  },
});

const router = Router();

// Import DSF file
router.post(
  "/import",
  authenticate,
  upload.fields([{ name: "file", maxCount: 1 }]),
  dsfImportController.importDSFFile
);

// Get imports for a folder
router.get("/folder/:folderId", authenticate, dsfImportController.getImports);

// Get import details
router.get("/:importId", authenticate, dsfImportController.getImportDetails);

// Update entry match
router.put(
  "/entry/:entryId/match",
  authenticate,
  dsfImportController.updateEntryMatch
);

// Get mapping configurations
router.get(
  "/config/mappings",
  authenticate,
  dsfImportController.getMappingConfigs
);

export default router;
