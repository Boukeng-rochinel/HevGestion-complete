// src/routes/dsf.routes.ts
import { Router } from "express";
import multer from "multer";
import path from "path";
import { dsfController } from "../controllers/dsf.controller";
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

router.post("/generate", authenticate, dsfController.generateDSF);
router.post(
  "/import",
  authenticate,
  upload.fields([{ name: "file", maxCount: 1 }]),
  dsfController.importDSF
);
router.get("/:folderId", authenticate, dsfController.getDSF);
router.post("/:id/validate", authenticate, dsfController.validateDSF);
router.post("/:id/export", authenticate, dsfController.exportDSF);
router.get(
  "/:id/coherence-report",
  authenticate,
  dsfController.getCoherenceReport
);

export default router;
