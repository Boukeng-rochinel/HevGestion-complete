// services/dsf-mapping.service.ts
import { PrismaClient } from "@prisma/client";
import * as XLSX from "xlsx";

const prisma = new PrismaClient();

export interface MappingResult {
  sheetType: string;
  data: any;
  confidence: number;
  errors: string[];
}

export interface CellMapping {
  headerName: string;
  cellReference: string;
  dataType?: string;
}

export class DSFMappingService {
  /**
   * Extract data from Excel using mapping configurations
   */
  async extractDataWithMapping(
    workbook: XLSX.WorkBook,
    sheetType: string,
    userId?: string
  ): Promise<MappingResult> {
    const result: MappingResult = {
      sheetType,
      data: {},
      confidence: 0,
      errors: [],
    };

    try {
      // Find mapping configuration
      const config = await this.findMappingConfig(sheetType, userId);
      if (!config) {
        result.errors.push(
          `No mapping configuration found for sheet type: ${sheetType}`
        );
        return result;
      }

      // Find matching sheet
      const sheetName = this.findMatchingSheet(
        workbook,
        config.sheetNamePatterns
      );
      if (!sheetName) {
        result.errors.push(
          `No matching sheet found for patterns: ${config.sheetNamePatterns.join(", ")}`
        );
        return result;
      }

      const worksheet = workbook.Sheets[sheetName];
      if (!worksheet) {
        result.errors.push(`Sheet '${sheetName}' not found in workbook`);
        return result;
      }

      // Extract data using field mappings
      const extractedData = await this.extractFieldsFromSheet(
        worksheet,
        config.fields
      );
      result.data = extractedData;

      // Calculate confidence based on successful extractions
      const totalFields = config.fields.length;
      const successfulFields = Object.keys(extractedData).length;
      result.confidence =
        totalFields > 0 ? (successfulFields / totalFields) * 100 : 0;
    } catch (error) {
      result.errors.push(
        `Error extracting data: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    }

    return result;
  }

  /**
   * Find mapping configuration for a sheet type
   */
  private async findMappingConfig(sheetType: string, userId?: string) {
    // Try user-specific config first, then system config
    let config = await prisma.dSFMappingConfig.findFirst({
      where: {
        noteType: sheetType,
        isActive: true,
      },
      include: {
        fields: true,
      },
    });

    return config;
  }

  /**
   * Find sheet name that matches patterns
   */
  private findMatchingSheet(
    workbook: XLSX.WorkBook,
    patterns: string[]
  ): string | null {
    const sheetNames = workbook.SheetNames;

    for (const pattern of patterns) {
      const regex = new RegExp(pattern, "i"); // Case insensitive
      const match = sheetNames.find((name) => regex.test(name));
      if (match) return match;
    }

    return null;
  }

  /**
   * Extract fields from worksheet using mappings
   */
  private async extractFieldsFromSheet(
    worksheet: XLSX.WorkSheet,
    fieldMappings: any[]
  ): Promise<any> {
    const result: any = {};

    for (const mapping of fieldMappings) {
      try {
        let value: any = null;

        if (mapping.cellReference) {
          // Direct cell reference
          value = this.getCellValue(worksheet, mapping.cellReference);
        } else if (mapping.headerPattern) {
          // Find column by header pattern
          const columnLetter = this.findColumnByHeader(
            worksheet,
            mapping.headerPattern
          );
          if (columnLetter) {
            // For now, assume we want the first data row after headers
            // This could be made configurable
            const cellRef = `${columnLetter}2`; // Assuming headers in row 1
            value = this.getCellValue(worksheet, cellRef);
          }
        }

        if (value !== null && value !== undefined) {
          // Apply data type conversion
          value = this.convertDataType(value, mapping.dataType);

          // Apply validation if specified
          if (this.validateValue(value, mapping)) {
            result[mapping.fieldId] = value;
          }
        }
      } catch (error) {
        console.warn(`Error extracting field ${mapping.fieldId}:`, error);
      }
    }

    return result;
  }

  /**
   * Get value from Excel cell
   */
  private getCellValue(worksheet: XLSX.WorkSheet, cellRef: string): any {
    const cell = worksheet[cellRef];
    if (!cell) return null;

    // Handle different cell types
    switch (cell.t) {
      case "n": // number
        return cell.v;
      case "s": // string
        return cell.v;
      case "b": // boolean
        return cell.v;
      case "d": // date
        return cell.v;
      default:
        return cell.v || cell.w; // raw value or formatted text
    }
  }

  /**
   * Find column letter by header pattern
   */
  private findColumnByHeader(
    worksheet: XLSX.WorkSheet,
    headerPattern: string
  ): string | null {
    // Assume headers are in row 1
    const headerRow = 1;
    const regex = new RegExp(headerPattern, "i");

    // Check columns A to Z (can be extended)
    for (let col = 0; col < 26; col++) {
      const colLetter = String.fromCharCode(65 + col); // A, B, C, ...
      const cellRef = `${colLetter}${headerRow}`;
      const cellValue = this.getCellValue(worksheet, cellRef);

      if (cellValue && regex.test(cellValue.toString())) {
        return colLetter;
      }
    }

    return null;
  }

  /**
   * Convert value to specified data type
   */
  private convertDataType(value: any, dataType: string): any {
    if (!dataType || dataType === "string") {
      return value?.toString() || "";
    }

    if (dataType === "number") {
      const num = parseFloat(value);
      return isNaN(num) ? 0 : num;
    }

    if (dataType === "date") {
      // Handle Excel date serial numbers
      if (typeof value === "number") {
        // Excel dates are days since 1900-01-01
        const excelEpoch = new Date(1900, 0, 1);
        return new Date(
          excelEpoch.getTime() + (value - 1) * 24 * 60 * 60 * 1000
        );
      }
      return new Date(value);
    }

    return value;
  }

  /**
   * Validate extracted value
   */
  private validateValue(value: any, mapping: any): boolean {
    // Required check
    if (
      mapping.isRequired &&
      (value === null || value === undefined || value === "")
    ) {
      return false;
    }

    // Regex validation
    if (mapping.validationRegex && typeof value === "string") {
      const regex = new RegExp(mapping.validationRegex);
      if (!regex.test(value)) {
        return false;
      }
    }

    // Numeric range validation
    if (typeof value === "number") {
      if (mapping.minValue !== undefined && value < mapping.minValue) {
        return false;
      }
      if (mapping.maxValue !== undefined && value > mapping.maxValue) {
        return false;
      }
    }

    return true;
  }

  /**
   * Create or update mapping configuration
   */
  async saveMappingConfig(
    sheetType: string,
    sheetNamePatterns: string[],
    fieldMappings: any[],
    userId?: string,
    isSystem: boolean = false
  ) {
    const config = await prisma.dSFMappingConfig.upsert({
      where: {
        noteType: sheetType,
        // Note: This might need adjustment based on unique constraints
      },
      update: {
        sheetNamePatterns,
        ownerId: userId,
        isSystem,
        fields: {
          deleteMany: {},
          create: fieldMappings,
        },
      },
      create: {
        noteType: sheetType,
        sheetNamePatterns,
        ownerId: userId,
        isSystem,
        fields: {
          create: fieldMappings,
        },
      },
    });

    return config;
  }

  /**
   * Get all mapping configurations for a user
   */
  async getMappingConfigs(userId?: string) {
    return await prisma.dSFMappingConfig.findMany({
      where: {
        OR: [{ ownerId: userId }, { isSystem: true }],
        isActive: true,
      },
      include: {
        fields: true,
        owner: {
          select: { id: true, firstName: true, lastName: true },
        },
      },
    });
  }
}

export const dsfMappingService = new DSFMappingService();
