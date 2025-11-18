// src/controllers/balance.controller.ts
import { Response, NextFunction } from "express";
import { AuthRequest } from "../middleware/auth.middleware";
import { prisma } from "../lib/prisma";
import { BadRequestError, NotFoundError, ForbiddenError } from "../lib/errors";
import { BalanceType, BalanceStatus } from "@prisma/client";
import { BalanceProcessor } from "../services/balance-processor.service";
import { ExcelService } from "../services/excel.service";
import * as path from "path";

class BalanceController {
  private balanceProcessor: BalanceProcessor;

  constructor() {
    this.balanceProcessor = new BalanceProcessor();
    console.log("✅ BalanceController initialized with balanceProcessor");
  }

  async uploadBalance(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      console.log("Upload balance request received:");
      console.log("Body:", req.body);
      console.log("Raw body keys:", Object.keys(req.body || {}));
      console.log("Files:", req.files);

      const file = req.files && "file" in req.files ? req.files.file[0] : null;
      console.log(
        "File:",
        file
          ? {
              filename: file.filename,
              size: file.size,
              originalname: file.originalname,
            }
          : "No file"
      );

      if (!file) {
        throw new BadRequestError("No file uploaded");
      }

      const { folderId, type } = req.body;

      console.log("Parsed data:", {
        folderId,
        type,
        folderIdType: typeof folderId,
        typeType: typeof type,
      });

      if (!folderId || !type) {
        throw new BadRequestError("Folder ID and balance type are required");
      }

      // Validate folder access
      console.log("Checking folder with ID:", folderId);
      const folder = await prisma.folder.findUnique({
        where: { id: folderId },
        include: { owner: true },
      });

      console.log("Folder found:", folder);

      if (!folder) {
        throw new NotFoundError("Exercise not found");
      }

      // Check if user owns the folder
      if (folder.ownerId !== req.user?.userId) {
        throw new ForbiddenError("You don't have access to this exercise");
      }

      // Map frontend type to database enum
      let balanceType: BalanceType;
      let balancePeriod: string;

      if (type === "current") {
        balanceType = BalanceType.CURRENT_YEAR;
        balancePeriod = folder.fiscalYear.toString();
      } else if (type === "previous") {
        balanceType = BalanceType.PREVIOUS_YEAR;
        balancePeriod = folder.fiscalYear.toString();
      } else {
        throw new BadRequestError(
          "Invalid balance type. Must be 'current' or 'previous'"
        );
      }

      // Check if balance already exists
      console.log("Checking for existing balance:", {
        folderId,
        type: balanceType,
      });
      const existingBalance = await prisma.balance.findFirst({
        where: {
          folderId,
          type: balanceType,
        },
      });

      console.log("Existing balance:", existingBalance);

      if (existingBalance) {
        // Allow replacement of existing balance
        console.log("Replacing existing balance:", existingBalance.id);
        // Delete the existing balance
        await prisma.balance.delete({
          where: { id: existingBalance.id },
        });
      }

      // Read and parse Excel file
      console.log("Parsing Excel file:", file.path);
      const data = await ExcelService.parseBalanceFile(file.path);
      console.log("Parsed data successfully:", {
        rowCount: data.rows?.length || 0,
      });

      console.log(balancePeriod);

      // Create balance record
      const balance = await prisma.balance.create({
        data: {
          type: balanceType,
          period: balancePeriod,
          folderId,
          fileName: file.originalname,
          filePath: file.path,
          originalData: data,
          status: BalanceStatus.PENDING,
        },
      });

      // Process balance synchronously for now
      try {
        await this.balanceProcessor.processBalance(balance.id);
        console.log(`Balance ${balance.id} processed successfully`);
      } catch (processError) {
        console.error("Balance processing error:", processError);
        // Update status but don't fail the upload
        await prisma.balance.update({
          where: { id: balance.id },
          data: {
            status: BalanceStatus.INVALID,
            validationErrors:
              processError instanceof Error
                ? processError.message
                : "Processing failed",
          },
        });
      }

      res.status(201).json({
        message: "Balance uploaded and processed successfully",
        balance: {
          id: balance.id,
          type: balance.type,
          status: balance.status,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  async createFromTemplate(
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ) {
    try {
      const { folderId } = req.body;

      const folder = await prisma.folder.findUnique({
        where: { id: folderId },
      });

      if (!folder) {
        throw new NotFoundError("Exercise not found");
      }

      // Get balance template from database
      const template = await ExcelService.getBalanceTemplate();

      // Create Excel file from template
      const filePath = await ExcelService.createBalanceFromTemplate(
        template,
        folder.fiscalYear
      );

      res.json({
        message: "Balance created from template",
        downloadUrl: `/api/files/download/${path.basename(filePath)}`,
      });
    } catch (error) {
      next(error);
    }
  }

  async getBalancesByFolder(
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ) {
    try {
      const { folderId } = req.params;

      if (!folderId) {
        throw new BadRequestError("Folder ID is required");
      }

      // Check if user has access to the folder
      const folder = await prisma.folder.findUnique({
        where: { id: folderId },
      });

      if (!folder) {
        throw new NotFoundError("Folder not found");
      }

      if (folder.ownerId !== req.user?.userId) {
        throw new ForbiddenError("You don't have access to this folder");
      }

      const balances = await prisma.balance.findMany({
        where: { folderId },
        include: {
          equilibrium: true,
          accountIssues: {
            orderBy: { severity: "desc" },
          },
          fixedAssets: true,
          folder: {
            include: {
              client: true,
            },
          },
        },
        orderBy: { importedAt: "desc" },
      });

      res.json({ balances });
    } catch (error) {
      next(error);
    }
  }

  async getBalanceById(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;

      const balance = await prisma.balance.findUnique({
        where: { id },
        include: {
          equilibrium: true,
          accountIssues: {
            orderBy: { severity: "desc" },
          },
          fixedAssets: true,
          folder: true,
        },
      });

      if (!balance) {
        throw new NotFoundError("Balance not found");
      }

      res.json({ balance });
    } catch (error) {
      next(error);
    }
  }

  async checkEquilibrium(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { clientId, folderId } = req.params;

      console.log("🔍 Checking equilibrium for:", { clientId, folderId });

      if (!clientId || !folderId) {
        throw new BadRequestError("Client ID and Folder ID are required");
      }

      // Vérifier que le contrôleur est correctement initialisé
      if (!this.balanceProcessor) {
        console.error("❌ balanceProcessor is not initialized");
        // Réinitialiser en cas de problème
        this.balanceProcessor = new BalanceProcessor();
        console.log("✅ balanceProcessor reinitialized");
      }

      // Vérifier l'accès au dossier
      const folder = await prisma.folder.findUnique({
        where: { id: folderId },
        include: {
          balances: {
            include: {
              equilibrium: true,
            },
          },
        },
      });

      if (!folder) {
        throw new NotFoundError("Exercise not found");
      }

      // Vérifier que l'utilisateur a accès à ce client/dossier
      if (folder.ownerId !== req.user?.userId) {
        throw new ForbiddenError("You don't have access to this exercise");
      }

      console.log("📊 Folder balances:", folder.balances.length);

      // Vérifier s'il y a des balances
      if (!folder.balances || folder.balances.length === 0) {
        return res.json({
          isBalanced: false,
          message: "Aucune balance trouvée pour cet exercice",
          details: {
            hasBalances: false,
            currentYear: null,
            previousYear: null,
          },
        });
      }

      // Récupérer les balances actuelles et précédentes
      const currentBalance = folder.balances.find(
        (b) => b.type === BalanceType.CURRENT_YEAR
      );

      const previousBalance = folder.balances.find(
        (b) => b.type === BalanceType.PREVIOUS_YEAR
      );

      console.log("📈 Balances found:", {
        current: currentBalance?.id,
        previous: previousBalance?.id,
      });

      // Vérifier l'équilibre
      let equilibrium;

      if (currentBalance) {
        console.log(
          "🔄 Checking equilibrium for current balance:",
          currentBalance.id
        );
        equilibrium =
          await this.balanceProcessor.checkEquilibrium(currentBalance);
        console.log("✅ Equilibrium result:", equilibrium);
      } else {
        equilibrium = {
          isBalanced: false,
          message: "Balance de l'année courante manquante",
          details: {
            totalDebit: 0,
            totalCredit: 0,
            difference: 0,
            tolerance: 0.01,
          },
        };
      }

      res.json({
        isBalanced: equilibrium.isBalanced,
        message: equilibrium.message,
        details: {
          hasBalances: !!currentBalance,
          currentYear: currentBalance
            ? {
                id: currentBalance.id,
                type: currentBalance.type,
                status: currentBalance.status,
                isBalanced: equilibrium.isBalanced,
                totals: equilibrium.details,
              }
            : null,
          previousYear: previousBalance
            ? {
                id: previousBalance.id,
                type: previousBalance.type,
                status: previousBalance.status,
              }
            : null,
        },
      });
    } catch (error) {
      console.error("❌ Error in checkEquilibrium:", error);

      // En cas d'erreur, retourner une réponse d'erreur structurée
      if (error instanceof NotFoundError || error instanceof ForbiddenError) {
        next(error);
      } else {
        // Pour les autres erreurs, retourner un statut non équilibré avec le message d'erreur
        res.json({
          isBalanced: false,
          message: `Erreur lors de la vérification: ${error instanceof Error ? error.message : "Erreur inconnue"}`,
          details: {
            hasBalances: false,
            error: true,
            errorMessage:
              error instanceof Error ? error.message : "Unknown error",
          },
        });
      }
    }
  }

  async performVentilation(
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ) {
    try {
      const { id } = req.params;

      const balance = await prisma.balance.findUnique({
        where: { id },
      });

      if (!balance) {
        throw new NotFoundError("Balance not found");
      }

      // Perform ventilation (breakdown of accounts)
      const result = await this.balanceProcessor.performVentilation(balance);

      res.json({
        message: "Ventilation completed successfully",
        result,
      });
    } catch (error) {
      next(error);
    }
  }

  async getBalanceIssues(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;

      const issues = await prisma.accountIssue.findMany({
        where: { balanceId: id },
        orderBy: [{ severity: "desc" }, { isResolved: "asc" }],
      });

      res.json({ issues });
    } catch (error) {
      next(error);
    }
  }

  async resolveIssue(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const { issueId, resolution } = req.body;

      if (!issueId) {
        throw new BadRequestError("Issue ID is required");
      }

      const issue = await prisma.accountIssue.update({
        where: { id: issueId },
        data: {
          isResolved: true,
          resolvedAt: new Date(),
          resolution,
        },
      });

      res.json({
        message: "Issue resolved successfully",
        issue,
      });
    } catch (error) {
      next(error);
    }
  }

  async deleteBalance(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;

      if (!id) {
        throw new BadRequestError("Balance ID is required");
      }

      // Check if balance exists and user has access
      const balance = await prisma.balance.findUnique({
        where: { id },
        include: {
          folder: true,
        },
      });

      if (!balance) {
        throw new NotFoundError("Balance not found");
      }

      // Check if user owns the folder
      if (balance.folder.ownerId !== req.user?.userId) {
        throw new ForbiddenError("You don't have access to this balance");
      }

      // Delete the balance
      await prisma.balance.delete({
        where: { id },
      });

      res.json({
        message: "Balance deleted successfully",
      });
    } catch (error) {
      next(error);
    }
  }

  // Helper to process balance asynchronously
  private processBalanceAsync = async (balanceId: string) => {
    try {
      await this.balanceProcessor.processBalance(balanceId);
    } catch (error) {
      console.error("Balance processing error:", error);
      await prisma.balance.update({
        where: { id: balanceId },
        data: {
          status: BalanceStatus.INVALID,
          validationErrors:
            error instanceof Error ? error.message : "Processing failed",
        },
      });
    }
  };
}

// Créer une instance avec initialisation explicite
export const balanceController = new BalanceController();
console.log("✅ BalanceController instance created");
