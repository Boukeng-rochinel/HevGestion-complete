import { PrismaClient, DSFStatus } from "@prisma/client";
import * as XLSX from "xlsx";
import * as fs from "fs";
import * as path from "path";
import { config } from "../config";
import {
  calculateMatchScore,
  calculateStringSimilarity,
} from "../utils/dsf-matching.utils";

const prisma = new PrismaClient();

interface ParsedSheet {
  name: string;
  rows: any[];
}

interface ParsedWorkbook {
  sheets: ParsedSheet[];
}

interface DebtItem {
  libelle: string;
  note: string;
  montantBrut: number;
  hypotheques: number;
  nantissements: number;
  gagesAutres: number;
}

class DSFImportService {
  async importDSFFile(
    file: Express.Multer.File,
    folderId: string,
    userId: string
  ): Promise<string> {
    console.log(
      `DSFImportService: Starting import for folder ${folderId}, user ${userId}`
    );

    // 1. Check if DSF already exists for this folder
    const existingDSF = await prisma.dSF.findUnique({
      where: { folderId },
    });

    if (existingDSF) {
      throw new Error(
        "Une DSF existe déjà pour cet exercice. Import annulé pour éviter l'écrasement."
      );
    }

    // 2. Upload file and get URL
    const fileUrl = await this.uploadFile(file);

    // 3. Extract year from filename
    const exerciseYear = this.extractYearFromFileName(file.originalname);

    // 4. Create import record
    const dsfImport = await prisma.dSFImport.create({
      data: {
        folderId,
        fileName: file.originalname,
        fileUrl,
        exerciseYear,
        importedBy: userId,
        status: "processing",
      },
    });

    // 5. Parse Excel file and extract all reports
    const reportsData = await this.parseAndExtractReports(file.path);

    // 6. Create DSF with reports data
    const dsfData: any = {
      folderId,
      userId,
      status: DSFStatus.GENERATED,
    };

    // Map reports to individual fields
    if (reportsData.NOTE1) dsfData.note1 = reportsData.NOTE1;
    if (reportsData.NOTE2) dsfData.note2 = reportsData.NOTE2;
    if (reportsData.NOTE3A) dsfData.note3a = reportsData.NOTE3A;
    if (reportsData.NOTE3B) dsfData.note3b = reportsData.NOTE3B;
    if (reportsData.NOTE4) dsfData.note4 = reportsData.NOTE4;
    if (reportsData.NOTE5) dsfData.note5 = reportsData.NOTE5;
    if (reportsData.NOTE6) dsfData.note6 = reportsData.NOTE6;
    if (reportsData.NOTE7) dsfData.note7 = reportsData.NOTE7;
    if (reportsData.NOTE8) dsfData.note8 = reportsData.NOTE8;
    if (reportsData.NOTE9) dsfData.note9 = reportsData.NOTE9;
    if (reportsData.NOTE10) dsfData.note10 = reportsData.NOTE10;
    if (reportsData.BALANCE_SHEET)
      dsfData.balanceSheet = reportsData.BALANCE_SHEET;
    if (reportsData.INCOME_STATEMENT)
      dsfData.incomeStatement = reportsData.INCOME_STATEMENT;

    await prisma.dSF.create({
      data: dsfData,
    });

    // 7. Update import status
    await prisma.dSFImport.update({
      where: { id: dsfImport.id },
      data: { status: "completed" },
    });

    return dsfImport.id;
  }

  private async uploadFile(file: Express.Multer.File): Promise<string> {
    // For now, return the path as URL
    // In production, upload to cloud storage
    return file.path;
  }

  private extractYearFromFileName(fileName: string): number {
    // Extract year from filename (e.g., "DSF_2024.xlsx" -> 2024)
    const match = fileName.match(/(\d{4})/);
    return match ? parseInt(match[1]) : new Date().getFullYear();
  }

  private async parseExcelFile(filePath: string): Promise<ParsedWorkbook> {
    const workbook = XLSX.readFile(filePath);
    const sheets: ParsedSheet[] = [];

    for (const sheetName of workbook.SheetNames) {
      const worksheet = workbook.Sheets[sheetName];
      const rows = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
      sheets.push({ name: sheetName, rows });
    }

    return { sheets };
  }

  private async parseAndExtractReports(filePath: string): Promise<any> {
    const workbook = XLSX.readFile(filePath);
    const reports: any = {};

    // Extract data from specific sheets
    const sheetMappings = {
      "Note 1 ": "NOTE1",
      "NOTE 2": "NOTE2",
      "NOTE 3A": "NOTE3A",
      "NOTE 3B": "NOTE3B",
      "NOTE 4 ": "NOTE4",
      "NOTE 5 ": "NOTE5",
      "NOTE 6 ": "NOTE6",
      "NOTE 7 ": "NOTE7",
      "NOTE 8 ": "NOTE8",
      "NOTE 9 ": "NOTE9",
      "NOTE 10 ": "NOTE10",
      "BILAN PAYSAGE": "BALANCE_SHEET",
      "COMPTE DE RESULTAT": "INCOME_STATEMENT",
    };

    for (const [sheetName, reportType] of Object.entries(sheetMappings)) {
      if (workbook.Sheets[sheetName]) {
        const worksheet = workbook.Sheets[sheetName];
        const data = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

        // Extract structured data based on sheet type
        reports[reportType] = this.extractReportData(sheetName, data);
      }
    }

    return reports;
  }

  private extractReportData(sheetName: string, data: any[]): any {
    // Basic extraction - convert array of arrays to structured data
    // This can be enhanced based on specific sheet structures
    if (sheetName === "Note 1 ") {
      return this.extractNote1Data(data);
    }

    // For other sheets, return the raw data structure
    return {
      rawData: data,
      extractedAt: new Date().toISOString(),
    };
  }

  private extractNote1Data(data: any[]): any {
    // Extract Note 1 specific structure
    const note1Data = {
      header: {
        raisonSociale: this.extractCellValue(data, 1, 1) || "",
        exerciceClos: this.extractCellValue(data, 1, 3) || "",
        numeroIdentification: this.extractCellValue(data, 2, 1) || "",
        duree: this.extractCellValue(data, 2, 3) || "",
      },
      dettes: {
        dettesFinancieres: [] as DebtItem[],
        dettesLocationAcquisition: [] as DebtItem[],
        dettesPassifCirculant: [] as DebtItem[],
        sousTotaux: {
          dettesFinancieres: {
            montantBrut: 0,
            hypotheques: 0,
            nantissements: 0,
            gagesAutres: 0,
          },
          dettesLocationAcquisition: {
            montantBrut: 0,
            hypotheques: 0,
            nantissements: 0,
            gagesAutres: 0,
          },
          dettesPassifCirculant: {
            montantBrut: 0,
            hypotheques: 0,
            nantissements: 0,
            gagesAutres: 0,
          },
          total: {
            montantBrut: 0,
            hypotheques: 0,
            nantissements: 0,
            gagesAutres: 0,
          },
        },
      },
      engagementsFinanciers: [],
      totalEngagements: { engagementsDonnes: 0, engagementsRecus: 0 },
    };

    // Extract debt data from the table (starting around row 10-15)
    let currentSection = "";
    for (let i = 10; i < data.length; i++) {
      const row = data[i];
      if (!row || row.length === 0) continue;

      const firstCell = String(row[0] || "").trim();

      if (firstCell.includes("Dettes financières")) {
        currentSection = "financieres";
      } else if (firstCell.includes("Dettes de location")) {
        currentSection = "location";
      } else if (firstCell.includes("Dettes du passif")) {
        currentSection = "passif";
      } else if (
        firstCell &&
        !firstCell.includes("SOUS TOTAL") &&
        !firstCell.includes("TOTAL") &&
        row.length >= 4
      ) {
        // This is a data row
        const debtItem = {
          libelle: firstCell,
          note: String(row[1] || ""),
          montantBrut: this.parseNumber(row[2]),
          hypotheques: this.parseNumber(row[3]),
          nantissements: this.parseNumber(row[4]),
          gagesAutres: this.parseNumber(row[5]),
        };

        if (currentSection === "financieres") {
          note1Data.dettes.dettesFinancieres.push(debtItem);
        } else if (currentSection === "location") {
          note1Data.dettes.dettesLocationAcquisition.push(debtItem);
        } else if (currentSection === "passif") {
          note1Data.dettes.dettesPassifCirculant.push(debtItem);
        }
      }
    }

    // Calculate subtotals
    this.calculateSubtotals(note1Data);

    return note1Data;
  }

  private extractCellValue(
    data: any[],
    rowIndex: number,
    colIndex: number
  ): string {
    if (data[rowIndex] && data[rowIndex][colIndex]) {
      return String(data[rowIndex][colIndex]).trim();
    }
    return "";
  }

  private parseNumber(value: any): number {
    if (typeof value === "number") return value;
    if (typeof value === "string") {
      const parsed = parseFloat(value.replace(/[^\d.-]/g, ""));
      return isNaN(parsed) ? 0 : parsed;
    }
    return 0;
  }

  private calculateSubtotals(note1Data: any): void {
    // Calculate subtotals for each section
    const sections = [
      "dettesFinancieres",
      "dettesLocationAcquisition",
      "dettesPassifCirculant",
    ];

    sections.forEach((section) => {
      const items = note1Data.dettes[section];
      const subtotal = items.reduce(
        (acc: any, item: any) => ({
          montantBrut: acc.montantBrut + item.montantBrut,
          hypotheques: acc.hypotheques + item.hypotheques,
          nantissements: acc.nantissements + item.nantissements,
          gagesAutres: acc.gagesAutres + item.gagesAutres,
        }),
        { montantBrut: 0, hypotheques: 0, nantissements: 0, gagesAutres: 0 }
      );

      note1Data.dettes.sousTotaux[section] = subtotal;
    });

    // Calculate total
    const total = sections.reduce(
      (acc, section) => {
        const subtotal = note1Data.dettes.sousTotaux[section];
        return {
          montantBrut: acc.montantBrut + subtotal.montantBrut,
          hypotheques: acc.hypotheques + subtotal.hypotheques,
          nantissements: acc.nantissements + subtotal.nantissements,
          gagesAutres: acc.gagesAutres + subtotal.gagesAutres,
        };
      },
      { montantBrut: 0, hypotheques: 0, nantissements: 0, gagesAutres: 0 }
    );

    note1Data.dettes.sousTotaux.total = total;
  }

  private async processSheet(
    importId: string,
    sheet: ParsedSheet,
    mappingConfigs: any[]
  ) {
    // Detect sheet type
    const detectedType = this.detectSheetType(sheet.name, mappingConfigs);

    // Create sheet record
    const dsfSheet = await prisma.dSFSheet.create({
      data: {
        importId,
        sheetName: sheet.name,
        detectedType: detectedType?.type,
        matchConfidence: detectedType?.confidence,
        rowCount: sheet.rows.length,
      },
    });

    // Extract and match entries
    const config = mappingConfigs.find(
      (c) => c.noteType === detectedType?.type
    );
    if (config) {
      await this.extractAndMatchEntries(dsfSheet.id, sheet, config);
    }
  }

  private detectSheetType(sheetName: string, configs: any[]): any {
    let bestMatch = null;
    let bestScore = 0;

    for (const config of configs) {
      for (const pattern of config.sheetNamePatterns) {
        const score = calculateStringSimilarity(sheetName, pattern);
        if (score > bestScore) {
          bestScore = score;
          bestMatch = { type: config.noteType, confidence: score };
        }
      }
    }

    return bestScore > 60 ? bestMatch : null;
  }

  private async extractAndMatchEntries(
    sheetId: string,
    sheet: ParsedSheet,
    config: any
  ) {
    for (let i = 0; i < sheet.rows.length; i++) {
      const row = sheet.rows[i];

      // Skip empty rows or headers
      if (this.isEmptyRow(row) || this.isHeaderRow(row, i)) continue;

      const entry = {
        sheetName: sheet.name,
        libelle: this.extractLibelle(row),
        accountNumber: this.extractAccountNumber(row),
        rowNumber: i + 1,
      };

      // Find best matching field
      let bestMatch = null;
      let bestScore = 0;

      for (const field of config.fields) {
        const score = calculateMatchScore(entry, {
          sheetNamePatterns: config.sheetNamePatterns,
          libellePatterns: field.libellePatterns,
          accountPatterns: field.accountPatterns,
        });

        if (score > bestScore) {
          bestScore = score;
          bestMatch = field;
        }
      }

      // Extract values
      const values = this.extractValues(row);

      // Store entry
      await prisma.dSFEntry.create({
        data: {
          importId: await this.getImportId(sheetId),
          sheetId,
          rowNumber: i + 1,
          libelle: entry.libelle,
          libelleNormalized: this.normalizeLibelle(entry.libelle),
          accountNumber: entry.accountNumber,
          valueN: values.valueN,
          valueN1: values.valueN1,
          valueN2: values.valueN2,
          matchedFieldId: bestMatch?.fieldId,
          matchConfidence: bestScore,
        },
      });
    }
  }

  private extractLibelle(row: any[]): string {
    // Assume libelle is in first text column
    for (const cell of row) {
      if (typeof cell === "string" && cell.trim()) {
        return cell.trim();
      }
    }
    return "";
  }

  private extractAccountNumber(row: any[]): string | undefined {
    // Look for account number pattern
    for (const cell of row) {
      if (typeof cell === "string" && /^\d{3,6}/.test(cell)) {
        return cell;
      }
    }
    return undefined;
  }

  private extractValues(row: any[]): {
    valueN?: number;
    valueN1?: number;
    valueN2?: number;
  } {
    const values: number[] = [];
    for (const cell of row) {
      if (typeof cell === "number") {
        values.push(cell);
      }
    }
    return {
      valueN: values[0],
      valueN1: values[1],
      valueN2: values[2],
    };
  }

  private normalizeLibelle(libelle: string): string {
    return libelle
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]/g, " ")
      .trim();
  }

  private isEmptyRow(row: any[]): boolean {
    return (
      !row ||
      row.every((cell) => !cell || (typeof cell === "string" && !cell.trim()))
    );
  }

  private isHeaderRow(row: any[], index: number): boolean {
    // First few rows are usually headers
    if (index < 3) return true;

    // Check if row contains header keywords
    const headerKeywords = ["libelle", "compte", "exercice", "n-1", "n-2"];
    const rowText = row.join(" ").toLowerCase();

    return headerKeywords.some((keyword) => rowText.includes(keyword));
  }

  private async getImportId(sheetId: string): Promise<string> {
    const sheet = await prisma.dSFSheet.findUnique({
      where: { id: sheetId },
      select: { importId: true },
    });
    return sheet!.importId;
  }

  async applyImportToDSF(importId: string) {
    console.log(`DSFImportService: Applying import ${importId} to DSF`);

    const dsfImport = await prisma.dSFImport.findUnique({
      where: { id: importId },
      include: {
        folder: true,
        entries: {
          where: {
            matchConfidence: { gte: 80 },
            matchedFieldId: { not: null },
          },
        },
      },
    });

    if (!dsfImport) {
      throw new Error("Import not found");
    }

    console.log(
      `DSFImportService: Found ${dsfImport.entries.length} high-confidence entries to apply`
    );

    const dsf = await prisma.dSF.findUnique({
      where: { folderId: dsfImport.folderId },
    });

    if (!dsf) {
      throw new Error("DSF not found for this folder");
    }

    const fieldMap: { [key: string]: string } = {
      NOTE1: "note1",
      NOTE2: "note2",
      NOTE3A: "note3a",
      NOTE3B: "note3b",
      NOTE4: "note4",
      NOTE5: "note5",
      NOTE6: "note6",
      NOTE7: "note7",
      NOTE8: "note8",
      NOTE9: "note9",
      NOTE10: "note10",
      BALANCE_SHEET: "balanceSheet",
      INCOME_STATEMENT: "incomeStatement",
    };

    const updateData: any = {};

    for (const entry of dsfImport.entries) {
      if (!entry.matchedFieldId) continue;

      // Parse fieldId like "note1-dettes-financieres" -> noteType: "note1", fieldKey: "dettesFinancieres"
      const parts = entry.matchedFieldId.split("-");
      const noteType = parts[0].toUpperCase();
      const fieldKey = parts.slice(1).join("");

      const fieldName = fieldMap[noteType];
      if (fieldName && entry.valueN !== null && entry.valueN !== undefined) {
        console.log(
          `DSFImportService: Applying ${entry.libelle} (${entry.valueN}) to ${noteType}.${fieldKey}`
        );
        if (!updateData[fieldName]) {
          updateData[fieldName] = (dsf as any)[fieldName] || {};
        }
        updateData[fieldName][fieldKey] = entry.valueN;
      } else {
        console.log(
          `DSFImportService: Skipping ${entry.libelle} - field not found or no value`
        );
      }
    }

    await prisma.dSF.update({
      where: { id: dsf.id },
      data: updateData,
    });

    console.log(`DSFImportService: Successfully applied import to DSF`);
  }
}

export { DSFImportService };
