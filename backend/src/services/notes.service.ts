// services/notes.service.ts
import { PrismaClient } from "@prisma/client";

export type DSFNoteType =
  | "NOTE1"
  | "NOTE2"
  | "NOTE3"
  | "NOTE4"
  | "NOTE5"
  | "NOTE6"
  | "NOTE7"
  | "NOTE8"
  | "NOTE9"
  | "NOTE10"
  | "NOTE11"
  | "NOTE12"
  | "NOTE13"
  | "NOTE14"
  | "NOTE15"
  | "NOTE16"
  | "NOTE17"
  | "NOTE18"
  | "NOTE19"
  | "NOTE20"
  | "NOTE21"
  | "NOTE22"
  | "NOTE23"
  | "NOTE24"
  | "NOTE25"
  | "NOTE26"
  | "NOTE27"
  | "NOTE28"
  | "NOTE29"
  | "NOTE30"
  | "NOTE31"
  | "NOTE32"
  | "NOTE33"
  | "FICHE1"
  | "FICHE2"
  | "FICHE3"
  | "CTER"
  | "CF1";

const prisma = new PrismaClient();

export interface NoteData {
  headerInfo: any;
  valeurs?: any[];
  totalBrut?: any;
  depreciations?: any[];
  totalNet?: any;
  debts?: any;
  commitments?: any;
  comment?: string;
}

export class NotesService {
  /**
   * Save or update note data
   */
  async saveNote(
    folderId: string,
    noteType: DSFNoteType,
    data: NoteData,
    userId: string
  ) {
    try {
      // First, ensure DSF exists for this folder
      let dsf = await prisma.dSF.findUnique({
        where: { folderId },
      });

      if (!dsf) {
        dsf = await prisma.dSF.create({
          data: {
            folderId,
            userId,
            status: "DRAFT",
          },
        });
      }

      const fieldName = noteType.toLowerCase();

      await prisma.dSF.update({
        where: { id: dsf.id },
        data: { [fieldName]: data },
      });

      return data;
    } catch (error) {
      console.error("Error saving note:", error);
      throw new Error("Failed to save note data");
    }
  }

  /**
   * Get note data
   */
  async getNote(folderId: string, noteType: DSFNoteType) {
    try {
      const dsf = await prisma.dSF.findUnique({
        where: { folderId },
      });

      if (!dsf) {
        return null;
      }

      const fieldName = noteType.toLowerCase();
      return (dsf as any)[fieldName];
    } catch (error) {
      console.error("Error getting note:", error);
      throw new Error("Failed to get note data");
    }
  }

  /**
   * Get all notes for a folder
   */
  async getNotesForFolder(folderId: string) {
    try {
      const dsf = await prisma.dSF.findUnique({
        where: { folderId },
      });

      if (!dsf) {
        return [];
      }

      const notes = [];
      const fields = [
        "note1",
        "note2",
        "note3a",
        "note3b",
        "note4",
        "note5",
        "note6",
        "note7",
        "note8",
        "note9",
        "note10",
        "note11",
        "note12",
        "note13",
        "note14",
        "note15",
        "note16",
        "note17",
        "note18",
        "note19",
        "note20",
        "note21",
        "note22",
        "note23",
        "note24",
        "note25",
        "note26",
        "note27",
        "note28",
        "note29",
        "note30",
        "note31",
        "note32",
        "note33",
        "fiche1",
        "fiche2",
        "fiche3",
        "cter",
        "cf1",
      ];

      for (const field of fields) {
        const data = (dsf as any)[field];
        if (data) {
          notes.push({
            noteType: field.toUpperCase(),
            data,
          });
        }
      }

      return notes;
    } catch (error) {
      console.error("Error getting notes for folder:", error);
      throw new Error("Failed to get notes for folder");
    }
  }
}

export const notesService = new NotesService();
