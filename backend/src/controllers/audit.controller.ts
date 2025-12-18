import { Response } from "express";
import { AuthRequest } from "../middleware/auth.middleware";
import { prisma } from "../lib/prisma";
import { ResponseBuilder } from "../utils/response-builder";

export class AuditController {
  /**
   * Get audit logs with filtering and pagination
   */
  async getAuditLogs(req: AuthRequest, res: Response) {
    try {
      const {
        page = "1",
        limit = "50",
        userId,
        action,
        entityType,
        entityId,
        folderId,
        startDate,
        endDate,
      } = req.query;

      const userRole = req.user?.role;
      const currentUserId = req.user?.userId;

      // Build where clause
      const where: any = {};

      // Non-admin users can only see their own logs
      if (userRole !== "ADMIN") {
        where.userId = currentUserId;
      } else if (userId) {
        // Admins can filter by specific user
        where.userId = userId;
      }

      // Apply filters
      if (action) where.action = action;
      if (entityType) where.entityType = entityType;
      if (entityId) where.entityId = entityId;
      if (folderId) where.folderId = folderId;

      // Date range filter
      if (startDate || endDate) {
        where.createdAt = {};
        if (startDate) where.createdAt.gte = new Date(startDate as string);
        if (endDate) where.createdAt.lte = new Date(endDate as string);
      }

      const skip = (Number(page) - 1) * Number(limit);
      const take = Number(limit);

      const [logs, total] = await Promise.all([
        prisma.auditLog.findMany({
          where,
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
                client: {
                  select: {
                    id: true,
                    name: true,
                  },
                },
              },
            },
            client: {
              select: {
                id: true,
                name: true,
              },
            },
          },
          orderBy: { createdAt: "desc" },
          skip,
          take,
        }),
        prisma.auditLog.count({ where }),
      ]);

      // Transform logs to match frontend interface
      const transformedLogs = logs.map((log) => ({
        id: log.id,
        timestamp: log.createdAt.toISOString(),
        userId: log.userId,
        user: log.user,
        action: log.action,
        entityType: log.entityType,
        entityId: log.entityId,
        folderId: log.folderId,
        clientId: log.clientId,
        description: log.description,
        oldValue: log.oldValue,
        newValue: log.newValue,
        metadata: log.metadata,
        cellAddress: log.cellAddress,
        worksheet: log.worksheet,
        fieldName: log.fieldName,
        changeType: log.changeType,
        folder: log.folder,
        client: log.client,
      }));

      const totalPages = Math.ceil(total / Number(limit));

      return ResponseBuilder.success(res, {
        logs: transformedLogs,
        pagination: {
          page: Number(page),
          limit: Number(limit),
          total,
          pages: totalPages,
        },
      });
    } catch (error) {
      console.error("Error fetching audit logs:", error);
      return ResponseBuilder.error(
        res,
        "Erreur lors de la récupération des logs d'audit"
      );
    }
  }

  /**
   * Get audit statistics
   */
  async getAuditStats(req: AuthRequest, res: Response) {
    try {
      const { period = "30d" } = req.query;
      const userRole = req.user?.role;
      const currentUserId = req.user?.userId;

      // Calculate date range
      const endDate = new Date();
      const startDate = new Date();

      switch (period) {
        case "7d":
          startDate.setDate(endDate.getDate() - 7);
          break;
        case "30d":
          startDate.setDate(endDate.getDate() - 30);
          break;
        case "90d":
          startDate.setDate(endDate.getDate() - 90);
          break;
        default:
          startDate.setDate(endDate.getDate() - 30);
      }

      const where: any = {
        createdAt: {
          gte: startDate,
          lte: endDate,
        },
      };

      // Non-admin users can only see their own stats
      if (userRole !== "ADMIN") {
        where.userId = currentUserId;
      }

      const [totalLogs, actionStats, userStats, entityStats, recentLogs] =
        await Promise.all([
          prisma.auditLog.count({ where }),

          prisma.auditLog.groupBy({
            by: ["action"],
            where,
            _count: { id: true },
            orderBy: { _count: { id: "desc" } },
          }),

          prisma.auditLog.groupBy({
            by: ["userId"],
            where,
            _count: { id: true },
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
            orderBy: { _count: { id: "desc" } },
          }),

          prisma.auditLog.groupBy({
            by: ["entityType"],
            where,
            _count: { id: true },
            orderBy: { _count: { id: "desc" } },
          }),

          prisma.auditLog.findMany({
            where,
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
            },
            orderBy: { createdAt: "desc" },
            take: 10,
          }),
        ]);

      // Transform recent logs
      const transformedRecentLogs = recentLogs.map((log) => ({
        id: log.id,
        timestamp: log.createdAt.toISOString(),
        userId: log.userId,
        user: log.user,
        action: log.action,
        entityType: log.entityType,
        entityId: log.entityId,
        folderId: log.folderId,
        clientId: log.clientId,
        description: log.description,
        oldValue: log.oldValue,
        newValue: log.newValue,
        metadata: log.metadata,
        cellAddress: log.cellAddress,
        worksheet: log.worksheet,
        fieldName: log.fieldName,
        changeType: log.changeType,
      }));

      return ResponseBuilder.success(res, {
        period,
        totalLogs,
        actionStats,
        userStats,
        entityStats,
        recentLogs: transformedRecentLogs,
      });
    } catch (error) {
      console.error("Error fetching audit stats:", error);
      return ResponseBuilder.error(
        res,
        "Erreur lors de la récupération des statistiques d'audit"
      );
    }
  }

  /**
   * Get a specific audit log by ID
   */
  async getAuditLogById(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;
      const userRole = req.user?.role;
      const currentUserId = req.user?.userId;

      const log = await prisma.auditLog.findUnique({
        where: { id },
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
              client: {
                select: {
                  id: true,
                  name: true,
                },
              },
            },
          },
          client: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      });

      if (!log) {
        return ResponseBuilder.error(res, "Log d'audit non trouvé", 404);
      }

      // Check permissions
      if (userRole !== "ADMIN" && log.userId !== currentUserId) {
        return ResponseBuilder.error(res, "Accès non autorisé", 403);
      }

      // Transform log
      const transformedLog = {
        id: log.id,
        timestamp: log.createdAt.toISOString(),
        userId: log.userId,
        user: log.user,
        action: log.action,
        entityType: log.entityType,
        entityId: log.entityId,
        folderId: log.folderId,
        clientId: log.clientId,
        description: log.description,
        oldValue: log.oldValue,
        newValue: log.newValue,
        metadata: log.metadata,
        cellAddress: log.cellAddress,
        worksheet: log.worksheet,
        fieldName: log.fieldName,
        changeType: log.changeType,
        folder: log.folder,
        client: log.client,
      };

      return ResponseBuilder.success(res, transformedLog);
    } catch (error) {
      console.error("Error fetching audit log:", error);
      return ResponseBuilder.error(
        res,
        "Erreur lors de la récupération du log d'audit"
      );
    }
  }
}

export const auditController = new AuditController();
