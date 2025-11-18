// src/routes/balance.routes.ts
import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import { balanceController } from '../controllers/balance.controller';
import { authenticate } from '../middleware/auth.middleware';
import { config } from '../config';

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, config.upload.directory);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
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
      cb(new Error('Invalid file type. Only Excel files are allowed.'));
    }
  },
});

const router = Router();

router.post('/upload', authenticate, upload.fields([{ name: 'file', maxCount: 1 }]), balanceController.uploadBalance);
router.post('/create-from-template', authenticate, balanceController.createFromTemplate);
router.get('/folder/:folderId', authenticate, balanceController.getBalancesByFolder);
router.get('/:id', authenticate, balanceController.getBalanceById);
router.post('/:id/check-equilibrium', authenticate, balanceController.checkEquilibrium);
router.post('/:id/ventilation', authenticate, balanceController.performVentilation);
router.get('/:id/issues', authenticate, balanceController.getBalanceIssues);
router.post('/:id/resolve-issue', authenticate, balanceController.resolveIssue);
router.delete('/:id', authenticate, balanceController.deleteBalance);

export default router;