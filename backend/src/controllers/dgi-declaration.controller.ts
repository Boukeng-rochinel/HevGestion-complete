// controllers/dgi-declaration.controller.ts
import { Request, Response } from "express";
import { prisma } from "../lib/prisma";
import { AuthRequest } from "../middleware/auth.middleware";

interface DGIConfig {
  id?: string;
  companyName: string;
  niu: string;
  username: string;
  password: string;
  userId: string;
}

export class DGIDeclarationController {
  // Get DGI configuration for user
  async getConfig(req: AuthRequest, res: Response) {
    try {
      const { userId } = req.params;
      const userIdFromToken = req.user?.userId;

      // Ensure user can only access their own config
      if (userId !== userIdFromToken) {
        return res.status(403).json({
          success: false,
          message: "Accès non autorisé",
        });
      }

      const config = await prisma.dgiConfig.findUnique({
        where: { userId },
      });

      if (!config) {
        return res.status(404).json({
          success: false,
          message: "Configuration DGI non trouvée",
        });
      }

      res.json({
        success: true,
        data: {
          id: config.id,
          companyName: config.companyName,
          niu: config.niu,
          username: config.username,
          password: config.password, // Note: In production, this should be encrypted
          userId: config.userId,
        },
      });
    } catch (error) {
      console.error("Error fetching DGI config:", error);
      res.status(500).json({
        success: false,
        message: "Erreur lors de la récupération de la configuration",
      });
    }
  }

  // Save or update DGI configuration
  async saveConfig(req: AuthRequest, res: Response) {
    try {
      const configData: DGIConfig = req.body;
      const userIdFromToken = req.user?.userId;

      // Ensure user can only save their own config
      if (configData.userId !== userIdFromToken) {
        return res.status(403).json({
          success: false,
          message: "Accès non autorisé",
        });
      }

      const existingConfig = await prisma.dgiConfig.findUnique({
        where: { userId: configData.userId },
      });

      let config;
      if (existingConfig) {
        // Update existing config
        config = await prisma.dgiConfig.update({
          where: { id: existingConfig.id },
          data: {
            companyName: configData.companyName,
            niu: configData.niu,
            username: configData.username,
            password: configData.password, // Note: Should be encrypted in production
          },
        });
      } else {
        // Create new config
        config = await prisma.dgiConfig.create({
          data: {
            companyName: configData.companyName,
            niu: configData.niu,
            username: configData.username,
            password: configData.password, // Note: Should be encrypted in production
            userId: configData.userId,
          },
        });
      }

      res.json({
        success: true,
        data: {
          id: config.id,
          companyName: config.companyName,
          niu: config.niu,
          username: config.username,
          password: config.password,
          userId: config.userId,
        },
      });
    } catch (error) {
      console.error("Error saving DGI config:", error);
      res.status(500).json({
        success: false,
        message: "Erreur lors de la sauvegarde de la configuration",
      });
    }
  }

  // Update DGI configuration
  async updateConfig(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;
      const updates = req.body;
      const userIdFromToken = req.user?.userId;

      // Verify ownership
      const existingConfig = await prisma.dgiConfig.findUnique({
        where: { id },
      });

      if (!existingConfig || existingConfig.userId !== userIdFromToken) {
        return res.status(403).json({
          success: false,
          message: "Accès non autorisé",
        });
      }

      const config = await prisma.dgiConfig.update({
        where: { id },
        data: updates,
      });

      res.json({
        success: true,
        data: {
          id: config.id,
          companyName: config.companyName,
          niu: config.niu,
          username: config.username,
          password: config.password,
          userId: config.userId,
        },
      });
    } catch (error) {
      console.error("Error updating DGI config:", error);
      res.status(500).json({
        success: false,
        message: "Erreur lors de la mise à jour de la configuration",
      });
    }
  }

  // Submit DSF declaration
  async submitDeclaration(req: AuthRequest, res: Response) {
    try {
      const { folderId, userId } = req.body;
      const userIdFromToken = req.user?.userId;

      // Ensure user can only submit for themselves
      if (userId !== userIdFromToken) {
        return res.status(403).json({
          success: false,
          message: "Accès non autorisé",
        });
      }

      // Verify folder ownership
      const folder = await prisma.folder.findUnique({
        where: { id: folderId },
        include: { client: true },
      });

      if (!folder || folder.ownerId !== userId) {
        return res.status(403).json({
          success: false,
          message: "Dossier non trouvé ou accès non autorisé",
        });
      }

      // Generate declaration number
      const declarationNumber = `DSF${folder.fiscalYear}-${Date.now().toString().slice(-8)}`;

      // Create declaration record
      const declaration = await prisma.taxDeclaration.create({
        data: {
          folderId,
          type: "DSF",
          period: folder.fiscalYear.toString(),
          dueDate: new Date(), // Will be updated based on fiscal requirements
          status: "DECLARED",
          dsfId: declarationNumber,
        },
      });

      res.json({
        success: true,
        data: {
          declarationId: declaration.id,
          declarationNumber,
          submittedAt: declaration.createdAt.toISOString(),
          status: declaration.status,
          fiscalYear: folder.fiscalYear,
        },
      });
    } catch (error) {
      console.error("Error submitting declaration:", error);
      res.status(500).json({
        success: false,
        message: "Erreur lors de la soumission de la déclaration",
      });
    }
  }

  // Get declaration history for user
  async getDeclarationHistory(req: AuthRequest, res: Response) {
    try {
      const { userId } = req.params;
      const userIdFromToken = req.user?.userId;

      // Ensure user can only access their own history
      if (userId !== userIdFromToken) {
        return res.status(403).json({
          success: false,
          message: "Accès non autorisé",
        });
      }

      const declarations = await prisma.taxDeclaration.findMany({
        where: {
          folder: {
            ownerId: userId,
          },
        },
        include: {
          folder: {
            select: {
              fiscalYear: true,
              client: {
                select: { name: true },
              },
            },
          },
        },
        orderBy: { createdAt: "desc" },
      });

      const history = declarations.map((decl) => ({
        id: decl.id,
        declarationNumber: decl.dsfId || `DECL-${decl.id.slice(-8)}`,
        fiscalYear: parseInt(decl.period),
        submittedAt: decl.createdAt.toISOString(),
        status: decl.status,
        folderId: decl.folderId,
        userId: userIdFromToken,
      }));

      res.json({
        success: true,
        data: history,
      });
    } catch (error) {
      console.error("Error fetching declaration history:", error);
      res.status(500).json({
        success: false,
        message: "Erreur lors de la récupération de l'historique",
      });
    }
  }

  // Get declaration status
  async getDeclarationStatus(req: AuthRequest, res: Response) {
    try {
      const { declarationId } = req.params;
      const userIdFromToken = req.user?.userId;

      const declaration = await prisma.taxDeclaration.findUnique({
        where: { id: declarationId },
        include: {
          folder: {
            select: {
              fiscalYear: true,
              ownerId: true,
              client: {
                select: { name: true },
              },
            },
          },
        },
      });

      if (!declaration || declaration.folder.ownerId !== userIdFromToken) {
        return res.status(404).json({
          success: false,
          message: "Déclaration non trouvée",
        });
      }

      res.json({
        success: true,
        data: {
          id: declaration.id,
          declarationNumber:
            declaration.dsfId || `DECL-${declaration.id.slice(-8)}`,
          fiscalYear: parseInt(declaration.period),
          submittedAt: declaration.createdAt.toISOString(),
          status: declaration.status,
          folderId: declaration.folderId,
          userId: userIdFromToken,
        },
      });
    } catch (error) {
      console.error("Error fetching declaration status:", error);
      res.status(500).json({
        success: false,
        message: "Erreur lors de la récupération du statut",
      });
    }
  }

  // Validate DGI credentials (mock implementation)
  async validateCredentials(req: AuthRequest, res: Response) {
    try {
      const { username, password, niu } = req.body;

      // Mock validation - in production, this would connect to DGI API
      const isValid =
        username &&
        password &&
        niu &&
        username.includes("@") &&
        password.length >= 6 &&
        niu.length >= 12;

      res.json({
        success: true,
        valid: isValid,
        message: isValid ? "Identifiants valides" : "Identifiants invalides",
      });
    } catch (error) {
      console.error("Error validating credentials:", error);
      res.status(500).json({
        success: false,
        message: "Erreur lors de la validation",
      });
    }
  }
}

// Export singleton instance
export const dgiDeclarationController = new DGIDeclarationController();
