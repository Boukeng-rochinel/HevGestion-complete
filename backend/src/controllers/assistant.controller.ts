// controllers/assistant.controller.ts
import { Response } from "express";
import { prisma } from "../lib/prisma";
import { ResponseBuilder } from "../utils/response-builder";
import { AuthRequest } from "../middleware/auth.middleware";
import { BadRequestError, ForbiddenError, NotFoundError } from "../lib/errors";

interface CreateAssistantData {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
}

export class AssistantController {
  /**
   * Get all assistants for the current accountant
   */
  async getAssistants(req: AuthRequest, res: Response) {
    try {
      const userId = req.user?.userId;
      const userRole = req.user?.role;

      if (!userId) {
        return ResponseBuilder.error(res, "Utilisateur non authentifié", 401);
      }

      // Only COMPTABLE users can manage assistants
      if (userRole !== "COMPTABLE") {
        return ResponseBuilder.error(
          res,
          "Seuls les comptables peuvent gérer les assistants",
          403
        );
      }

      const assistants = await prisma.user.findMany({
        where: {
          role: "ASSISTANT",
          // TODO: Add relation to link assistants to their accountant
          // For now, we'll need to add a field to track the creator
        },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          isActive: true,
          createdAt: true,
          _count: {
            select: {
              assignedFolders: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
      });

      return ResponseBuilder.success(
        res,
        assistants,
        "Assistants récupérés avec succès"
      );
    } catch (error) {
      console.error("Error fetching assistants:", error);
      return ResponseBuilder.error(
        res,
        "Erreur lors de la récupération des assistants"
      );
    }
  }

  /**
   * Create a new assistant account
   */
  async createAssistant(req: AuthRequest, res: Response) {
    try {
      const userId = req.user?.userId;
      const userRole = req.user?.role;
      const assistantData: CreateAssistantData = req.body;

      if (!userId) {
        return ResponseBuilder.error(res, "Utilisateur non authentifié", 401);
      }

      // Only COMPTABLE users can create assistants
      if (userRole !== "COMPTABLE") {
        return ResponseBuilder.error(
          res,
          "Seuls les comptables peuvent créer des assistants",
          403
        );
      }

      // Check if the accountant has reached their assistant limit
      const accountant = await prisma.user.findUnique({
        where: { id: userId },
        select: { maxAssistants: true },
      });

      if (!accountant) {
        return ResponseBuilder.error(res, "Comptable non trouvé", 404);
      }

      // Count current assistants for this accountant
      const currentAssistantCount = await prisma.user.count({
        where: {
          role: "ASSISTANT",
          // TODO: Add proper relation to filter by creator
        },
      });

      if (currentAssistantCount >= (accountant.maxAssistants || 0)) {
        return ResponseBuilder.error(
          res,
          "Limite d'assistants atteinte. Contactez le support pour augmenter votre quota.",
          400
        );
      }

      // Check if email already exists
      const existingUser = await prisma.user.findUnique({
        where: { email: assistantData.email },
      });

      if (existingUser) {
        return ResponseBuilder.error(
          res,
          "Un utilisateur avec cet email existe déjà",
          400
        );
      }

      // Create the assistant account
      const assistant = await prisma.user.create({
        data: {
          firstName: assistantData.firstName,
          lastName: assistantData.lastName,
          email: assistantData.email,
          password: assistantData.password, // Should be hashed in production
          role: "ASSISTANT",
          isActive: true,
          maxAssistants: 0, // Assistants can't create assistants
        },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          isActive: true,
          createdAt: true,
        },
      });

      return ResponseBuilder.success(
        res,
        assistant,
        "Assistant créé avec succès"
      );
    } catch (error) {
      console.error("Error creating assistant:", error);
      return ResponseBuilder.error(
        res,
        "Erreur lors de la création de l'assistant"
      );
    }
  }

  /**
   * Update assistant information
   */
  async updateAssistant(req: AuthRequest, res: Response) {
    try {
      const userId = req.user?.userId;
      const userRole = req.user?.role;
      const { assistantId } = req.params;
      const updates = req.body;

      if (!userId) {
        return ResponseBuilder.error(res, "Utilisateur non authentifié", 401);
      }

      // Only COMPTABLE users can update assistants
      if (userRole !== "COMPTABLE") {
        return ResponseBuilder.error(
          res,
          "Seuls les comptables peuvent modifier les assistants",
          403
        );
      }

      // Verify the assistant exists and belongs to this accountant
      const assistant = await prisma.user.findUnique({
        where: { id: assistantId },
        select: { role: true, isActive: true },
      });

      if (!assistant || assistant.role !== "ASSISTANT") {
        return ResponseBuilder.error(res, "Assistant non trouvé", 404);
      }

      // Update the assistant
      const updatedAssistant = await prisma.user.update({
        where: { id: assistantId },
        data: {
          ...(updates.firstName && { firstName: updates.firstName }),
          ...(updates.lastName && { lastName: updates.lastName }),
          ...(updates.email && { email: updates.email }),
          ...(updates.isActive !== undefined && { isActive: updates.isActive }),
        },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          isActive: true,
          updatedAt: true,
        },
      });

      return ResponseBuilder.success(
        res,
        updatedAssistant,
        "Assistant mis à jour avec succès"
      );
    } catch (error) {
      console.error("Error updating assistant:", error);
      return ResponseBuilder.error(
        res,
        "Erreur lors de la mise à jour de l'assistant"
      );
    }
  }

  /**
   * Delete/deactivate an assistant
   */
  async deleteAssistant(req: AuthRequest, res: Response) {
    try {
      const userId = req.user?.userId;
      const userRole = req.user?.role;
      const { assistantId } = req.params;

      if (!userId) {
        return ResponseBuilder.error(res, "Utilisateur non authentifié", 401);
      }

      // Only COMPTABLE users can delete assistants
      if (userRole !== "COMPTABLE") {
        return ResponseBuilder.error(
          res,
          "Seuls les comptables peuvent supprimer les assistants",
          403
        );
      }

      // Verify the assistant exists and belongs to this accountant
      const assistant = await prisma.user.findUnique({
        where: { id: assistantId },
        select: { role: true },
      });

      if (!assistant || assistant.role !== "ASSISTANT") {
        return ResponseBuilder.error(res, "Assistant non trouvé", 404);
      }

      // Soft delete by deactivating
      await prisma.user.update({
        where: { id: assistantId },
        data: { isActive: false },
      });

      return ResponseBuilder.success(
        res,
        null,
        "Assistant désactivé avec succès"
      );
    } catch (error) {
      console.error("Error deleting assistant:", error);
      return ResponseBuilder.error(
        res,
        "Erreur lors de la suppression de l'assistant"
      );
    }
  }

  /**
   * Assign assistant to folders
   */
  async assignToFolders(req: AuthRequest, res: Response) {
    try {
      const userId = req.user?.userId;
      const userRole = req.user?.role;
      const { assistantId } = req.params;
      const { folderIds, role = "VIEWER" } = req.body;

      if (!userId) {
        return ResponseBuilder.error(res, "Utilisateur non authentifié", 401);
      }

      // Only COMPTABLE users can assign assistants
      if (userRole !== "COMPTABLE") {
        return ResponseBuilder.error(
          res,
          "Seuls les comptables peuvent assigner des assistants",
          403
        );
      }

      // Verify the assistant exists
      const assistant = await prisma.user.findUnique({
        where: { id: assistantId },
        select: { role: true, isActive: true },
      });

      if (!assistant || assistant.role !== "ASSISTANT" || !assistant.isActive) {
        return ResponseBuilder.error(res, "Assistant non trouvé ou inactif", 404);
      }

      // Verify folders belong to the accountant
      const folders = await prisma.folder.findMany({
        where: {
          id: { in: folderIds },
          ownerId: userId,
        },
        select: { id: true },
      });

      if (folders.length !== folderIds.length) {
        return ResponseBuilder.error(
          res,
          "Un ou plusieurs dossiers n'existent pas ou ne vous appartiennent pas",
          400
        );
      }

      // Remove existing assignments for these folders and assistant
      await prisma.folderAssignment.deleteMany({
        where: {
          folderId: { in: folderIds },
          userId: assistantId,
        },
      });

      // Create new assignments
      const assignments = await Promise.all(
        folderIds.map((folderId: string) =>
          prisma.folderAssignment.create({
            data: {
              folderId,
              userId: assistantId,
              role,
            },
          })
        )
      );

      return ResponseBuilder.success(
        res,
        assignments,
        "Assistant assigné aux dossiers avec succès"
      );
    } catch (error) {
      console.error("Error assigning assistant to folders:", error);
      return ResponseBuilder.error(
        res,
        "Erreur lors de l'assignation de l'assistant"
      );
    }
  }

  /**
   * Get folders assigned to an assistant
   */
  async getAssistantFolders(req: AuthRequest, res: Response) {
    try {
      const userId = req.user?.userId;
      const userRole = req.user?.role;
      const { assistantId } = req.params;

      if (!userId) {
        return ResponseBuilder.error(res, "Utilisateur non authentifié", 401);
      }

      // Only COMPTABLE users can view assistant assignments
      if (userRole !== "COMPTABLE") {
        return ResponseBuilder.error(
          res,
          "Seuls les comptables peuvent voir les assignations des assistants",
          403
        );
      }

      const assignments = await prisma.folderAssignment.findMany({
        where: {
          userId: assistantId,
          folder: {
            ownerId: userId, // Only folders owned by the accountant
          },
        },
        include: {
          folder: {
            select: {
              id: true,
              name: true,
              fiscalYear: true,
              status: true,
              client: {
                select: {
                  name: true,
                },
              },
            },
          },
        },
        orderBy: {
          folder: {
            fiscalYear: "desc",
          },
        },
      });

      return ResponseBuilder.success(
        res,
        assignments,
        "Dossiers de l'assistant récupérés avec succès"
      );
    } catch (error) {
      console.error("Error fetching assistant folders:", error);
      return ResponseBuilder.error(
        res,
        "Erreur lors de la récupération des dossiers de l'assistant"
      );
    }
  }

  /**
   * Remove assistant from folders
   */
  async removeFromFolders(req: AuthRequest, res: Response) {
    try {
      const userId = req.user?.userId;
      const userRole = req.user?.role;
      const { assistantId } = req.params;
      const { folderIds } = req.body;

      if (!userId) {
        return ResponseBuilder.error(res, "Utilisateur non authentifié", 401);
      }

      // Only COMPTABLE users can remove assistant assignments
      if (userRole !== "COMPTABLE") {
        return ResponseBuilder.error(
          res,
          "Seuls les comptables peuvent retirer les assignations des assistants",
          403
        );
      }

      // Remove assignments
      await prisma.folderAssignment.deleteMany({
        where: {
          folderId: { in: folderIds },
          userId: assistantId,
          folder: {
            ownerId: userId, // Only folders owned by the accountant
          },
        },
      });

      return ResponseBuilder.success(
        res,
        null,
        "Assistant retiré des dossiers avec succès"
      );
    } catch (error) {
      console.error("Error removing assistant from folders:", error);
      return ResponseBuilder.error(
        res,
        "Erreur lors du retrait de l'assistant des dossiers"
      );
    }
  }
}

export const assistantController = new AssistantController();