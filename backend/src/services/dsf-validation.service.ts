// src/services/dsf-validation.service.ts
import * as XLSX from "xlsx";
import { BadRequestError } from "../lib/errors";

interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  sheetCount: number;
  sheetNames: string[];
}

interface DSFSheetConfig {
  name: string;
  required: boolean;
  aliases?: string[]; // Alternative names that are acceptable
  minRows?: number;
  description?: string;
}

export class DSFValidationService {
  // Expected DSF sheet configuration based on the template
  private readonly expectedSheets: DSFSheetConfig[] = [
    // Core financial statements
    {
      name: "BILAN PAYSAGE",
      required: true,
      aliases: ["Bilan", "BILAN"],
      minRows: 10,
      description: "Balance Sheet",
    },
    {
      name: "COMPTE DE RESULTAT",
      required: true,
      aliases: ["Compte de Résultat", "COMPTE DE RESULTAT"],
      minRows: 10,
      description: "Income Statement",
    },
    {
      name: "TABLEAU DES FLUX DE TRESORERIE",
      required: false,
      aliases: ["Tableaux Fiscaux"],
      minRows: 5,
      description: "Cash Flow Statement",
    },

    // Signaletics (required)
    {
      name: "Fiche R1",
      required: true,
      aliases: ["r1", "R1"],
      minRows: 5,
      description: "General Information",
    },
    {
      name: "Fiche R2",
      required: true,
      aliases: ["r2", "R2"],
      minRows: 5,
      description: "Shareholders/Associates",
    },
    {
      name: "Fiche R3",
      required: true,
      aliases: ["r3", "R3"],
      minRows: 5,
      description: "Directors Identity",
    },
    {
      name: "Fiche R4",
      required: false,
      aliases: ["r4", "R4"],
      minRows: 5,
      description: "Staff and Payroll",
    },
    {
      name: "STATISTIQUES ET SYNTHESES",
      required: false,
      aliases: ["r4Bis", "R4Bis"],
      minRows: 5,
      description: "Statistics and Synthesis",
    },

    // Key notes (some required)
    {
      name: "Note 1 ",
      required: false,
      aliases: ["NOTE 1", "Note1"],
      minRows: 5,
      description: "Guaranteed Debts",
    },
    {
      name: "NOTE 2",
      required: false,
      aliases: ["Note2"],
      minRows: 3,
      description: "Mandatory Information",
    },
    {
      name: "NOTE 3A",
      required: false,
      aliases: ["Note3A"],
      minRows: 5,
      description: "Gross Fixed Assets",
    },
    {
      name: "NOTE 4 ",
      required: false,
      aliases: ["Note4"],
      minRows: 5,
      description: "Financial Fixed Assets",
    },
    {
      name: "NOTE 7 ",
      required: false,
      aliases: ["Note7"],
      minRows: 5,
      description: "Customers",
    },
    {
      name: "NOTE 8 ",
      required: false,
      aliases: ["Note8"],
      minRows: 5,
      description: "Other Receivables",
    },
    {
      name: "NOTE 18",
      required: false,
      aliases: ["Note18"],
      minRows: 5,
      description: "Tax and Social Debts",
    },
    {
      name: "NOTE 21",
      required: false,
      aliases: ["Note21"],
      minRows: 5,
      description: "Turnover and Other Products",
    },
    {
      name: "NOTE 27A",
      required: false,
      aliases: ["Note27A"],
      minRows: 5,
      description: "Personnel Charges",
    },
    {
      name: "NOTE 34",
      required: false,
      aliases: ["Note34"],
      minRows: 5,
      description: "Financial Indicators",
    },

    // Tax tables (important)
    {
      name: "CF1",
      required: true,
      aliases: ["cf1"],
      minRows: 10,
      description: "Tax Result Determination",
    },
    {
      name: "CF1 BIS",
      required: false,
      aliases: ["cf1Bis"],
      minRows: 5,
      description: "Minimum Perception",
    },
    {
      name: "CF2",
      required: false,
      aliases: ["cf2"],
      minRows: 5,
      description: "Annual VAT Regularization",
    },

    // Other notes (optional but expected in complete DSF)
    { name: "NOTE 3B", required: false, minRows: 3 },
    { name: "NOTE  3C", required: false, minRows: 3 },
    { name: "CO1-NOTE 3C ", required: false, minRows: 3 },
    { name: "NOTE 3D ", required: false, minRows: 3 },
    { name: "NOTE 3E ", required: false, minRows: 3 },
    { name: "NOTE 3F ", required: false, minRows: 3 },
    { name: "NOTE 5 ", required: false, minRows: 3 },
    { name: "NOTE 6 ", required: false, minRows: 3 },
    { name: "NOTE 9 ", required: false, minRows: 3 },
    { name: "NOTE 10 ", required: false, minRows: 3 },
    { name: "NOTE 11 ", required: false, minRows: 3 },
    { name: "NOTE 12 ", required: false, minRows: 3 },
    { name: "NOTE 13 ", required: false, minRows: 3 },
    { name: "NOTE 14   ", required: false, minRows: 3 },
    { name: "NOTE 15A  ", required: false, minRows: 3 },
    { name: "NOTE 15B ", required: false, minRows: 3 },
    { name: "NOTE 16A ", required: false, minRows: 3 },
    { name: "NOTE 16B", required: false, minRows: 3 },
    { name: "NOTE 16B BIS", required: false, minRows: 3 },
    { name: "NOTE 16C", required: false, minRows: 3 },
    { name: "NOTE 17  ", required: false, minRows: 3 },
    { name: "C1-NOTE 17 ", required: false, minRows: 3 },
    { name: "NOTE 19 ", required: false, minRows: 3 },
    { name: "NOTE 20 ", required: false, minRows: 3 },
    { name: "NOTE 23", required: false, minRows: 3 },
    { name: "NOTE 24", required: false, minRows: 3 },
    { name: "NOTE 25", required: false, minRows: 3 },
    { name: "C1-NOTE 25", required: false, minRows: 3 },
    { name: "C2-NOTE 25", required: false, minRows: 3 },
    { name: "NOTE 26", required: false, minRows: 3 },
    { name: "NOTE 28", required: false, minRows: 3 },
    { name: "C1-NOTE 28", required: false, minRows: 3 },
    { name: "C2-NOTE 28", required: false, minRows: 3 },
    { name: "NOTE 29", required: false, minRows: 3 },
    { name: "NOTE 30", required: false, minRows: 3 },
    { name: "NOTE 31", required: false, minRows: 3 },
    { name: "NOTE 32", required: false, minRows: 3 },
    { name: "NOTE 33", required: false, minRows: 3 },
    { name: "NOTE 35", required: false, minRows: 3 },
    { name: "NOTES STAT SOCIALE ET ENVI", required: false, minRows: 3 },
    { name: "NOTES STAT A CARACTERE COMMERCI", required: false, minRows: 3 },
    { name: "NOTE 22", required: false, minRows: 3 },
    { name: "AUTRES ANNEXES FISCA", required: false, minRows: 3 },
    { name: "CF1 TER", required: false, minRows: 3 },
    { name: "CF1 QUATER", required: false, minRows: 3 },
    { name: "CF2 BIS", required: false, minRows: 3 },
    { name: "CF2  TER", required: false, minRows: 3 },

    // Administrative sheets (usually not required for data import)
    { name: "ENTETE", required: false, minRows: 1 },
    { name: "SOMMAIRE", required: false, minRows: 1 },
    { name: "PAGE DE GARDE", required: false, minRows: 1 },
    { name: "INFORMATIONS GENERALES", required: false, minRows: 1 },
    { name: "GRILLE D'ANALYSE DES NOTES", required: false, minRows: 1 },
  ];

  /**
   * Validate DSF Excel file structure
   */
  async validateDSFFile(filePath: string): Promise<ValidationResult> {
    try {
      const workbook = XLSX.readFile(filePath);
      const sheetNames = workbook.SheetNames;

      const result: ValidationResult = {
        isValid: true,
        errors: [],
        warnings: [],
        sheetCount: sheetNames.length,
        sheetNames: sheetNames,
      };

      // Check minimum sheet count
      if (sheetNames.length < 10) {
        result.errors.push(
          `DSF file must have at least 10 sheets. Found: ${sheetNames.length}`
        );
        result.isValid = false;
      }

      // Check for required sheets
      const missingRequiredSheets: string[] = [];
      const foundSheets = new Set(sheetNames.map((name) => name.trim()));

      for (const expectedSheet of this.expectedSheets) {
        if (expectedSheet.required) {
          const found = this.isSheetPresent(expectedSheet, foundSheets);
          if (!found) {
            missingRequiredSheets.push(expectedSheet.name);
          }
        }
      }

      if (missingRequiredSheets.length > 0) {
        result.errors.push(
          `Missing required sheets: ${missingRequiredSheets.join(", ")}`
        );
        result.isValid = false;
      }

      // Validate sheet content for found sheets
      for (const sheetName of sheetNames) {
        const sheet = workbook.Sheets[sheetName];
        if (!sheet) continue;

        const data = XLSX.utils.sheet_to_json(sheet, { header: 1 });
        const expectedSheet = this.findExpectedSheet(sheetName);

        if (
          expectedSheet &&
          expectedSheet.minRows &&
          data.length < expectedSheet.minRows
        ) {
          result.warnings.push(
            `Sheet "${sheetName}" has only ${data.length} rows, expected at least ${expectedSheet.minRows}`
          );
        }

        // Check for empty sheets
        if (data.length === 0) {
          result.warnings.push(`Sheet "${sheetName}" appears to be empty`);
        }
      }

      // Check for unexpected sheets (warning only)
      const expectedSheetNames = new Set(
        this.expectedSheets.flatMap((sheet) => [
          sheet.name,
          ...(sheet.aliases || []),
        ])
      );

      const unexpectedSheets = sheetNames.filter(
        (name) => !expectedSheetNames.has(name.trim())
      );

      if (unexpectedSheets.length > 0) {
        result.warnings.push(
          `Found unexpected sheets: ${unexpectedSheets.join(", ")}. This may indicate a non-standard DSF format.`
        );
      }

      // Validate core data sheets have meaningful content
      this.validateCoreSheets(workbook, result);

      return result;
    } catch (error: any) {
      throw new BadRequestError(
        `Failed to validate DSF file: ${error?.message || "Unknown error"}`
      );
    }
  }

  /**
   * Check if a sheet is present (considering aliases)
   */
  private isSheetPresent(
    expectedSheet: DSFSheetConfig,
    foundSheets: Set<string>
  ): boolean {
    // Check exact name
    if (foundSheets.has(expectedSheet.name)) {
      return true;
    }

    // Check aliases
    if (expectedSheet.aliases) {
      return expectedSheet.aliases.some((alias) => foundSheets.has(alias));
    }

    return false;
  }

  /**
   * Find expected sheet config by name
   */
  private findExpectedSheet(sheetName: string): DSFSheetConfig | undefined {
    const trimmedName = sheetName.trim();

    return this.expectedSheets.find(
      (sheet) =>
        sheet.name === trimmedName ||
        (sheet.aliases && sheet.aliases.includes(trimmedName))
    );
  }

  /**
   * Validate core data sheets have meaningful content
   */
  private validateCoreSheets(
    workbook: XLSX.WorkBook,
    result: ValidationResult
  ): void {
    const coreSheets = [
      { name: "BILAN PAYSAGE", aliases: ["Bilan", "BILAN"] },
      {
        name: "COMPTE DE RESULTAT",
        aliases: ["Compte de Résultat", "COMPTE DE RESULTAT"],
      },
      { name: "CF1", aliases: ["cf1"] },
    ];

    for (const coreSheet of coreSheets) {
      const sheetName = workbook.SheetNames.find(
        (name) =>
          name.trim() === coreSheet.name ||
          (coreSheet.aliases && coreSheet.aliases.includes(name.trim()))
      );

      if (sheetName) {
        const sheet = workbook.Sheets[sheetName];
        const data = XLSX.utils.sheet_to_json(sheet, { header: 1 });

        // Check if sheet has numeric data (financial values)
        let hasNumericData = false;
        for (const row of data) {
          if (Array.isArray(row)) {
            for (const cell of row) {
              if (typeof cell === "number" && !isNaN(cell) && cell !== 0) {
                hasNumericData = true;
                break;
              }
            }
            if (hasNumericData) break;
          }
        }

        if (!hasNumericData) {
          result.warnings.push(
            `Core sheet "${sheetName}" appears to have no numeric financial data. Please verify the data is properly filled.`
          );
        }
      }
    }
  }

  /**
   * Get validation summary for user feedback
   */
  getValidationSummary(result: ValidationResult): string {
    let summary = `DSF Validation Results:\n`;
    summary += `• Sheets found: ${result.sheetCount}\n`;

    if (result.errors.length > 0) {
      summary += `\n❌ Critical Issues (${result.errors.length}):\n`;
      result.errors.forEach((error) => {
        summary += `  • ${error}\n`;
      });
    }

    if (result.warnings.length > 0) {
      summary += `\n⚠️  Warnings (${result.warnings.length}):\n`;
      result.warnings.forEach((warning) => {
        summary += `  • ${warning}\n`;
      });
    }

    if (result.isValid && result.errors.length === 0) {
      summary += `\n✅ DSF file structure is valid and ready for import.`;
    } else {
      summary += `\n❌ DSF file has validation errors. Please correct the issues before importing.`;
    }

    return summary;
  }

  /**
   * Extract data from validated DSF file
   */
  extractDSFData(workbook: XLSX.WorkBook): any {
    const data: any = {
      balanceSheet: null,
      incomeStatement: null,
      taxTables: null,
      notes: {},
      signaletics: {},
    };

    // Helper function to sanitize sheet data
    const sanitizeSheetData = (rawData: any[]): any[] => {
      if (!Array.isArray(rawData)) return [];

      return rawData
        .map((row) => {
          if (!Array.isArray(row)) return [];

          return row
            .map((cell) => {
              // Convert invalid values to null or appropriate types
              if (cell === undefined || cell === null) return null;
              if (typeof cell === "string" && cell.trim() === "") return null;
              if (typeof cell === "number" && (isNaN(cell) || !isFinite(cell)))
                return null;

              // Ensure numbers are properly typed
              if (typeof cell === "number") return cell;

              // Ensure strings are clean
              if (typeof cell === "string") return cell.trim();

              // For other types, try to convert to string
              try {
                return String(cell).trim();
              } catch {
                return null;
              }
            })
            .filter((cell, index) => {
              // Remove trailing null cells but keep some structure
              if (index < 2) return true; // Keep first 2 columns
              return cell !== null;
            });
        })
        .filter((row) => {
          // Remove completely empty rows
          return row.some((cell) => cell !== null && cell !== "");
        });
    };

    // Extract balance sheet
    const balanceSheetName = workbook.SheetNames.find(
      (name) =>
        name.trim() === "BILAN PAYSAGE" ||
        name.trim() === "Bilan" ||
        name.trim() === "BILAN"
    );
    if (balanceSheetName) {
      const rawData = XLSX.utils.sheet_to_json(
        workbook.Sheets[balanceSheetName],
        { header: 1 }
      );
      data.balanceSheet = sanitizeSheetData(rawData as any[]);
    }

    // Extract income statement
    const incomeStatementName = workbook.SheetNames.find(
      (name) =>
        name.trim() === "COMPTE DE RESULTAT" ||
        name.trim() === "Compte de Résultat" ||
        name.trim() === "COMPTE DE RESULTAT"
    );
    if (incomeStatementName) {
      const rawData = XLSX.utils.sheet_to_json(
        workbook.Sheets[incomeStatementName],
        { header: 1 }
      );
      data.incomeStatement = sanitizeSheetData(rawData as any[]);
    }

    // Extract tax tables
    const taxTableName = workbook.SheetNames.find(
      (name) =>
        name.trim() === "TABLEAU DES FLUX DE TRESORERIE" ||
        name.trim() === "Tableaux Fiscaux"
    );
    if (taxTableName) {
      const rawData = XLSX.utils.sheet_to_json(workbook.Sheets[taxTableName], {
        header: 1,
      });
      data.taxTables = sanitizeSheetData(rawData as any[]);
    }

    // Extract notes
    const noteSheets = workbook.SheetNames.filter((name) =>
      name.toLowerCase().includes("note")
    );
    for (const sheetName of noteSheets) {
      const cleanName = sheetName.toLowerCase().replace(/\s+/g, "");
      const rawData = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], {
        header: 1,
      });
      data.notes[cleanName] = sanitizeSheetData(rawData as any[]);
    }

    // Extract signaletics
    const signaleticSheets = workbook.SheetNames.filter(
      (name) => name.includes("Fiche R") || name.match(/^r\d+$/i)
    );
    for (const sheetName of signaleticSheets) {
      const ficheNum = sheetName.match(/r(\d+)|Fiche R(\d+)/i);
      if (ficheNum) {
        const num = ficheNum[1] || ficheNum[2];
        const rawData = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], {
          header: 1,
        });
        data.signaletics[`r${num}`] = sanitizeSheetData(rawData as any[]);
      }
    }

    return data;
  }
}

export const dsfValidationService = new DSFValidationService();
