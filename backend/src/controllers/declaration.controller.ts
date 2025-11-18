// src/controllers/declaration.controller.ts
import { Response, NextFunction } from 'express';
import { AuthRequest } from '../middleware/auth.middleware';
import { prisma } from '../lib/prisma';
import { BadRequestError, NotFoundError } from '../lib/errors';
import { DGIService } from '../services/dgi.service';
import { TaxType, DeclarationStatus } from '@prisma/client';

class DeclarationController {
  private dgiService = new DGIService();

  async getDeclarations(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { folderId } = req.query;

      if (!folderId) {
        throw new BadRequestError('Folder ID is required');
      }

      const declarations = await prisma.taxDeclaration.findMany({
        where: { folderId: folderId as string },
        orderBy: { createdAt: 'desc' },
      });

      res.json({ declarations });
    } catch (error) {
      next(error);
    }
  }

  async createDeclaration(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { folderId, type, period, dueDate } = req.body;

      if (!folderId || !type || !period) {
        throw new BadRequestError('Folder ID, type, and period are required');
      }

      const folder = await prisma.folder.findUnique({
        where: { id: folderId },
      });

      if (!folder) {
        throw new NotFoundError('Exercise not found');
      }

      const declaration = await prisma.taxDeclaration.create({
        data: {
          folderId,
          type: type as TaxType,
          period,
          dueDate: new Date(dueDate),
          status: DeclarationStatus.PENDING,
        },
      });

      res.status(201).json({
        message: 'Declaration created successfully',
        declaration,
      });
    } catch (error) {
      next(error);
    }
  }

  async configureDeclaration(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const { niuNumber, apiPassword } = req.body;

      if (!niuNumber || !apiPassword) {
        throw new BadRequestError('NIU number and API password are required');
      }

      // Encrypt password
      const encryptedPassword = await this.dgiService.encryptPassword(apiPassword);

      const declaration = await prisma.taxDeclaration.update({
        where: { id },
        data: {
          niuNumber,
          apiPassword: encryptedPassword,
          status: DeclarationStatus.CONFIGURED,
        },
      });

      res.json({
        message: 'Declaration configured successfully',
        declaration: {
          id: declaration.id,
          niuNumber: declaration.niuNumber,
          status: declaration.status,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  async submitToDGI(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;

      const declaration = await prisma.taxDeclaration.findUnique({
        where: { id },
        include: {
          folder: {
            include: {
              company: true,
              dsf: true,
            },
          },
        },
      });

      if (!declaration) {
        throw new NotFoundError('Declaration not found');
      }

      if (declaration.status !== DeclarationStatus.CONFIGURED) {
        throw new BadRequestError('Declaration must be configured before submission');
      }

      if (!declaration.folder.dsf) {
        throw new BadRequestError('DSF not generated for this exercise');
      }

      // Update status to in progress
      await prisma.taxDeclaration.update({
        where: { id },
        data: { status: DeclarationStatus.IN_PROGRESS },
      });

      // Submit to DGI
      const result = await this.dgiService.submitDeclaration(declaration);

      // Update declaration with result
      await prisma.taxDeclaration.update({
        where: { id },
        data: {
          status: result.success ? DeclarationStatus.DECLARED : DeclarationStatus.PENDING,
          dsfId: result.dsfId,
          amountDue: result.amountDue,
          filedAt: result.success ? new Date() : null,
        },
      });

      res.json({
        message: result.success ? 'Declaration submitted successfully' : 'Declaration submission failed',
        result,
      });
    } catch (error) {
      // Update status back to configured on error
      await prisma.taxDeclaration.update({
        where: { id: req.params.id },
        data: { status: DeclarationStatus.CONFIGURED },
      });
      next(error);
    }
  }

  async getDeclarationStatus(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;

      const declaration = await prisma.taxDeclaration.findUnique({
        where: { id },
        include: {
          folder: {
            include: {
              company: true,
            },
          },
        },
      });

      if (!declaration) {
        throw new NotFoundError('Declaration not found');
      }

      // If declared, check status on DGI
      if (declaration.status === DeclarationStatus.DECLARED && declaration.dsfId) {
        const dgiStatus = await this.dgiService.checkDeclarationStatus(
          declaration.dsfId,
          declaration.niuNumber!
        );

        res.json({
          declaration,
          dgiStatus,
        });
      } else {
        res.json({ declaration });
      }
    } catch (error) {
      next(error);
    }
  }
}

export const declarationController = new DeclarationController();
