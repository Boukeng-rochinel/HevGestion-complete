// controllers/notes.controller.ts
import { Response } from "express";
import { AuthRequest } from "../middleware/auth.middleware";
import { ResponseBuilder } from "../utils/response-builder";
import { notesService, NoteData, DSFNoteType } from "../services/notes.service";

const VALID_NOTE_TYPES: DSFNoteType[] = [
  "NOTE1",
  "NOTE2",
  "NOTE3",
  "NOTE4",
  "NOTE5",
  "NOTE6",
  "NOTE7",
  "NOTE8",
  "NOTE9",
  "NOTE10",
];
import { Note1Generator } from "../services/note1-generator.service";
import { prisma } from "../lib/prisma";

export class NotesController {
  /**
   * Save note data
   */
  async saveNote(req: AuthRequest, res: Response) {
    try {
      const { folderId, noteType, data } = req.body;

      if (!folderId || !noteType || !data) {
        return ResponseBuilder.error(
          res,
          "folderId, noteType, and data are required",
          400
        );
      }

      // Validate noteType
      if (!VALID_NOTE_TYPES.includes(noteType)) {
        return ResponseBuilder.error(res, "Invalid note type", 400);
      }

      const result = await notesService.saveNote(
        folderId,
        noteType,
        data as NoteData,
        req.user!.userId
      );

      return ResponseBuilder.success(
        res,
        result,
        "Note data saved successfully"
      );
    } catch (error) {
      console.error("Error saving note:", error);
      return ResponseBuilder.error(res, "Failed to save note data");
    }
  }

  /**
   * Get note data
   */
  async getNote(req: AuthRequest, res: Response) {
    try {
      const { folderId, noteType } = req.params;

      if (!folderId || !noteType) {
        return ResponseBuilder.error(
          res,
          "folderId and noteType are required",
          400
        );
      }

      // Validate noteType
      if (!VALID_NOTE_TYPES.includes(noteType as DSFNoteType)) {
        return ResponseBuilder.error(res, "Invalid note type", 400);
      }

      const noteData = await notesService.getNote(
        folderId,
        noteType as DSFNoteType
      );

      if (!noteData) {
        return ResponseBuilder.success(res, null, "Note not found");
      }

      return ResponseBuilder.success(
        res,
        noteData,
        "Note data retrieved successfully"
      );
    } catch (error) {
      console.error("Error getting note:", error);
      return ResponseBuilder.error(res, "Failed to get note data");
    }
  }

  /**
   * Get all notes for a folder
   */
  async getNotesForFolder(req: AuthRequest, res: Response) {
    try {
      const { folderId } = req.params;

      if (!folderId) {
        return ResponseBuilder.error(res, "folderId is required", 400);
      }

      const notes = await notesService.getNotesForFolder(folderId);

      return ResponseBuilder.success(
        res,
        notes,
        "Notes retrieved successfully"
      );
    } catch (error) {
      console.error("Error getting notes for folder:", error);
      return ResponseBuilder.error(res, "Failed to get notes for folder");
    }
  }

  /**
   * Generate Note 1 data from DSF config and balance
   */
  async generateNote1(req: AuthRequest, res: Response) {
    try {
      const { folderId } = req.params;

      if (!folderId) {
        return ResponseBuilder.error(res, "folderId is required", 400);
      }

      // Fetch folder with relations (client and balances)
      const folder = await prisma.folder.findUnique({
        where: { id: folderId },
        include: {
          client: true,
          balances: true,
        },
      });

      if (!folder) {
        return ResponseBuilder.error(res, "Folder not found", 404);
      }

      const folderWithBalances = folder as any;
      if (
        !folderWithBalances.balances ||
        folderWithBalances.balances.length === 0
      ) {
        return ResponseBuilder.error(
          res,
          "No balance data found for this folder",
          404
        );
      }

      const currentBalance = folderWithBalances.balances.find(
        (b: any) => b.type === "CURRENT_YEAR"
      );
      const previousBalance = folderWithBalances.balances.find(
        (b: any) => b.type === "PREVIOUS_YEAR"
      );

      if (!currentBalance) {
        return ResponseBuilder.error(
          res,
          "No current year balance data found for this folder",
          404
        );
      }

      // Fetch DSF config for note1
      const dsfConfig = await prisma.dSFComptableConfig.findFirst({
        where: {
          OR: [
            { exerciseId: folderId },
            { clientId: folder.clientId, exerciseId: null },
            { ownerType: "SYSTEM" },
          ],
          config: {
            category: "note1",
          },
          isActive: true,
        },
        include: {
          config: {
            include: {
              accountMappings: true,
            },
          },
        },
        orderBy: [
          { ownerType: "asc" }, // Prefer ACCOUNTANT over SYSTEM
          { createdAt: "desc" },
        ],
      });

      let configData: any = undefined;
      if (dsfConfig) {
        configData = {
          category: dsfConfig.config.category,
          accountMappings: dsfConfig.config.accountMappings || [],
        };
      }

      // Generate Note 1 using the service
      const generator = new Note1Generator();
      const note1Data = await generator.generateNote1(
        folder as any, // Cast to FolderWithRelations
        { rows: currentBalance.originalData as any },
        previousBalance
          ? { rows: previousBalance.originalData as any }
          : undefined,
        configData
      );

      return ResponseBuilder.success(
        res,
        note1Data,
        "Note 1 generated successfully from DSF config and balance"
      );
    } catch (error) {
      console.error("Error testing Note 1 generation:", error);
      return ResponseBuilder.error(res, "Failed to generate Note 1");
    }
  }
}

export const notesController = new NotesController();
