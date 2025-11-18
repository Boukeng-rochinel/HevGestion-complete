// src/services/excel.service.ts
import * as XLSX from "xlsx";
import * as fs from "fs";
import * as path from "path";
import { config } from "../config";

export class ExcelService {
  static async parseBalanceFile(filePath: string): Promise<any> {
    try {
      console.log("ExcelService: Reading file:", filePath);

      // Check if file exists
      if (!require("fs").existsSync(filePath)) {
        throw new Error(`File not found: ${filePath}`);
      }

      const workbook = XLSX.readFile(filePath);

      if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
        throw new Error("Excel file has no sheets");
      }

      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];

      if (!worksheet) {
        throw new Error(`Sheet '${sheetName}' not found in Excel file`);
      }

      console.log("ExcelService: Sheet name:", sheetName);
      const data: any[] = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
      console.log("ExcelService: Raw data rows:", data.length);

      if (!data || data.length === 0) {
        throw new Error("Excel file is empty or invalid");
      }

      // Find the first non-empty row as headers
      let headerRowIndex = 0;
      for (let i = 0; i < Math.min(data.length, 10); i++) {
        const row = data[i];
        if (
          row &&
          row.some(
            (cell: any) =>
              cell !== null && cell !== undefined && String(cell).trim() !== ""
          )
        ) {
          headerRowIndex = i;
          break;
        }
      }

      const headers = data[headerRowIndex] as string[];
      console.log(
        "ExcelService: Headers found at row",
        headerRowIndex,
        ":",
        headers
      );

      if (!headers || headers.length === 0) {
        throw new Error("No headers found in Excel file");
      }

      // Skip the header row for data processing
      const dataStartIndex = headerRowIndex + 1;
      const rows: any[] = [];

      for (let i = dataStartIndex; i < data.length; i++) {
        const row = data[i] as any[];
        if (!row || row.length === 0) continue;

        console.log(
          `ExcelService: Processing row ${i}, row length:`,
          row.length
        );

        const rowObj: any = {};
        headers.forEach((header, index) => {
          const normalizedHeader = ExcelService.normalizeHeader(header);
          rowObj[normalizedHeader] = row[index];
          console.log(
            `ExcelService: Header ${header} -> ${normalizedHeader} = ${row[index]}`
          );
        });

        console.log(`ExcelService: Processed row ${i}:`, rowObj);

        const processedRow = {
          accountNumber: String(rowObj.accountNumber || "").trim(),
          accountName: String(rowObj.accountName || "").trim(),
          openingDebit: parseFloat(rowObj.openingDebit || "0") || 0,
          openingCredit: parseFloat(rowObj.openingCredit || "0") || 0,
          movementDebit: parseFloat(rowObj.movementDebit || "0") || 0,
          movementCredit: parseFloat(rowObj.movementCredit || "0") || 0,
          closingDebit: parseFloat(rowObj.closingDebit || "0") || 0,
          closingCredit: parseFloat(rowObj.closingCredit || "0") || 0,
        };

        rows.push(processedRow);
      }

      console.log("ExcelService: Final processed rows:", rows.length);
      return { rows };
    } catch (error) {
      console.error("ExcelService: Error parsing file:", error);
      throw error;
    }
  }

  static async getBalanceTemplate(): Promise<any> {
    // In production, this would come from database
    return {
      headers: [
        "Numéro de Compte",
        "Intitulé du Compte",
        "Solde Débiteur Ouverture",
        "Solde Créditeur Ouverture",
        "Mouvement Débit",
        "Mouvement Crédit",
        "Solde Débiteur Clôture",
        "Solde Créditeur Clôture",
      ],
      sampleAccounts: [
        { account: "101000", name: "Capital social", class: "1" },
        { account: "211000", name: "Terrains", class: "2" },
        { account: "401000", name: "Fournisseurs", class: "4" },
        { account: "521000", name: "Banques", class: "5" },
      ],
    };
  }

  static async createBalanceFromTemplate(
    template: any,
    fiscalYear: number
  ): Promise<string> {
    const workbook = XLSX.utils.book_new();
    const data: any[][] = [];

    // Add headers
    data.push(template.headers);

    // Add sample rows with zero values
    template.sampleAccounts.forEach((acc: any) => {
      data.push([acc.account, acc.name, 0, 0, 0, 0, 0, 0]);
    });

    const worksheet = XLSX.utils.aoa_to_sheet(data);
    XLSX.utils.book_append_sheet(workbook, worksheet, "Balance");

    // Save file
    const fileName = `balance_template_${fiscalYear}_${Date.now()}.xlsx`;
    const filePath = path.join(config.upload.directory, fileName);

    XLSX.writeFile(workbook, filePath);

    return filePath;
  }

  private static normalizeHeader(header: string): string {
    const mapping: { [key: string]: string } = {
      // Headers français simplifiés du template
      comptes: "accountNumber",
      compte: "accountNumber",
      libelle: "accountName",
      libellé: "accountName",
      "ouverture debit": "openingDebit",
      "ouverture credit": "openingCredit",
      "mouvement debit": "movementDebit",
      "mouvement credit": "movementCredit",
      "solde debit": "closingDebit",
      "solde credit": "closingCredit",

      // Headers français détaillés (pour compatibilité)
      "numéro de compte": "accountNumber",
      "numero de compte": "accountNumber",
      libellés: "accountName",
      "intitulé du compte": "accountName",
      "intitule du compte": "accountName",
      "entrée débit": "openingDebit",
      "entrée debit": "openingDebit",
      "solde débiteur ouverture": "openingDebit",
      "solde debiteur ouverture": "openingDebit",
      "sd ouverture": "openingDebit",
      "entrée crédit": "openingCredit",
      "entrée credit": "openingCredit",
      "solde créditeur ouverture": "openingCredit",
      "solde crediteur ouverture": "openingCredit",
      "sc ouverture": "openingCredit",
      "mouvement débit": "movementDebit",
      "mvt debit": "movementDebit",
      "mouvement crédit": "movementCredit",
      "mvt credit": "movementCredit",
      "sortie débit": "closingDebit",
      "sortie debit": "closingDebit",
      "solde débiteur clôture": "closingDebit",
      "solde debiteur cloture": "closingDebit",
      "sd cloture": "closingDebit",
      "sortie crédit": "closingCredit",
      "sortie credit": "closingCredit",
      "solde créditeur clôture": "closingCredit",
      "solde crediteur cloture": "closingCredit",
      "sc cloture": "closingCredit",
    };

    const normalized = header.toLowerCase().trim();
    const result = mapping[normalized] || header;
    console.log(
      `ExcelService: Header "${header}" -> normalized "${normalized}" -> mapped to "${result}"`
    );
    return result;
  }
}
