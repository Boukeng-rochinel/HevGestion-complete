// controllers/dsf-mapping.controller.ts
import { Response, NextFunction } from "express";
import { AuthRequest } from "../middleware/auth.middleware";
import { prisma } from "../lib/prisma";
import { BadRequestError, NotFoundError } from "../lib/errors";
import { DSFMappingService } from "../services/dsf-mapping.service";

class DSFMappingController {
  private mappingService = new DSFMappingService();

  /**
   * Get all mapping configurations for the user
   */
  getMappingConfigs = async (
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const userId = req.user?.userId;
      const configs = await this.mappingService.getMappingConfigs(userId);

      res.json({ configs });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Get a specific mapping configuration
   */
  getMappingConfig = async (
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const { sheetType } = req.params;
      const userId = req.user?.userId;

      const config = await prisma.dSFMappingConfig.findFirst({
        where: {
          noteType: sheetType,
        },
        include: {
          fields: true,
          presets: true,
        },
      });

      if (!config) {
        throw new NotFoundError("Mapping configuration not found");
      }

      res.json({ config });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Create or update a mapping configuration
   */
  saveMappingConfig = async (
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const { sheetType, sheetNamePatterns, fieldMappings, isSystem } =
        req.body;
      const userId = req.user?.userId;

      if (!sheetType || !sheetNamePatterns || !Array.isArray(fieldMappings)) {
        throw new BadRequestError("Invalid request data");
      }

      const config = await this.mappingService.saveMappingConfig(
        sheetType,
        sheetNamePatterns,
        fieldMappings,
        userId,
        isSystem
      );

      res.json({
        message: "Mapping configuration saved successfully",
        config,
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Delete a mapping configuration
   */
  deleteMappingConfig = async (
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const { id } = req.params;
      const userId = req.user?.userId;

      const config = await prisma.dSFMappingConfig.findUnique({
        where: { id },
      });

      if (!config) {
        throw new NotFoundError("Mapping configuration not found");
      }

      // Check ownership
      if (config.ownerId !== userId && !config.isSystem) {
        throw new BadRequestError(
          "You don't have permission to delete this configuration"
        );
      }

      await prisma.dSFMappingConfig.delete({
        where: { id },
      });

      res.json({ message: "Mapping configuration deleted successfully" });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Test a mapping configuration against sample data
   */
  testMapping = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const { sheetType, sampleData } = req.body;
      const userId = req.user?.userId;

      // For now, return a mock result
      // In a real implementation, this would process the sample data
      const result = {
        sheetType,
        success: true,
        extractedFields: [],
        confidence: 85,
      };

      res.json({ result });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Get mapping presets
   */
  getMappingPresets = async (
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const presets = await prisma.dSFMappingPreset.findMany({
        where: {
          OR: [
            { isPublic: true },
            // Add user-specific logic if needed
          ],
        },
        include: {
          config: {
            include: {
              fields: true,
            },
          },
        },
      });

      res.json({ presets });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Create a mapping preset
   */
  createMappingPreset = async (
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const { name, description, configId, category, isPublic } = req.body;
      const userId = req.user?.userId;

      const preset = await prisma.dSFMappingPreset.create({
        data: {
          name,
          description,
          configId,
          category: category || "Custom",
          isPublic: isPublic || false,
        },
      });

      res.json({
        message: "Mapping preset created successfully",
        preset,
      });
    } catch (error) {
      next(error);
    }
  };
}

export const dsfMappingController = new DSFMappingController();
