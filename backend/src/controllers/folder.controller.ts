// src/controllers/folder.controller.ts
import { Response, NextFunction } from "express";
import { AuthRequest } from "../middleware/auth.middleware";
import { prisma } from "../lib/prisma";
import { BadRequestError, NotFoundError, ForbiddenError } from "../lib/errors";
import { FolderStatus } from "@prisma/client";

class FolderController {
  getFolders = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const userId = req.user!.userId;
      const { clientId } = req.query;

      if (!clientId) {
        throw new BadRequestError("client ID is required");
      }

      // Check access to client
      await this.checkClientAccess(userId, clientId as string, req.user!.role);

      const folders = await prisma.folder.findMany({
        where: { clientId: clientId as string },
        include: {
          client: true,
          owner: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
            },
          },
          balances: {
            select: {
              id: true,
              type: true,
              status: true,
            },
          },
        },
        orderBy: { fiscalYear: "desc" },
      });

      res.json({ folders });
    } catch (error) {
      next(error);
    }
  };

  getCurrentFolder = async (
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const userId = req.user!.userId;
      const { clientId } = req.query;

      if (!clientId) {
        throw new BadRequestError("client ID is required");
      }

      // Check access
      await this.checkClientAccess(userId, clientId as string, req.user!.role);

      // Get the most recent non-closed folder
      const currentFolder = await prisma.folder.findFirst({
        where: {
          clientId: clientId as string,
          status: {
            not: FolderStatus.COMPLETED,
          },
        },
        include: {
          client: true,
          balances: {
            orderBy: { importedAt: "desc" },
          },
          dsf: true,
        },
        orderBy: { fiscalYear: "desc" },
      });

      if (!currentFolder) {
        return res.json({
          message: "No active folder found",
          folder: null,
        });
      }

      res.json({ folder: currentFolder });
    } catch (error) {
      next(error);
    }
  };

  getFolderById = async (
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const { id } = req.params;
      const userId = req.user!.userId;

      const folder = await prisma.folder.findUnique({
        where: { id },
        include: {
          client: true,
          owner: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
            },
          },
          balances: {
            include: {
              equilibrium: true,
              accountIssues: {
                where: { isResolved: false },
              },
            },
          },
          dsf: true,
          taxDeclarations: true,
          assignments: {
            include: {
              user: {
                select: {
                  id: true,
                  firstName: true,
                  lastName: true,
                  email: true,
                },
              },
            },
          },
        },
      });

      if (!folder) {
        throw new NotFoundError("Folder not found");
      }

      // Check access
      await this.checkFolderAccess(userId, id, req.user!.role);

      res.json({ folder });
    } catch (error) {
      next(error);
    }
  };

  createFolder = async (
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const userId = req.user!.userId;
      const { name, description, clientId, fiscalYear, startDate, endDate } =
        req.body;

      // Check access to client
      await this.checkClientAccess(userId, clientId, req.user!.role);

      // Check if folder already exists for this year
      const existingFolder = await prisma.folder.findFirst({
        where: {
          clientId,
          fiscalYear,
        },
      });

      if (existingFolder) {
        throw new BadRequestError(
          `Folder for year ${fiscalYear} already exists`
        );
      }

      const folder = await prisma.folder.create({
        data: {
          name,
          description,
          clientId,
          ownerId: userId,
          fiscalYear,
          startDate: new Date(startDate),
          endDate: new Date(endDate),
          status: FolderStatus.DRAFT,
        },
        include: {
          client: true,
          owner: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
            },
          },
        },
      });

      res.status(201).json({
        message: "Folder created successfully",
        folder,
      });
    } catch (error) {
      next(error);
    }
  };
  duplicateFolder = async (
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const userId = req.user!.userId;
      const { clientId, fiscalYear, startDate, endDate } = req.body;

      // Check access to client
      await this.checkClientAccess(userId, clientId, req.user!.role);

      // Check if folder already exists for this year
      const existingFolder = await prisma.folder.findFirst({
        where: {
          clientId,
          fiscalYear,
        },
      });

      if (existingFolder) {
        throw new BadRequestError(
          `Folder for year ${fiscalYear} already exists`
        );
      }

      const folder = await prisma.folder.create({
        data: {
          clientId,
          ownerId: userId,
          fiscalYear,
          startDate: new Date(startDate),
          endDate: new Date(endDate),
          status: FolderStatus.DRAFT,
        },
        include: {
          client: true,
          owner: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
            },
          },
        },
      });

      res.status(201).json({
        message: "Folder created successfully",
        folder,
      });
    } catch (error) {
      next(error);
    }
  };

  closeFolder = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const userId = req.user!.userId;

      // Check access
      const folder = await prisma.folder.findUnique({
        where: { id },
        include: {
          balances: true,
          dsf: true,
        },
      });

      if (!folder) {
        throw new NotFoundError("Folder not found");
      }

      await this.checkFolderAccess(userId, id, req.user!.role);

      // Allow closing at any time - remove strict requirements
      // Users can close folders even if balances or DSF are not complete

      const updatedFolder = await prisma.folder.update({
        where: { id },
        data: {
          status: FolderStatus.COMPLETED,
        },
      });

      res.json({
        message: "Folder closed successfully",
        folder: updatedFolder,
      });
    } catch (error) {
      next(error);
    }
  };

  updateFolder = async (
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const { id } = req.params;
      const userId = req.user!.userId;
      const { name, description, status, isActive } = req.body;

      // Check access
      await this.checkFolderAccess(userId, id, req.user!.role);

      // If setting isActive to true, deactivate all other folders for this client
      if (isActive === true) {
        const folder = await prisma.folder.findUnique({
          where: { id },
        });

        if (folder) {
          await prisma.folder.updateMany({
            where: {
              clientId: folder.clientId,
              id: { not: id }, // Exclude current folder
            },
            data: {
              isActive: false,
            },
          });
        }
      }

      const updatedFolder = await prisma.folder.update({
        where: { id },
        data: {
          ...(name && { name }),
          ...(description && { description }),
          ...(status && { status }),
          ...(isActive !== undefined && { isActive }),
        },
        include: {
          client: true,
          owner: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
            },
          },
        },
      });

      res.json({
        message: "Folder updated successfully",
        folder: updatedFolder,
      });
    } catch (error) {
      next(error);
    }
  };

  deleteFolder = async (
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const { id } = req.params;
      const userId = req.user!.userId;

      // Check access - only owner or admin can delete
      const folder = await prisma.folder.findUnique({
        where: { id },
        include: {
          balances: true,
          dsf: true,
          taxDeclarations: true,
        },
      });

      if (!folder) {
        throw new NotFoundError("Folder not found");
      }

      if (req.user!.role !== "ADMIN" && folder.ownerId !== userId) {
        throw new ForbiddenError(
          "Only folder owner or admin can delete folders"
        );
      }

      // Check if folder has associated data
      if (
        folder.balances.length > 0 ||
        folder.dsf ||
        folder.taxDeclarations.length > 0
      ) {
        throw new BadRequestError("Cannot delete folder with associated data");
      }

      await prisma.folder.delete({
        where: { id },
      });

      res.json({
        message: "Folder deleted successfully",
      });
    } catch (error) {
      next(error);
    }
  };

  // Helper methods
  checkClientAccess = async (
    userId: string,
    clientId: string,
    userRole: string
  ): Promise<boolean> => {
    const client = await prisma.client.findUnique({
      where: { id: clientId },
    });

    if (!client) {
      throw new NotFoundError("Client not found");
    }

    if (userRole === "ADMIN") {
      return true;
    }

    if (userRole === "COMPTABLE") {
      // COMPTABLE can only access clients they created
      if (client.createdBy !== userId) {
        throw new ForbiddenError("Access denied to this client");
      }
      return true;
    }

    if (userRole === "ASSISTANT") {
      // ASSISTANT can access clients through folder assignments
      const hasAccess = await prisma.folderAssignment.findFirst({
        where: {
          userId,
          folder: {
            clientId,
          },
        },
      });

      if (!hasAccess) {
        throw new ForbiddenError("Access denied to this client");
      }
      return true;
    }

    throw new ForbiddenError("Invalid user role");
  };

  checkFolderAccess = async (
    userId: string,
    folderId: string,
    userRole: string
  ): Promise<boolean> => {
    const folder = await prisma.folder.findUnique({
      where: { id: folderId },
    });

    if (!folder) {
      throw new NotFoundError("Folder not found");
    }

    if (userRole === "ADMIN") {
      return true;
    }

    // Check if user is owner or has assignment
    const hasAccess = await prisma.folder.findFirst({
      where: {
        id: folderId,
        OR: [
          { ownerId: userId },
          {
            assignments: {
              some: { userId },
            },
          },
        ],
      },
    });

    if (!hasAccess) {
      throw new ForbiddenError("Access denied to this folder");
    }

    return true;
  };
}

export const folderController = new FolderController();
