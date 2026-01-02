import { Response, NextFunction } from "express";
import { AuthRequest } from "../middleware/auth.middleware";
import { prisma } from "../lib/prisma";
import { BadRequestError, NotFoundError } from "../lib/errors";
import { DSFImportService } from "../services/dsf-import.service";

class DSFImportController {
  private dsfImportService = new DSFImportService();

  importDSFFile = async (
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const { folderId } = req.body;
      const file = req.files && "file" in req.files ? req.files.file[0] : null;

      if (!folderId) {
        throw new BadRequestError("Folder ID is required");
      }

      if (!file) {
        throw new BadRequestError("DSF file is required");
      }

      // Verify folder ownership
      const folder = await prisma.folder.findUnique({
        where: { id: folderId },
      });

      if (!folder) {
        throw new NotFoundError("Exercise not found");
      }

      if (folder.ownerId !== req.user?.userId) {
        throw new BadRequestError(
          "You don't have permission to import DSF for this exercise"
        );
      }

      // Import the file
      const importId = await this.dsfImportService.importDSFFile(
        file,
        folderId,
        req.user.userId
      );

      res.json({
        message: "DSF import started successfully",
        importId,
      });
    } catch (error) {
      next(error);
    }
  };

  getImports = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const { folderId } = req.params;

      // Verify folder ownership
      const folder = await prisma.folder.findUnique({
        where: { id: folderId },
      });

      if (!folder) {
        throw new NotFoundError("Exercise not found");
      }

      if (folder.ownerId !== req.user?.userId) {
        throw new BadRequestError(
          "You don't have permission to view imports for this exercise"
        );
      }

      const imports = await prisma.dSFImport.findMany({
        where: { folderId },
        include: {
          sheets: {
            include: {
              entries: {
                where: { matchConfidence: { lt: 80 } },
                take: 5, // Show only low confidence matches
              },
            },
          },
        },
        orderBy: { importedAt: "desc" },
      });

      res.json({ imports });
    } catch (error) {
      next(error);
    }
  };

  getImportDetails = async (
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const { importId } = req.params;

      const dsfImport = await prisma.dSFImport.findUnique({
        where: { id: importId },
        include: {
          folder: true,
          sheets: {
            include: {
              entries: {
                include: {
                  corrections: true,
                },
              },
            },
          },
        },
      });

      if (!dsfImport) {
        throw new NotFoundError("Import not found");
      }

      // Verify ownership
      if (dsfImport.folder.ownerId !== req.user?.userId) {
        throw new BadRequestError(
          "You don't have permission to view this import"
        );
      }

      res.json({ import: dsfImport });
    } catch (error) {
      next(error);
    }
  };

  updateEntryMatch = async (
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const { entryId } = req.params;
      const { matchedFieldId, isManualMatch, reason } = req.body;

      const entry = await prisma.dSFEntry.findUnique({
        where: { id: entryId },
        include: {
          import: {
            include: {
              folder: true,
            },
          },
        },
      });

      if (!entry) {
        throw new NotFoundError("Entry not found");
      }

      // Verify ownership
      if (entry.import.folder.ownerId !== req.user?.userId) {
        throw new BadRequestError(
          "You don't have permission to update this entry"
        );
      }

      // Store correction if this is a manual match
      if (isManualMatch) {
        await prisma.dSFEntryCorrection.create({
          data: {
            entryId,
            originalMatch: entry.matchedFieldId,
            correctedMatch: matchedFieldId,
            correctedBy: req.user.userId,
            reason,
          },
        });
      }

      // Update entry
      const updatedEntry = await prisma.dSFEntry.update({
        where: { id: entryId },
        data: {
          matchedFieldId,
          isManualMatch,
          isVerified: true,
        },
      });

      res.json({
        message: "Entry match updated successfully",
        entry: updatedEntry,
      });
    } catch (error) {
      next(error);
    }
  };

  getMappingConfigs = async (
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const configs = await prisma.dSFMappingConfig.findMany({
        include: {
          fields: true,
        },
      });

      res.json({ configs });
    } catch (error) {
      next(error);
    }
  };
}

export const dsfImportController = new DSFImportController();
