// src/controllers/client.controller.ts
import { Response, NextFunction } from "express";
import { AuthRequest } from "../middleware/auth.middleware";
import { prisma } from "../lib/prisma";
import { BadRequestError, NotFoundError, ForbiddenError } from "../lib/errors";
import { CountrySelection, FolderStatus, ClientType } from "@prisma/client";
import { auditService } from "../services/audit.service";

class ClientController {
  async getClients(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.user!.userId;
      const userRole = req.user!.role;
      const { country, page = "1", limit = "50" } = req.query;

      const skip = (Number(page) - 1) * Number(limit);
      const take = Number(limit);

      // Validate country if provided
      if (
        country &&
        !Object.values(CountrySelection).includes(country as CountrySelection)
      ) {
        throw new BadRequestError("Invalid country");
      }

      // ADMIN can see all clients with country filter
      if (userRole === "ADMIN") {
        const [clients, totalCount] = await Promise.all([
          prisma.client.findMany({
            where: country ? { country: country as CountrySelection } : {},
            orderBy: { createdAt: "desc" },
            skip,
            take,
          }),
          prisma.client.count({
            where: country ? { country: country as CountrySelection } : {},
          }),
        ]);

        return res.json({
          clients,
          pagination: {
            page: Number(page),
            limit: Number(limit),
            totalCount,
            totalPages: Math.ceil(totalCount / Number(limit)),
          },
        });
      }

      // COMPTABLE can see clients they created (createdBy) with country filter
      if (userRole === "COMPTABLE") {
        const [clients, totalCount] = await Promise.all([
          prisma.client.findMany({
            where: {
              createdBy: userId,
              ...(country && { country: country as CountrySelection }),
            },
            orderBy: { createdAt: "desc" },
            skip,
            take,
          }),
          prisma.client.count({
            where: {
              createdBy: userId,
              ...(country && { country: country as CountrySelection }),
            },
          }),
        ]);

        return res.json({
          clients,
          pagination: {
            page: Number(page),
            limit: Number(limit),
            totalCount,
            totalPages: Math.ceil(totalCount / Number(limit)),
          },
        });
      }

      // ASSISTANT can only see clients they're assigned to with country filter
      if (userRole === "ASSISTANT") {
        const assignedFolders = await prisma.folderAssignment.findMany({
          where: {
            userId,
            ...(country && {
              folder: { client: { country: country as CountrySelection } },
            }),
          },
          include: {
            folder: {
              include: {
                client: true,
              },
            },
          },
          skip,
          take,
        });

        const uniqueClients = Array.from(
          new Map(
            assignedFolders
              .map((a) => a.folder.client)
              .map((client) => [client.id, client])
          ).values()
        );

        return res.json({
          clients: uniqueClients,
          pagination: {
            page: Number(page),
            limit: Number(limit),
            totalCount: uniqueClients.length,
            totalPages: Math.ceil(uniqueClients.length / Number(limit)),
          },
        });
      }

      throw new ForbiddenError("Invalid user role");
    } catch (error) {
      next(error);
    }
  }

  async getClientById(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const userId = req.user!.userId;
      const userRole = req.user!.role;

      const client = await prisma.client.findUnique({
        where: { id },
        include: {
          folders: {
            orderBy: { createdAt: "desc" },
            select: {
              id: true,
              name: true,
              fiscalYear: true,
              status: true,
              startDate: true,
              endDate: true,
              owner: {
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

      if (!client) {
        throw new NotFoundError("Client not found");
      }

      // Check access based on role
      await this.checkClientAccess(id, userId, userRole);

      res.json({ client });
    } catch (error) {
      next(error);
    }
  }

  async createClient(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.user!.userId;
      const userRole = req.user!.role;

      // Only ADMIN and COMPTABLE can create clients
      if (userRole !== "ADMIN" && userRole !== "COMPTABLE") {
        throw new ForbiddenError(
          "Only admins and comptables can create clients"
        );
      }

      // COMPTABLE users can create unlimited clients (no limit)

      const {
        name,
        legalForm,
        clientType,
        taxNumber,
        address,
        city,
        phone,
        country,
      } = req.body;

      // Validate required fields
      if (!name || !legalForm || !country) {
        throw new BadRequestError("Name, legal form, and country are required");
      }

      // Validate legal form
      if (!["SARL", "SA", "SUARL", "INDIVIDUAL", "OTHER"].includes(legalForm)) {
        throw new BadRequestError("Invalid legal form");
      }

      // Validate country
      if (
        !Object.values(CountrySelection).includes(country as CountrySelection)
      ) {
        throw new BadRequestError("Invalid country");
      }

      // Set currency based on country
      const currency = country === "CM" ? "XAF" : "XOF";

      // Create client and auto-create a folder for the creator
      // const [client] = await prisma.$transaction([
      //   prisma.client.create({
      //     data: {
      //       name,
      //       legalForm,
      //       taxNumber,
      //       address,
      //       city,
      //       phone,
      //       country: country as CountrySelection,
      //       currency,
      //       createdBy: userId,
      //     },
      //   }),
      //   // Auto-create main folder for the creator
      //   prisma.folder.create({
      //     data: {
      //       name: `${name} - Principal`,
      //       client: {
      //         connect: {
      //           // We'll get the client ID from the transaction
      //           name: name, // This needs to be adjusted - better to create client first then folder
      //         },
      //       },
      //       ownerId: userId,
      //       fiscalYear: new Date().getFullYear(),
      //       startDate: new Date(new Date().getFullYear(), 0, 1), // Jan 1
      //       endDate: new Date(new Date().getFullYear(), 11, 31), // Dec 31
      //       status: FolderStatus.DRAFT,
      //     },
      //   }),
      // ]);

      // Alternative approach without transaction for simplicity:
      const client = await prisma.client.create({
        data: {
          name,
          legalForm,
          clientType: clientType || "NORMAL",
          taxNumber,
          address,
          city,
          phone,
          country: country as CountrySelection,
          currency,
          createdBy: userId,
        },
      });

      // Auto-create main folder for the creator
      await prisma.folder.create({
        data: {
          name: `${name} - Principal`,
          clientId: client.id,
          ownerId: userId,
          fiscalYear: new Date().getFullYear(),
          startDate: new Date(new Date().getFullYear(), 0, 1),
          endDate: new Date(new Date().getFullYear(), 11, 31),
          status: FolderStatus.DRAFT,
        },
      });

      // Log audit event
      await auditService.logClientCreated(
        userId,
        {
          name,
          legalForm,
          taxNumber,
          address,
          city,
          phone,
          country,
          currency,
        },
        client.id
      );

      res.status(201).json({
        message: "Client created successfully",
        client,
      });
    } catch (error) {
      next(error);
    }
  }

  async updateClient(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const userId = req.user!.userId;
      const userRole = req.user!.role;

      // Check if client exists and get old data for audit
      const oldClient = await prisma.client.findUnique({
        where: { id },
      });

      if (!oldClient) {
        throw new NotFoundError("Client not found");
      }

      // Check permissions
      if (userRole === "ADMIN") {
        // ADMIN can update any client
      } else if (userRole === "COMPTABLE") {
        // COMPTABLE can only update clients they created
        if (oldClient.createdBy !== userId) {
          throw new ForbiddenError("Access denied to update this client");
        }
      } else {
        throw new ForbiddenError(
          "Only admins and comptables can update clients"
        );
      }

      const {
        name,
        legalForm,
        clientType,
        taxNumber,
        address,
        city,
        phone,
        country,
      } = req.body;

      // Validate legal form if provided
      if (
        legalForm &&
        !["SARL", "SA", "SUARL", "INDIVIDUAL", "OTHER"].includes(legalForm)
      ) {
        throw new BadRequestError("Invalid legal form");
      }

      // Validate country if provided
      if (
        country &&
        !Object.values(CountrySelection).includes(country as CountrySelection)
      ) {
        throw new BadRequestError("Invalid country");
      }

      const updatedClient = await prisma.client.update({
        where: { id },
        data: {
          ...(name && { name }),
          ...(legalForm && { legalForm }),
          ...(taxNumber && { taxNumber }),
          ...(address && { address }),
          ...(city && { city }),
          ...(phone && { phone }),
          ...(country && { country: country as CountrySelection }),
        },
      });

      // Log audit event
      await auditService.logClientUpdated(userId, id, oldClient, updatedClient);

      res.json({
        message: "Client updated successfully",
        client: updatedClient,
      });
    } catch (error) {
      next(error);
    }
  }

  async deleteClient(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const userId = req.user!.userId;
      const userRole = req.user!.role;

      // Only ADMIN can delete clients
      if (userRole !== "ADMIN") {
        throw new ForbiddenError("Only admins can delete clients");
      }

      // Check if client exists
      const client = await prisma.client.findUnique({
        where: { id },
        include: {
          folders: {
            select: { id: true },
          },
        },
      });

      if (!client) {
        throw new NotFoundError("Client not found");
      }

      // Check if client has folders
      if (client.folders.length > 0) {
        throw new BadRequestError("Cannot delete client with existing folders");
      }

      await prisma.client.delete({
        where: { id },
      });

      // Log audit event
      await auditService.logClientDeleted(userId, id, client);

      res.json({
        message: "Client deleted successfully",
      });
    } catch (error) {
      next(error);
    }
  }

  async getClientUsers(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { id: clientId } = req.params;
      const userId = req.user!.userId;
      const userRole = req.user!.role;

      // Check client access
      await this.checkClientAccess(clientId, userId, userRole);

      // Get users who have access to this client through folders
      const folderAssignments = await prisma.folderAssignment.findMany({
        where: {
          folder: {
            clientId,
          },
        },
        include: {
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
              role: true,
            },
          },
          folder: {
            select: {
              id: true,
              name: true,
              fiscalYear: true,
            },
          },
        },
        orderBy: { assignedAt: "desc" },
      });

      // Get folder owners for this client
      const folderOwners = await prisma.folder.findMany({
        where: { clientId },
        include: {
          owner: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
              role: true,
            },
          },
        },
      });

      // Combine and deduplicate users
      const allUsers = [
        ...folderAssignments.map((a) => ({
          ...a.user,
          assignment: {
            role: a.role,
            folder: a.folder,
            assignedAt: a.assignedAt,
          },
        })),
        ...folderOwners.map((f) => ({
          ...f.owner,
          assignment: {
            role: "OWNER" as const,
            folder: { id: f.id, name: f.name, fiscalYear: f.fiscalYear },
          },
        })),
      ];

      const uniqueUsers = Array.from(
        new Map(allUsers.map((user) => [user.id, user])).values()
      );

      res.json({ users: uniqueUsers });
    } catch (error) {
      next(error);
    }
  }

  async getCountries(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.user!.userId;
      const userRole = req.user!.role;

      // Get available countries based on user role and access
      let availableCountries: CountrySelection[] = [];

      if (userRole === "ADMIN") {
        // ADMIN can see all countries
        availableCountries = Object.values(CountrySelection);
      } else if (userRole === "COMPTABLE") {
        // COMPTABLE can create clients in any country, so show all countries
        availableCountries = Object.values(CountrySelection);
      } else if (userRole === "ASSISTANT") {
        // ASSISTANT can only see countries from clients they have access to
        const accessibleClients = await prisma.client.findMany({
          where: {
            folders: { some: { assignments: { some: { userId } } } },
          },
          select: { country: true },
          distinct: ["country"],
        });
        availableCountries = accessibleClients.map((c) => c.country);
      }

      // Get country details with additional information
      const countryDetails = availableCountries.map((country) => ({
        code: country,
        name: ClientController.getCountryName(country),
        currency: country === "CM" ? "XAF" : "XOF",
        timezone: "Africa/Douala", // All countries use the same timezone for now
        flag: ClientController.getCountryFlag(country),
      }));

      res.json({ countries: countryDetails });
    } catch (error) {
      next(error);
    }
  }

  // Helper method to check client access
  private async checkClientAccess(
    clientId: string,
    userId: string,
    userRole: string
  ) {
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
  }

  // Helper methods for country information
  private static getCountryName(countryCode: CountrySelection): string {
    const countryNames: Record<CountrySelection, string> = {
      BJ: "Bénin",
      BF: "Burkina Faso",
      CI: "Côte d'Ivoire",
      SN: "Sénégal",
      CM: "Cameroun",
      TG: "Togo",
    };
    return countryNames[countryCode] || countryCode;
  }

  private static getCountryFlag(countryCode: CountrySelection): string {
    const flagEmojis: Record<CountrySelection, string> = {
      BJ: "🇧🇯",
      BF: "🇧🇫",
      CI: "🇨🇮",
      SN: "🇸🇳",
      CM: "🇨🇲",
      TG: "🇹🇬",
    };
    return flagEmojis[countryCode] || "🏳️";
  }
}

export const clientController = new ClientController();
