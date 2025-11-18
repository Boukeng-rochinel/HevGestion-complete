// src/utils/file-manager.ts
import * as fs from 'fs/promises';
import * as path from 'path';
import { config } from '../config';

export class FileManager {
  private uploadDir = config.upload.directory;

  async ensureUploadDirectory(): Promise<void> {
    try {
      await fs.access(this.uploadDir);
    } catch {
      await fs.mkdir(this.uploadDir, { recursive: true });
    }
  }

  async deleteFile(filePath: string): Promise<void> {
    try {
      await fs.unlink(filePath);
    } catch (error) {
      console.error('Error deleting file:', error);
    }
  }

  async getFileStats(filePath: string) {
    return await fs.stat(filePath);
  }

  async fileExists(filePath: string): Promise<boolean> {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  getFileExtension(filename: string): string {
    return path.extname(filename).toLowerCase();
  }

  generateUniqueFilename(originalFilename: string): string {
    const ext = path.extname(originalFilename);
    const basename = path.basename(originalFilename, ext);
    const timestamp = Date.now();
    const random = Math.floor(Math.random() * 10000);
    return `${basename}-${timestamp}-${random}${ext}`;
  }
}