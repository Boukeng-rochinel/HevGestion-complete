// routes/report.routes.ts
import { Router } from "express";
import { reportController } from "../controllers/report.controller";
import { authenticate } from "../middleware/auth.middleware";
import multer from "multer";

const router = Router();

// Configure multer for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB limit
  },
  fileFilter: (req, file, cb) => {
    // Accept only Excel files
    if (
      file.mimetype ===
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" ||
      file.mimetype === "application/vnd.ms-excel" ||
      file.originalname.endsWith(".xlsx") ||
      file.originalname.endsWith(".xls")
    ) {
      cb(null, true);
    } else {
      cb(new Error("Only Excel files are allowed"));
    }
  },
});

// All routes require authentication
router.use(authenticate);

// Report management routes
router.get("/", reportController.getReports.bind(reportController));
router.get("/status", reportController.checkFileStatus.bind(reportController));

// File download routes
router.get(
  "/download",
  reportController.downloadCompleteFile.bind(reportController)
);
router.get(
  "/download/:sheetName/:reportName?",
  reportController.downloadSheet.bind(reportController)
);

// Preview routes
router.get(
  "/preview/:sheetName",
  reportController.getSheetPreview.bind(reportController)
);

// File upload route
router.post(
  "/upload",
  upload.single("file"),
  reportController.uploadFile.bind(reportController)
);

export default router;
