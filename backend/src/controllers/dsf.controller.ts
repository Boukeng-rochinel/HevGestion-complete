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
  DSFNoteType,
  DSFFicheType,
  DSFTaxTableType,
} from "@prisma/client";
import * as path from "path";
import * as XLSX from "xlsx";

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

  async updateDSF(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const { notes, signaletics, balanceSheet, incomeStatement, taxTables } =
        req.body;

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

      const results: any = {};

      // Update Notes
      if (notes && typeof notes === "object") {
        for (const [noteKey, noteData] of Object.entries(notes)) {
          const noteType = noteKey.toUpperCase() as any; // NOTE1, NOTE2, etc.

          if (noteData && typeof noteData === "object") {
            const existingNote = await prisma.dSFNotes.findFirst({
              where: {
                dsfId: id,
                noteType: noteType,
                isActive: true,
              },
              orderBy: { version: "desc" },
            });

            const newVersion = existingNote ? existingNote.version + 1 : 1;

            // Deactivate previous version
            if (existingNote) {
              await prisma.dSFNotes.update({
                where: { id: existingNote.id },
                data: { isActive: false },
              });
            }

            // Create new version
            const newNote = await prisma.dSFNotes.create({
              data: {
                dsfId: id,
                noteType: noteType,
                version: newVersion,
                headerInfo: (noteData as any).headerInfo,
                debts: (noteData as any).debts,
                commitments: (noteData as any).commitments,
                comment: (noteData as any).comment,
                createdBy: userId,
                updatedBy: userId,
              },
            });

            results.notes = results.notes || {};
            results.notes[noteKey] = newNote;
          }
        }
      }

      // Update Signaletics (Fiches)
      if (signaletics && typeof signaletics === "object") {
        for (const [ficheKey, ficheData] of Object.entries(signaletics)) {
          const ficheType = ficheKey.toUpperCase() as any; // R1, R2, etc.

          const existingFiche = await prisma.dSFSignaletics.findFirst({
            where: {
              dsfId: id,
              ficheType: ficheType,
              isActive: true,
            },
            orderBy: { version: "desc" },
          });

          const newVersion = existingFiche ? existingFiche.version + 1 : 1;

          // Deactivate previous version
          if (existingFiche) {
            await prisma.dSFSignaletics.update({
              where: { id: existingFiche.id },
              data: { isActive: false },
            });
          }

          // Create new version
          const newFiche = await prisma.dSFSignaletics.create({
            data: {
              dsfId: id,
              ficheType: ficheType,
              version: newVersion,
              data: ficheData as any,
              createdBy: userId,
              updatedBy: userId,
            },
          });

          results.signaletics = results.signaletics || {};
          results.signaletics[ficheKey] = newFiche;
        }
      }

      // Update Balance Sheet
      if (balanceSheet) {
        const existingBS = await prisma.dSFBalanceSheet.findFirst({
          where: { dsfId: id, isActive: true },
          orderBy: { version: "desc" },
        });

        const newVersion = existingBS ? existingBS.version + 1 : 1;

        if (existingBS) {
          await prisma.dSFBalanceSheet.update({
            where: { id: existingBS.id },
            data: { isActive: false },
          });
        }

        const newBS = await prisma.dSFBalanceSheet.create({
          data: {
            dsfId: id,
            version: newVersion,
            assets: balanceSheet.assets,
            liabilities: balanceSheet.liabilities,
            createdBy: userId,
            updatedBy: userId,
          },
        });

        results.balanceSheet = newBS;
      }

      // Update Income Statement
      if (incomeStatement) {
        const existingIS = await prisma.dSFIncomeStatement.findFirst({
          where: { dsfId: id, isActive: true },
          orderBy: { version: "desc" },
        });

        const newVersion = existingIS ? existingIS.version + 1 : 1;

        if (existingIS) {
          await prisma.dSFIncomeStatement.update({
            where: { id: existingIS.id },
            data: { isActive: false },
          });
        }

        const newIS = await prisma.dSFIncomeStatement.create({
          data: {
            dsfId: id,
            version: newVersion,
            revenues: incomeStatement.revenues,
            expenses: incomeStatement.expenses,
            result: incomeStatement.result,
            createdBy: userId,
            updatedBy: userId,
          },
        });

        results.incomeStatement = newIS;
      }

      // Update Tax Tables
      if (taxTables && typeof taxTables === "object") {
        for (const [tableKey, tableData] of Object.entries(taxTables)) {
          const tableType = tableKey.toUpperCase() as any;

          const existingTable = await prisma.dSFTaxTable.findFirst({
            where: {
              dsfId: id,
              tableType: tableType,
              isActive: true,
            },
            orderBy: { version: "desc" },
          });

          const newVersion = existingTable ? existingTable.version + 1 : 1;

          if (existingTable) {
            await prisma.dSFTaxTable.update({
              where: { id: existingTable.id },
              data: { isActive: false },
            });
          }

          const newTable = await prisma.dSFTaxTable.create({
            data: {
              dsfId: id,
              tableType: tableType,
              version: newVersion,
              data: tableData as any,
              createdBy: userId,
              updatedBy: userId,
            },
          });

          results.taxTables = results.taxTables || {};
          results.taxTables[tableKey] = newTable;
        }
      }

      // Update DSF lastGeneratedAt and userId if not set
      await prisma.dSF.update({
        where: { id },
        data: {
          lastGeneratedAt: new Date(),
          userId: dsf.userId || userId, // Set userId if not already set
        },
      });

      res.json({
        message: "DSF updated successfully",
        results,
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
