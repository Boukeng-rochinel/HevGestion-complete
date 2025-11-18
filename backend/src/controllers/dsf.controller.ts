// src/controllers/dsf.controller.ts
import { Response, NextFunction } from "express";
import { AuthRequest } from "../middleware/auth.middleware";
import { prisma } from "../lib/prisma";
import { BadRequestError, NotFoundError } from "../lib/errors";
import { DSFGenerator } from "../services/dsf-generator.service";
import {
  DSFStatus,
  FolderStatus,
  BalanceStatus,
  BalanceType,
} from "@prisma/client";
import * as path from "path";
import * as XLSX from "xlsx";

// Type pour les relations complètes du dossier
type FolderWithFullRelations = {
  id: string;
  name: string;
  description: string | null;
  status: FolderStatus;
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
    legalForm: any;
    taxNumber: string | null;
    address: string | null;
    city: string | null;
    phone: string | null;
    currency: string;
    createdAt: Date;
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

  async generateDSF(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { folderId } = req.body;

      if (!folderId) {
        throw new BadRequestError("Folder ID is required");
      }

      // Get folder with complete relations
      const folder = await prisma.folder.findUnique({
        where: { id: folderId },
        include: {
          client: true,
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
        const dsfData = await this.dsfGenerator.generate(folderWithRelations);

        dsf = await prisma.dSF.update({
          where: { id: dsf.id },
          data: {
            status: DSFStatus.GENERATED,
            balanceSheet: dsfData.balanceSheet,
            incomeStatement: dsfData.incomeStatement,
            taxTables: dsfData.taxTables,
            notes: dsfData.notes,
            signaletics: dsfData.signaletics,
            lastGeneratedAt: new Date(),
          },
        });
      } else {
        // Create new DSF
        const dsfData = await this.dsfGenerator.generate(folderWithRelations);

        dsf = await prisma.dSF.create({
          data: {
            folderId,
            status: DSFStatus.GENERATED,
            balanceSheet: dsfData.balanceSheet,
            incomeStatement: dsfData.incomeStatement,
            taxTables: dsfData.taxTables,
            notes: dsfData.notes,
            signaletics: dsfData.signaletics,
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
  }

  async getDSF(req: AuthRequest, res: Response, next: NextFunction) {
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
  }

  async validateDSF(req: AuthRequest, res: Response, next: NextFunction) {
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
  }

  async exportDSF(req: AuthRequest, res: Response, next: NextFunction) {
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
  }

  async getCoherenceReport(
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ) {
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
  }

  async importDSF(req: AuthRequest, res: Response, next: NextFunction) {
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

      // Parse Excel file
      const XLSX = require("xlsx");
      const workbook = XLSX.readFile(file.path);
      const sheetNames = workbook.SheetNames;

      // Extract data from different sheets
      const balanceSheet = this.extractSheetData(workbook, "Bilan");
      const incomeStatement = this.extractSheetData(
        workbook,
        "Compte de Résultat"
      );
      const taxTables = this.extractSheetData(workbook, "Tableaux Fiscaux");
      const notes = this.extractNotesData(workbook);
      const signaletics = this.extractSignaleticsData(workbook);

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
            balanceSheet,
            incomeStatement,
            taxTables,
            notes,
            signaletics,
            lastGeneratedAt: new Date(),
          },
        });
      } else {
        // Create new DSF
        dsf = await prisma.dSF.create({
          data: {
            folderId,
            status: DSFStatus.GENERATED,
            balanceSheet,
            incomeStatement,
            taxTables,
            notes,
            signaletics,
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
    } catch (error) {
      next(error);
    }
  }

  private extractSheetData(workbook: any, sheetName: string): any {
    const sheet = workbook.Sheets[sheetName];
    if (!sheet) return {};

    return XLSX.utils.sheet_to_json(sheet, { header: 1 });
  }

  private extractNotesData(workbook: any): any {
    const notes: any = {};

    // Extract notes from sheets starting with 'Note'
    workbook.SheetNames.forEach((sheetName: string) => {
      if (sheetName.startsWith("Note")) {
        notes[sheetName.toLowerCase()] = this.extractSheetData(
          workbook,
          sheetName
        );
      }
    });

    return notes;
  }

  private extractSignaleticsData(workbook: any): any {
    const signaletics: any = {};

    // Extract signaletics sheets (r1, r2, r3, r4, r4Bis)
    ["r1", "r2", "r3", "r4", "r4Bis"].forEach((fiche) => {
      const sheet = workbook.Sheets[fiche];
      if (sheet) {
        signaletics[fiche] = XLSX.utils.sheet_to_json(sheet, { header: 1 });
      }
    });

    return signaletics;
  }
}

export const dsfController = new DSFController();
