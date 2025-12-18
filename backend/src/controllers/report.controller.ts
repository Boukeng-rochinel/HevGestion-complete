// controllers/report.controller.ts
import { Response } from "express";
import { AuthRequest } from "../middleware/auth.middleware";
import { ResponseBuilder } from "../utils/response-builder";
import * as XLSX from "xlsx";
import * as fs from "fs";
import * as path from "path";
import { BadRequestError, NotFoundError } from "../lib/errors";

interface ReportDefinition {
  id: string;
  name: string;
  category: string;
  description: string;
  sheetName: string;
  templateSheet?: string;
  canEdit: boolean;
  canPreview: boolean;
  requiresDsf?: boolean;
  isGenerated?: boolean;
}

export class ReportController {
  private readonly TEMPLATES_DIR = path.join(
    process.cwd(),
    "upload",
    "templates"
  );
  private readonly MAIN_EXCEL_FILE = "dsf_complet.xlsx";

  // Report definitions matching frontend
  private readonly reportDefinitions: ReportDefinition[] = [
    {
      id: "fiche-r1",
      name: "Fiche R1",
      category: "Fiches Signalétiques",
      description: "Fiche signalétique R1 - Informations générales",
      sheetName: "Fiche_R1",
      templateSheet: "Template_R1",
      canEdit: true,
      canPreview: true,
    },
    {
      id: "fiche-r2",
      name: "Fiche R2",
      category: "Fiches Signalétiques",
      description: "Fiche signalétique R2 - Activité et personnel",
      sheetName: "Fiche R2",
      templateSheet: "Template_R2",
      canEdit: true,
      canPreview: true,
    },
    {
      id: "fiche-r3",
      name: "Fiche R3",
      category: "Fiches Signalétiques",
      description: "Fiche signalétique R3 - Investissements",
      sheetName: "Fiche_R3",
      templateSheet: "Template_R3",
      canEdit: true,
      canPreview: true,
    },
    {
      id: "fiche-r4",
      name: "Fiche R4",
      category: "Fiches Signalétiques",
      description: "Fiche signalétique R4 - Autres informations",
      sheetName: "Fiche_R4",
      templateSheet: "Template_R4",
      canEdit: true,
      canPreview: true,
    },
    {
      id: "note-1",
      name: "Note 1",
      category: "Notes Annexes",
      description: "Note 1 - Immobilisations en non-values",
      sheetName: "Note_1",
      templateSheet: "Template_Note1",
      canEdit: true,
      canPreview: true,
    },
    {
      id: "note-2",
      name: "Note 2",
      category: "Notes Annexes",
      description: "Note 2 - Immobilisations corporelles",
      sheetName: "Note_2",
      templateSheet: "Template_Note2",
      canEdit: true,
      canPreview: true,
    },
    {
      id: "note-3",
      name: "Note 3",
      category: "Notes Annexes",
      description: "Note 3 - Immobilisations financières",
      sheetName: "Note_3",
      templateSheet: "Template_Note3",
      canEdit: true,
      canPreview: true,
    },
    {
      id: "note-4",
      name: "Note 4",
      category: "Notes Annexes",
      description: "Note 4 - Stocks",
      sheetName: "Note_4",
      templateSheet: "Template_Note4",
      canEdit: true,
      canPreview: true,
    },
    {
      id: "note-5",
      name: "Note 5",
      category: "Notes Annexes",
      description: "Note 5 - Créances clients",
      sheetName: "Note_5",
      templateSheet: "Template_Note5",
      canEdit: true,
      canPreview: true,
    },
    {
      id: "note-6",
      name: "Note 6",
      category: "Notes Annexes",
      description: "Note 6 - Valeurs mobilières",
      sheetName: "Note_6",
      templateSheet: "Template_Note6",
      canEdit: true,
      canPreview: true,
    },
    {
      id: "note-7",
      name: "Note 7",
      category: "Notes Annexes",
      description: "Note 7 - Disponibilités",
      sheetName: "Note_7",
      templateSheet: "Template_Note7",
      canEdit: true,
      canPreview: true,
    },
    {
      id: "note-8",
      name: "Note 8",
      category: "Notes Annexes",
      description: "Note 8 - Capitaux propres",
      sheetName: "Note_8",
      templateSheet: "Template_Note8",
      canEdit: true,
      canPreview: true,
    },
    {
      id: "note-9",
      name: "Note 9",
      category: "Notes Annexes",
      description: "Note 9 - Dettes de financement",
      sheetName: "Note_9",
      templateSheet: "Template_Note9",
      canEdit: true,
      canPreview: true,
    },
    {
      id: "note-10",
      name: "Note 10",
      category: "Notes Annexes",
      description: "Note 10 - Provisions pour risques et charges",
      sheetName: "Note_10",
      templateSheet: "Template_Note10",
      canEdit: true,
      canPreview: true,
    },
    {
      id: "bilan-actif",
      name: "Bilan Actif",
      category: "États Financiers",
      description: "Bilan - Actif du patrimoine",
      sheetName: "BILAN PAYSAGE",
      templateSheet: "Template_BilanActif",
      canEdit: true,
      canPreview: true,
      requiresDsf: true,
    },
    {
      id: "bilan-passif",
      name: "Bilan Passif",
      category: "États Financiers",
      description: "Bilan - Passif du patrimoine",
      sheetName: "Bilan_Passif",
      templateSheet: "Template_BilanPassif",
      canEdit: true,
      canPreview: true,
      requiresDsf: true,
    },
    {
      id: "compte-resultat",
      name: "Compte Résultat",
      category: "États Financiers",
      description: "Compte de résultat de l'exercice",
      sheetName: "Compte_Resultat",
      templateSheet: "Template_CompteResultat",
      canEdit: true,
      canPreview: true,
      requiresDsf: true,
    },
    {
      id: "dsf-complet",
      name: "DSF Complet",
      category: "DSF",
      description: "Déclaration Sociale et Fiscale complète",
      sheetName: "DSF_Complet",
      canEdit: false,
      canPreview: true,
      isGenerated: true,
    },
  ];

  /**
   * Get all available reports
   */
  async getReports(req: AuthRequest, res: Response) {
    try {
      const fileExists = await this.checkFileExists();

      return ResponseBuilder.success(
        res,
        {
          reports: this.reportDefinitions,
          fileExists,
          filePath: this.MAIN_EXCEL_FILE,
        },
        "Rapports récupérés avec succès"
      );
    } catch (error) {
      console.error("Error fetching reports:", error);
      return ResponseBuilder.error(
        res,
        "Erreur lors de la récupération des rapports"
      );
    }
  }

  /**
   * Download complete Excel file
   */
  async downloadCompleteFile(req: AuthRequest, res: Response) {
    try {
      const filePath = path.join(this.TEMPLATES_DIR, this.MAIN_EXCEL_FILE);

      if (!fs.existsSync(filePath)) {
        return ResponseBuilder.error(res, "Fichier Excel non trouvé", 404);
      }

      // Set headers for file download
      res.setHeader(
        "Content-Type",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
      );
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="${this.MAIN_EXCEL_FILE}"`
      );

      // Stream the file
      const fileStream = fs.createReadStream(filePath);
      fileStream.pipe(res);

      fileStream.on("error", (error) => {
        console.error("Error streaming file:", error);
        if (!res.headersSent) {
          return ResponseBuilder.error(
            res,
            "Erreur lors du téléchargement du fichier"
          );
        }
      });
    } catch (error) {
      console.error("Error downloading complete file:", error);
      return ResponseBuilder.error(
        res,
        "Erreur lors du téléchargement du fichier complet"
      );
    }
  }

  /**
   * Download specific sheet with formatting preservation
   */
  async downloadSheet(req: AuthRequest, res: Response) {
    try {
      const { sheetName, reportName } = req.params;

      if (!sheetName) {
        return ResponseBuilder.error(res, "Nom de feuille requis", 400);
      }

      const filePath = path.join(this.TEMPLATES_DIR, this.MAIN_EXCEL_FILE);

      if (!fs.existsSync(filePath)) {
        return ResponseBuilder.error(res, "Fichier Excel non trouvé", 404);
      }

      // Read the Excel file
      const fileBuffer = fs.readFileSync(filePath);
      const workbook = XLSX.read(fileBuffer, {
        type: "buffer",
        cellStyles: true,
        cellDates: true,
        cellNF: true,
      });

      // Check if sheet exists
      if (!workbook.SheetNames.includes(sheetName)) {
        return ResponseBuilder.error(
          res,
          `Feuille "${sheetName}" non trouvée`,
          404
        );
      }

      // Create new workbook with only the requested sheet
      const newWorkbook = XLSX.utils.book_new();
      const worksheet = workbook.Sheets[sheetName];

      // Copy worksheet with formatting
      XLSX.utils.book_append_sheet(newWorkbook, worksheet, sheetName);

      // Copy workbook properties and styles if available
      if (workbook.Props) {
        newWorkbook.Props = workbook.Props;
      }

      // Generate buffer with formatting preservation
      const outputBuffer = XLSX.write(newWorkbook, {
        type: "buffer",
        bookType: "xlsx",
        Props: workbook.Props,
      });

      // Set headers for file download
      const filename = reportName
        ? `${reportName.replace(/[^a-zA-Z0-9]/g, "_")}.xlsx`
        : `${sheetName.replace(/[^a-zA-Z0-9]/g, "_")}.xlsx`;

      res.setHeader(
        "Content-Type",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
      );
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="${filename}"`
      );

      // Send the buffer
      res.send(outputBuffer);
    } catch (error) {
      console.error("Error downloading sheet:", error);
      return ResponseBuilder.error(
        res,
        "Erreur lors du téléchargement de la feuille"
      );
    }
  }

  /**
   * Get sheet preview data (JSON format for frontend display)
   */
  async getSheetPreview(req: AuthRequest, res: Response) {
    try {
      const { sheetName } = req.params;

      if (!sheetName) {
        return ResponseBuilder.error(res, "Nom de feuille requis", 400);
      }

      const filePath = path.join(this.TEMPLATES_DIR, this.MAIN_EXCEL_FILE);

      if (!fs.existsSync(filePath)) {
        return ResponseBuilder.error(res, "Fichier Excel non trouvé", 404);
      }

      // Read the Excel file
      const fileBuffer = fs.readFileSync(filePath);
      const workbook = XLSX.read(fileBuffer, {
        type: "buffer",
        cellStyles: true,
        cellDates: true,
        cellNF: true,
      });

      // Check if sheet exists
      if (!workbook.SheetNames.includes(sheetName)) {
        return ResponseBuilder.error(
          res,
          `Feuille "${sheetName}" non trouvée`,
          404
        );
      }

      const worksheet = workbook.Sheets[sheetName];

      // Convert to JSON with formatting info
      const jsonData = XLSX.utils.sheet_to_json(worksheet, {
        header: 1,
        defval: "",
        raw: false,
      });

      // Get cell styles and formatting
      const cellStyles: any = {};

      // Iterate through all cells to capture formatting
      const range = XLSX.utils.decode_range(worksheet["!ref"] || "A1");
      for (let row = range.s.r; row <= range.e.r; row++) {
        for (let col = range.s.c; col <= range.e.c; col++) {
          const cellAddress = XLSX.utils.encode_cell({ r: row, c: col });
          const cell = worksheet[cellAddress];

          if (cell) {
            cellStyles[cellAddress] = {
              value: cell.v,
              formula: cell.f,
              style: {
                bold: cell.s?.font?.bold || false,
                italic: cell.s?.font?.italic || false,
                underline: cell.s?.font?.underline || false,
                fontSize: cell.s?.font?.sz || 11,
                fontName: cell.s?.font?.name || "Calibri",
                color: cell.s?.font?.color?.rgb,
                backgroundColor: cell.s?.fill?.fgColor?.rgb,
                border: cell.s?.border,
                alignment: cell.s?.alignment,
                numberFormat: cell.z,
              },
            };
          }
        }
      }

      return ResponseBuilder.success(
        res,
        {
          sheetName,
          data: jsonData,
          styles: cellStyles,
          range: worksheet["!ref"],
          merges: worksheet["!merges"] || [],
          columns: worksheet["!cols"] || [],
          rows: worksheet["!rows"] || [],
        },
        "Aperçu de la feuille récupéré avec succès"
      );
    } catch (error) {
      console.error("Error getting sheet preview:", error);
      return ResponseBuilder.error(
        res,
        "Erreur lors de la récupération de l'aperçu"
      );
    }
  }

  /**
   * Upload Excel file
   */
  async uploadFile(req: AuthRequest, res: Response) {
    try {
      if (!req.file) {
        return ResponseBuilder.error(res, "Aucun fichier fourni", 400);
      }

      const file = req.file;

      // Validate file type
      if (
        !file.originalname.endsWith(".xlsx") &&
        !file.originalname.endsWith(".xls")
      ) {
        return ResponseBuilder.error(
          res,
          "Type de fichier invalide. Seuls les fichiers .xlsx et .xls sont acceptés",
          400
        );
      }

      // Ensure templates directory exists
      if (!fs.existsSync(this.TEMPLATES_DIR)) {
        fs.mkdirSync(this.TEMPLATES_DIR, { recursive: true });
      }

      // Save file
      const filePath = path.join(this.TEMPLATES_DIR, this.MAIN_EXCEL_FILE);
      fs.writeFileSync(filePath, file.buffer);

      // Validate Excel file and get sheet info
      const workbook = XLSX.read(file.buffer, { type: "buffer" });
      const availableSheets = workbook.SheetNames;

      // Filter reports based on available sheets
      const availableReports = this.reportDefinitions.filter(
        (report) =>
          availableSheets.includes(report.sheetName) ||
          (report.templateSheet &&
            availableSheets.includes(report.templateSheet))
      );

      return ResponseBuilder.success(
        res,
        {
          fileName: file.originalname,
          fileSize: file.size,
          sheetsCount: availableSheets.length,
          availableSheets,
          availableReports: availableReports.length,
          reports: availableReports,
        },
        "Fichier Excel uploadé avec succès"
      );
    } catch (error) {
      console.error("Error uploading file:", error);
      return ResponseBuilder.error(res, "Erreur lors de l'upload du fichier");
    }
  }

  /**
   * Check if Excel file exists
   */
  async checkFileStatus(req: AuthRequest, res: Response) {
    try {
      const fileExists = await this.checkFileExists();
      const filePath = path.join(this.TEMPLATES_DIR, this.MAIN_EXCEL_FILE);

      let fileInfo: any = null;
      if (fileExists) {
        const stats = fs.statSync(filePath);
        fileInfo = {
          size: stats.size,
          modified: stats.mtime.toISOString(),
        };

        // Try to get sheet info
        try {
          const fileBuffer = fs.readFileSync(filePath);
          const workbook = XLSX.read(fileBuffer, { type: "buffer" });
          fileInfo.sheets = workbook.SheetNames;
          fileInfo.sheetsCount = workbook.SheetNames.length;
        } catch (error) {
          console.error("Error reading workbook info:", error);
        }
      }

      return ResponseBuilder.success(
        res,
        {
          fileExists,
          filePath: this.MAIN_EXCEL_FILE,
          fileInfo,
        },
        "Statut du fichier vérifié"
      );
    } catch (error) {
      console.error("Error checking file status:", error);
      return ResponseBuilder.error(
        res,
        "Erreur lors de la vérification du statut du fichier"
      );
    }
  }

  /**
   * Helper method to check if file exists
   */
  private async checkFileExists(): Promise<boolean> {
    try {
      const filePath = path.join(this.TEMPLATES_DIR, this.MAIN_EXCEL_FILE);
      return fs.existsSync(filePath);
    } catch (error) {
      console.error("Error checking file existence:", error);
      return false;
    }
  }
}

export const reportController = new ReportController();
