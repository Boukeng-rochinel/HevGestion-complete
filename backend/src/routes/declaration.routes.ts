// src/routes/declaration.routes.ts
import { Router } from 'express';
import { declarationController } from '../controllers/declaration.controller';
import { authenticate } from '../middleware/auth.middleware';

const router = Router();

router.get('/', authenticate, declarationController.getDeclarations);
router.post('/', authenticate, declarationController.createDeclaration);
router.put('/:id/configure', authenticate, declarationController.configureDeclaration);
router.post('/:id/submit-to-dgi', authenticate, declarationController.submitToDGI);
router.get('/:id/status', authenticate, declarationController.getDeclarationStatus);

export default router;