// src/controllers/dsf.controller.ts
import { Response, NextFunction } from "express";
import { AuthRequest } from "../middleware/auth.middleware";
import { prisma } from "../lib/prisma";
import { BadRequestError, NotFoundError } from "../lib/errors";
import { DSFGenerator } from "../services/dsf-generator.service";
import { DSFValidationService } from "../services/dsf-validation.service";
import {
  DSFStatus,
  FolderStatus,
  BalanceStatus,
  BalanceType,
} from "@prisma/client";
import * as path from "path";
import * as XLSX from "xlsx";
import * as fs from "fs/promises";

// Type pour les relations complètes du dossier
type FolderWithFullRelations = {
  id: string;
  name: string;
  description: string | null;
  status: FolderStatus;
  isActive: boolean;
  clientId: string;
  ownerId: string;
  fiscalYear: number;
  startDate: Date;
  endDate: Date;
  createdAt: Date;
  updatedAt: Date;
  client: {
    id: string;
    name: string;
    createdAt: Date;
    updatedAt: Date;
    legalForm: any;
    taxNumber: string | null;
    address: string | null;
    city: string | null;
    phone: string | null;
    country: any;
    currency: string;
    createdBy: string;
  };
  balances: {
    id: string;
    type: BalanceType;
    period: string;
    folderId: string;
    fileName: string;
    filePath: string | null;
    originalData: any;
    status: BalanceStatus;
    validationErrors: string | null;
    importedAt: Date;
    processedAt: Date | null;
    equilibrium: {
      id: string;
      balanceId: string;
      openingDebit: number;
      openingCredit: number;
      movementDebit: number;
      movementCredit: number;
      closingDebit: number;
      closingCredit: number;
      isBalanced: boolean;
      anomalies: string | null;
    } | null;
    fixedAssets: any[];
  }[];
};

class DSFController {
  private dsfGenerator = new DSFGenerator();
  private dsfValidationService = new DSFValidationService();
  generateDSF = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const { folderId } = req.body;

      if (!folderId) {
        throw new BadRequestError("Folder ID is required");
      }

      // Get folder with complete relations
      const folder = await prisma.folder.findUnique({
        where: { id: folderId },
        include: {
          client: {
            select: {
              id: true,
              name: true,
              legalForm: true,
              clientType: true,
              taxNumber: true,
              address: true,
              city: true,
              phone: true,
              country: true,
              currency: true,
              createdBy: true,
            },
          },
          balances: {
            where: { status: BalanceStatus.PROCESSED },
            include: {
              equilibrium: true,
              fixedAssets: true,
            },
          },
        },
      });

      if (!folder) {
        throw new NotFoundError("Exercise not found");
      }

      // Vérifier que le dossier a les relations nécessaires
      if (!folder.client) {
        throw new BadRequestError(
          "Client information is missing for this folder"
        );
      }

      if (!folder.balances || folder.balances.length === 0) {
        throw new BadRequestError(
          "No processed balances found for this folder"
        );
      }

      // Check if N balance exists
      const nBalance = folder.balances.find(
        (b) => b.type === BalanceType.CURRENT_YEAR
      );
      if (!nBalance) {
        throw new BadRequestError(
          "Current year balance not found or not processed"
        );
      }

      // Type assertion pour garantir la compatibilité
      const folderWithRelations = folder as unknown as FolderWithFullRelations;

      // Check if DSF already exists
      let dsf = await prisma.dSF.findUnique({
        where: { folderId },
      });

      if (dsf) {
        // Regenerate
        const reports = await this.dsfGenerator.generate(folderWithRelations);

        dsf = await prisma.dSF.update({
          where: { id: dsf.id },
          data: {
            status: DSFStatus.GENERATED,
            reports: reports as any,
            lastGeneratedAt: new Date(),
          },
        });
      } else {
        // Create new DSF
        const reports = await this.dsfGenerator.generate(folderWithRelations);

        dsf = await prisma.dSF.create({
          data: {
            folderId,
            status: DSFStatus.GENERATED,
            reports: reports as any,
            lastGeneratedAt: new Date(),
          },
        });

        // Update folder status
        await prisma.folder.update({
          where: { id: folderId },
          data: { status: FolderStatus.DSF_GENERATED },
        });
      }

      res.json({
        message: "DSF generated successfully",
        dsf: {
          id: dsf.id,
          status: dsf.status,
          lastGeneratedAt: dsf.lastGeneratedAt,
        },
      });
    } catch (error) {
      next(error);
    }
  };
  getDSF = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const { folderId } = req.params;

      const dsf = await prisma.dSF.findUnique({
        where: { folderId },
        include: {
          folder: {
            include: {
              client: true,
              balances: {
                include: {
                  equilibrium: true,
                  fixedAssets: true,
                },
              },
            },
          },
          coherenceControl: true,
        },
      });

      if (!dsf) {
        throw new NotFoundError("DSF not found for this exercise");
      }

      res.json({ dsf });
    } catch (error) {
      next(error);
    }
  };
  validateDSF = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;

      const dsf = await prisma.dSF.findUnique({
        where: { id },
        include: {
          folder: {
            include: {
              client: true,
              balances: {
                include: {
                  equilibrium: true,
                  fixedAssets: true,
                },
              },
            },
          },
        },
      });

      if (!dsf) {
        throw new NotFoundError("DSF not found");
      }

      // Type assertion pour la cohérence des types
      const dsfWithRelations = {
        ...dsf,
        folder: dsf.folder as unknown as FolderWithFullRelations,
      };

      // Perform coherence control
      const coherenceResult =
        await this.dsfGenerator.performCoherenceControl(dsfWithRelations);

      // Update or create coherence control
      await prisma.coherenceControl.upsert({
        where: { dsfId: id },
        create: {
          dsfId: id,
          isCoherent: coherenceResult.isCoherent,
          issues: coherenceResult.issues,
          performedAt: new Date(),
        },
        update: {
          isCoherent: coherenceResult.isCoherent,
          issues: coherenceResult.issues,
          performedAt: new Date(),
        },
      });

      // Update DSF status
      await prisma.dSF.update({
        where: { id },
        data: {
          status: coherenceResult.isCoherent
            ? DSFStatus.VALID
            : DSFStatus.VALIDATING,
        },
      });

      // Update folder status if valid
      if (coherenceResult.isCoherent) {
        await prisma.folder.update({
          where: { id: dsf.folderId },
          data: { status: FolderStatus.DSF_VALIDATED },
        });
      }

      res.json({
        message: "DSF validation completed",
        isValid: coherenceResult.isCoherent,
        issues: coherenceResult.issues,
      });
    } catch (error) {
      next(error);
    }
  };
  exportDSF = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const { format } = req.query;

      const dsf = await prisma.dSF.findUnique({
        where: { id },
        include: {
          folder: {
            include: {
              client: true,
              balances: {
                include: {
                  equilibrium: true,
                  fixedAssets: true,
                },
              },
            },
          },
        },
      });

      if (!dsf) {
        throw new NotFoundError("DSF not found");
      }

      if (dsf.status !== DSFStatus.VALID) {
        throw new BadRequestError("DSF must be validated before export");
      }

      // Type assertion pour l'export
      const dsfWithRelations = {
        ...dsf,
        folder: dsf.folder as unknown as FolderWithFullRelations,
      };

      // Generate Excel file
      const filePath = await this.dsfGenerator.exportToExcel(dsfWithRelations);

      // Update DSF status
      await prisma.dSF.update({
        where: { id },
        data: { status: DSFStatus.EXPORTED },
      });

      res.json({
        message: "DSF exported successfully",
        downloadUrl: `/api/files/download/${path.basename(filePath)}`,
      });
    } catch (error) {
      next(error);
    }
  };
  updateDSF = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const { reports } = req.body;

      const dsf = await prisma.dSF.findUnique({
        where: { id },
        include: {
          folder: true,
        },
      });

      if (!dsf) {
        throw new NotFoundError("DSF not found");
      }

      // Verify ownership (check both direct user and folder owner)
      const userId = req.user?.userId!;
      if (dsf.userId !== userId && dsf.folder.ownerId !== userId) {
        throw new BadRequestError(
          "You don't have permission to update this DSF"
        );
      }

      // Update reports array
      if (reports && Array.isArray(reports)) {
        // Merge with existing reports or replace completely
        const currentReports = (dsf.reports as any[]) || [];
        const updatedReports = [...currentReports];

        // Update or add reports based on type
        reports.forEach((newReport: any) => {
          const existingIndex = updatedReports.findIndex(
            (r) => r.type === newReport.type
          );

          if (existingIndex !== -1) {
            // Update existing report
            updatedReports[existingIndex] = {
              ...updatedReports[existingIndex],
              data: {
                ...updatedReports[existingIndex].data,
                ...newReport.data,
              },
            };
          } else {
            // Add new report
            updatedReports.push(newReport);
          }
        });

        await prisma.dSF.update({
          where: { id },
          data: {
            reports: updatedReports as any,
            lastGeneratedAt: new Date(),
            userId: dsf.userId || userId, // Set userId if not already set
          },
        });
      }

      res.json({
        message: "DSF updated successfully",
      });
    } catch (error) {
      next(error);
    }
  };

  getCoherenceReport = async (
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const { id } = req.params;

      const coherenceControl = await prisma.coherenceControl.findUnique({
        where: { dsfId: id },
        include: {
          dsf: {
            include: {
              folder: {
                include: {
                  client: true,
                },
              },
            },
          },
        },
      });

      if (!coherenceControl) {
        throw new NotFoundError(
          "Coherence control not found. Please validate DSF first."
        );
      }

      res.json({ coherenceControl });
    } catch (error) {
      next(error);
    }
  };

  importDSF = async (req: AuthRequest, res: Response, next: NextFunction) => {
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
        include: { client: true },
      });

      if (!folder) {
        throw new NotFoundError("Exercise not found");
      }

      if (folder.ownerId !== req.user?.userId) {
        throw new BadRequestError(
          "You don't have permission to import DSF for this exercise"
        );
      }

      // Validate DSF file
      const validationResult = await this.dsfValidationService.validateDSFFile(
        file.path
      );
      if (!validationResult.isValid) {
        // Clean up uploaded file
        await fs.unlink(file.path).catch(() => {}); // Ignore cleanup errors
        throw new BadRequestError(
          `DSF validation failed: ${validationResult.errors.join(", ")}`
        );
      }

      // Parse Excel file
      const workbook = XLSX.readFile(file.path);

      // Extract data using validation service
      const extractedData = this.dsfValidationService.extractDSFData(workbook);
      const { taxTables, notes, signaletics } = extractedData;

      // Validate extracted data structure
      if (!notes && !signaletics) {
        throw new BadRequestError(
          "DSF file must contain at least notes or signaletics data"
        );
      }

      // Sanitize data for database storage
      const sanitizeForDB = (data: any) => {
        if (data === null || data === undefined) return null;
        if (typeof data === "object" && !Array.isArray(data)) {
          const sanitized: any = {};
          for (const [key, value] of Object.entries(data)) {
            if (value !== null && value !== undefined) {
              sanitized[key] = sanitizeForDB(value);
            }
          }
          return Object.keys(sanitized).length > 0 ? sanitized : null;
        }
        if (Array.isArray(data)) {
          return data.filter((item) => item !== null && item !== undefined);
        }
        return data;
      };

      // Valid DSF field names
      const validFields = [
        "note1",
        "note2",
        "note3a",
        "note3b",
        "note4",
        "note5",
        "note6",
        "note7",
        "note8",
        "note9",
        "note10",
        "note11",
        "note12",
        "note13",
        "note14",
        "note15",
        "note16",
        "note17",
        "note18",
        "note19",
        "note20",
        "note21",
        "note22",
        "note23",
        "note24",
        "note25",
        "note26",
        "note27",
        "note28",
        "note29",
        "note30",
        "note31",
        "note32",
        "note33",
        "fiche1",
        "fiche2",
        "fiche3",
        "cter",
        "cf1",
      ];

      // Map notes data to individual DSF fields
      const mappedData: any = {};

      if (notes) {
        // notes is an object with keys like 'note1', 'note2', 'fiche1', etc.
        Object.entries(notes).forEach(([key, value]) => {
          if (
            validFields.includes(key) &&
            value !== null &&
            value !== undefined
          ) {
            mappedData[key] = sanitizeForDB(value);
          }
        });
      }

      if (signaletics) {
        // signaletics contains fiche data
        Object.entries(signaletics).forEach(([key, value]) => {
          if (
            validFields.includes(key) &&
            value !== null &&
            value !== undefined
          ) {
            mappedData[key] = sanitizeForDB(value);
          }
        });
      }

      const sanitizedData = mappedData;

      // Check if DSF already exists
      let dsf = await prisma.dSF.findUnique({
        where: { folderId },
      });

      if (dsf) {
        // Update existing DSF
        dsf = await prisma.dSF.update({
          where: { id: dsf.id },
          data: {
            status: DSFStatus.GENERATED,
            ...sanitizedData,
            lastGeneratedAt: new Date(),
          },
        });
      } else {
        // Create new DSF
        dsf = await prisma.dSF.create({
          data: {
            folderId,
            status: DSFStatus.GENERATED,
            ...sanitizedData,
            lastGeneratedAt: new Date(),
          },
        });

        // Update folder status
        await prisma.folder.update({
          where: { id: folderId },
          data: { status: FolderStatus.DSF_GENERATED },
        });
      }

      res.json({
        message: "DSF imported successfully",
        dsf: {
          id: dsf.id,
          status: dsf.status,
          lastGeneratedAt: dsf.lastGeneratedAt,
        },
      });

      await fs.unlink(file.path).catch(() => {});
    } catch (error) {
      next(error);
    }
  };
}

export const dsfController = new DSFController();
