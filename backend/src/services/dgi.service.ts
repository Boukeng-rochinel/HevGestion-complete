// src/services/dgi.service.ts
import axios, { AxiosInstance } from "axios";
import crypto from "crypto";
import { config } from "../config";
import { TaxDeclaration, Folder, Client, DSF } from "@prisma/client";

interface DGISubmissionResult {
  success: boolean;
  dsfId?: string;
  amountDue?: number;
  message: string;
  errors?: any[];
}

interface DGIStatusResponse {
  status: string;
  declarationId: string;
  submittedAt?: Date;
  processedAt?: Date;
  amountDue?: number;
  paymentStatus?: string;
}

interface DGICreateProcessResponse {
  id: string;
  action: string;
  status: string;
}

interface DGIDeleteProcessResponse {
  action: string;
  status: string;
}

interface DGIGetProcessesResponse {
  total: number;
  records: any[];
}

interface DGILoginResponse {
  token: string;
  statusCode: number;
}

type DeclarationWithRelations = TaxDeclaration & {
  folder: Folder & {
    client: Client;
    dsf: DSF | null;
  };
};

export class DGIService {
  private client: AxiosInstance;

  constructor() {
    this.client = axios.create({
      baseURL: config.dgi.apiUrl,
      timeout: config.dgi.timeout,
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
    });
  }

  async encryptPassword(password: string): Promise<string> {
    const algorithm = config.encryption.algorithm;
    const key = Buffer.from(config.encryption.key);
    const iv = crypto.randomBytes(16);

    const cipher = crypto.createCipheriv(algorithm, key, iv);
    let encrypted = cipher.update(password, "utf8", "hex");
    encrypted += cipher.final("hex");

    const authTag = (cipher as any).getAuthTag();

    return JSON.stringify({
      iv: iv.toString("hex"),
      encryptedData: encrypted,
      authTag: authTag.toString("hex"),
    });
  }

  async decryptPassword(encryptedPassword: string): Promise<string> {
    const { iv, encryptedData, authTag } = JSON.parse(encryptedPassword);
    const algorithm = config.encryption.algorithm;
    const key = Buffer.from(config.encryption.key);

    const decipher = crypto.createDecipheriv(
      algorithm,
      key,
      Buffer.from(iv, "hex")
    );

    (decipher as any).setAuthTag(Buffer.from(authTag, "hex"));

    let decrypted = decipher.update(encryptedData, "hex", "utf8");
    decrypted += decipher.final("utf8");

    return decrypted;
  }

  async submitDeclaration(
    declaration: DeclarationWithRelations
  ): Promise<DGISubmissionResult> {
    try {
      // Decrypt API password
      const apiPassword = await this.decryptPassword(declaration.apiPassword!);

      // Authenticate with DGI using username (niuNumber) and password
      const authToken = await this.authenticateWithDGI(
        declaration.niuNumber!,
        apiPassword
      );

      // Prepare DSF data
      const dsfData = this.prepareDSFData(declaration);

      // Submit to DGI
      const response = await this.client.post(
        "/api/v1/declarations/dsf",
        dsfData,
        {
          headers: {
            Authorization: `Bearer ${authToken}`,
          },
        }
      );

      return {
        success: true,
        dsfId: response.data.declarationId,
        amountDue: response.data.amountDue,
        message: "Declaration submitted successfully",
      };
    } catch (error: any) {
      console.error("DGI submission error:", error);

      return {
        success: false,
        message: error.response?.data?.message || "Submission failed",
        errors: error.response?.data?.errors || [],
      };
    }
  }

  async checkDeclarationStatus(
    dsfId: string,
    niuNumber: string
  ): Promise<DGIStatusResponse> {
    try {
      const response = await this.client.get(
        `/api/v1/declarations/${dsfId}/status`,
        {
          params: { niu: niuNumber },
        }
      );

      return {
        status: response.data.status,
        declarationId: response.data.declarationId,
        submittedAt: response.data.submittedAt,
        processedAt: response.data.processedAt,
        amountDue: response.data.amountDue,
        paymentStatus: response.data.paymentStatus,
      };
    } catch (error: any) {
      console.error("DGI status check error:", error);
      throw new Error("Failed to check declaration status");
    }
  }

  async createProcess(
    declarationYear: string,
    declarationType: string,
    authToken: string
  ): Promise<DGICreateProcessResponse> {
    try {
      const response = await this.client.post(
        `/api/v1/process/${declarationYear}/${declarationType}`,
        {},
        {
          headers: {
            Authorization: `Bearer ${authToken}`,
          },
        }
      );

      return {
        id: response.data.id,
        action: response.data.action,
        status: response.data.status,
      };
    } catch (error: any) {
      console.error("DGI create process error:", error);

      // Handle specific errors
      if (error.response?.status === 409) {
        throw new Error("RESOURCE_ALREADY_EXISTS_CONFLICT");
      }
      if (error.response?.status === 415) {
        throw new Error("UNSUPPORTED_DECLARATION_TYPE");
      }

      throw new Error("Failed to create declaration process");
    }
  }

  async deleteProcess(
    processId: string,
    authToken: string
  ): Promise<DGIDeleteProcessResponse> {
    try {
      const response = await this.client.delete(`/api/v1/process`, {
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
        data: { id: processId },
      });

      return {
        action: response.data.action,
        status: response.data.status,
      };
    } catch (error: any) {
      console.error("DGI delete process error:", error);

      // Handle specific errors
      if (error.response?.status === 404) {
        throw new Error("RESOURCE_NOT_FOUND");
      }

      throw new Error("Failed to delete declaration process");
    }
  }

  async getProcesses(authToken: string): Promise<DGIGetProcessesResponse> {
    try {
      const response = await this.client.get(`/api/v1/process`, {
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
      });

      return {
        total: response.data.total,
        records: response.data.records,
      };
    } catch (error: any) {
      console.error("DGI get processes error:", error);
      throw new Error("Failed to get declaration processes");
    }
  }

  async getProcessesByYear(
    declarationYear: string,
    authToken: string
  ): Promise<DGIGetProcessesResponse> {
    try {
      const response = await this.client.get(
        `/api/v1/process/${declarationYear}`,
        {
          headers: {
            Authorization: `Bearer ${authToken}`,
          },
        }
      );

      return {
        total: response.data.total,
        records: response.data.records,
      };
    } catch (error: any) {
      console.error("DGI get processes by year error:", error);
      throw new Error("Failed to get declaration processes for year");
    }
  }

  async login(username: string, password: string): Promise<DGILoginResponse> {
    try {
      const response = await this.client.post("/api/v1/auth", {
        username,
        password,
      });

      return {
        token: response.data.token,
        statusCode: response.data.statusCode,
      };
    } catch (error: any) {
      console.error("DGI login error:", error);

      // Handle specific errors
      if (error.response?.status === 401) {
        throw new Error("UNAUTHORIZED");
      }

      throw new Error("Failed to authenticate with DGI");
    }
  }

  async authenticateWithDGI(
    niuNumber: string,
    password: string
  ): Promise<string> {
    try {
      const response = await this.client.post("/api/v1/auth", {
        username: niuNumber,
        password,
      });

      return response.data.token;
    } catch (error: any) {
      console.error("DGI authentication error:", error);
      throw new Error("Failed to authenticate with DGI");
    }
  }

  private prepareDSFData(declaration: DeclarationWithRelations): any {
    const dsf = declaration.folder.dsf!;
    const company = declaration.folder.client;

    return {
      // Company information
      entreprise: {
        niu: company.taxNumber || declaration.niuNumber, // Use company tax number as NIU
        raisonSociale: company.name,
        formeJuridique: company.legalForm,
        numeroContribuable: company.taxNumber,
        adresse: company.address,
        ville: company.city,
        telephone: company.phone,
      },
      // Exercise information
      exercice: {
        dateDebut: declaration.folder.startDate,
        dateFin: declaration.folder.endDate,
        duree: this.calculateMonths(
          declaration.folder.startDate,
          declaration.folder.endDate
        ),
      },
      // Financial data
      bilan: dsf.balanceSheet,
      compteResultat: dsf.incomeStatement,
      tableauxFiscaux: dsf.taxTables,
      notes: dsf.notes,
      fiches: dsf.signaletics,
    };
  }

  private calculateMonths(startDate: Date, endDate: Date): number {
    const start = new Date(startDate);
    const end = new Date(endDate);
    return (
      (end.getFullYear() - start.getFullYear()) * 12 +
      (end.getMonth() - start.getMonth())
    );
  }

  async submitNote1(
    declarationId: string,
    note1Data: any,
    authToken: string
  ): Promise<{ success: boolean; message: string }> {
    try {
      const response = await this.client.put(
        `/api/v1/process/${declarationId}/note1`,
        note1Data,
        {
          headers: {
            Authorization: `Bearer ${authToken}`,
          },
        }
      );

      return {
        success: true,
        message: response.data.action || "Note1 submitted successfully",
      };
    } catch (error: any) {
      console.error("DGI Note1 submission error:", error);

      return {
        success: false,
        message: error.response?.data?.message || "Note1 submission failed",
      };
    }
  }

  async updateNote1(
    declarationId: string,
    note1Data: any,
    authToken: string
  ): Promise<{ success: boolean; message: string }> {
    try {
      const response = await this.client.patch(
        `/api/v1/process/${declarationId}/note1`,
        note1Data,
        {
          headers: {
            Authorization: `Bearer ${authToken}`,
          },
        }
      );

      return {
        success: true,
        message: response.data.action || "Note1 updated successfully",
      };
    } catch (error: any) {
      console.error("DGI Note1 update error:", error);

      return {
        success: false,
        message: error.response?.data?.message || "Note1 update failed",
      };
    }
  }

  async deleteNote1(
    declarationId: string,
    authToken: string
  ): Promise<{ success: boolean; message: string }> {
    try {
      const response = await this.client.delete(
        `/api/v1/process/${declarationId}/note1`,
        {
          headers: {
            Authorization: `Bearer ${authToken}`,
          },
        }
      );

      return {
        success: true,
        message: response.data.action || "Note1 deleted successfully",
      };
    } catch (error: any) {
      console.error("DGI Note1 delete error:", error);

      return {
        success: false,
        message: error.response?.data?.message || "Note1 delete failed",
      };
    }
  }

  async submitEtatsFinanciers(
    declarationId: string,
    etatsFinanciersData: any,
    authToken: string
  ): Promise<{ success: boolean; message: string; action?: string }> {
    try {
      const response = await this.client.put(
        `/api/v1/process/${declarationId}/etatsFinanciers`,
        etatsFinanciersData,
        {
          headers: {
            Authorization: `Bearer ${authToken}`,
          },
        }
      );

      return {
        success: true,
        message:
          response.data.status || "Etats financiers submitted successfully",
        action: response.data.action,
      };
    } catch (error: any) {
      console.error("DGI Etats Financiers submission error:", error);

      return {
        success: false,
        message:
          error.response?.data?.message || "Etats financiers submission failed",
        action: error.response?.data?.action,
      };
    }
  }

  async updateEtatsFinanciers(
    declarationId: string,
    etatsFinanciersData: any,
    authToken: string
  ): Promise<{ success: boolean; message: string; action?: string }> {
    try {
      const response = await this.client.patch(
        `/api/v1/process/${declarationId}/etatsFinanciers`,
        etatsFinanciersData,
        {
          headers: {
            Authorization: `Bearer ${authToken}`,
          },
        }
      );

      return {
        success: true,
        message:
          response.data.status || "Etats financiers updated successfully",
        action: response.data.action,
      };
    } catch (error: any) {
      console.error("DGI Etats Financiers update error:", error);

      return {
        success: false,
        message:
          error.response?.data?.message || "Etats financiers update failed",
        action: error.response?.data?.action,
      };
    }
  }

  async deleteEtatsFinanciers(
    declarationId: string,
    authToken: string
  ): Promise<{ success: boolean; message: string; action?: string }> {
    try {
      const response = await this.client.delete(
        `/api/v1/process/${declarationId}/etatsFinanciers`,
        {
          headers: {
            Authorization: `Bearer ${authToken}`,
          },
        }
      );

      return {
        success: true,
        message:
          response.data.status || "Etats financiers deleted successfully",
        action: response.data.action,
      };
    } catch (error: any) {
      console.error("DGI Etats Financiers delete error:", error);

      return {
        success: false,
        message:
          error.response?.data?.message || "Etats financiers delete failed",
        action: error.response?.data?.action,
      };
    }
  }

  prepareEtatsFinanciersData(declaration: DeclarationWithRelations): any {
    const dsf = declaration.folder.dsf;
    const company = declaration.folder.client;

    return {
      republique: "REPUBLIQUE DU CAMEROUN",
      ministere: "MINISTERE DES FINANCES",
      direction: "DIRECTION GENERALE DES IMPOTS",
      centreDeDepot: "CENTRE DES IMPOTS",
      exerClosLe: declaration.folder.endDate.toISOString().split("T")[0],
      denomSoc: company.name,
      siglUsuel: company.name.substring(0, 10).toUpperCase(),
      addrComp: company.address || "",
      numIdentFiscal: company.taxNumber || declaration.niuNumber,
      ficDide: true,
      bilan: true,
      comptRes: true,
      tabDesFluxTreso: false,
      notAnnex: true,
      nombreDePages: "10",
      nombreDexamplaire: "1",
      dateDepot: new Date().toISOString().split("T")[0],
      nomDeAgent: "AGENT COMPTABLE",
      signDeLagent: "SIGNATURE",
      // Add DSF data
      dsfData: dsf
        ? {
            balanceSheet: dsf.balanceSheet,
            incomeStatement: dsf.incomeStatement,
            taxTables: dsf.taxTables,
            notes: dsf.notes,
            signaletics: dsf.signaletics,
            reports: (dsf as any).reports,
          }
        : null,
    };
  }

  // Mock method for testing when DGI API is not available
  async mockSubmitDeclaration(
    declaration: DeclarationWithRelations
  ): Promise<DGISubmissionResult> {
    console.log("Mock DGI submission for:", declaration.folder.client.name);

    // Simulate API delay
    await new Promise((resolve) => setTimeout(resolve, 2000));

    return {
      success: true,
      dsfId: `DSF${Date.now()}`,
      amountDue: Math.random() * 10000000,
      message: "Mock declaration submitted successfully",
    };
  }
}
