// src/services/note1-generator.service.ts
import { Folder, Client } from "@prisma/client";

type FolderWithRelations = Folder & {
  client: Client;
};

interface AccountMapping {
  accountNumber: string;
  source: string;
  destination: string;
  libelle?: string;
}

interface DSFConfig {
  category: string;
  accountMappings: AccountMapping[];
}

interface BalanceData {
  rows: Array<{
    accountNumber: string;
    openingDebit?: number;
    openingCredit?: number;
    movementDebit?: number;
    movementCredit?: number;
    closingDebit?: number;
    closingCredit?: number;
  }>;
}

interface BalanceDataN1 extends BalanceData {}

interface DebtItem {
  libelle: string;
  note?: string;
  montantBrut: number;
  hypotheques: number;
  nantissements: number;
  gagesAutres: number;
}

interface FinancialCommitment {
  libelle: string;
  engagementsDonnes: number;
  engagementsRecus: number;
}

interface Note1Data {
  header: {
    raisonSociale: string;
    numeroIdentification: string;
    exerciceClos: string;
    duree: number;
  };
  dettes: {
    dettesFinancieres: DebtItem[];
    dettesLocationAcquisition: DebtItem[];
    dettesPassifCirculant: DebtItem[];
    sousTotaux: {
      dettesFinancieres: DebtItem;
      dettesLocationAcquisition: DebtItem;
      dettesPassifCirculant: DebtItem;
      total: DebtItem;
    };
  };
  engagementsFinanciers: FinancialCommitment[];
  totalEngagements: FinancialCommitment;
}

export class Note1Generator {
  /**
   * Generate Note 1 data from DSF config and balance, or from imported DSF data
   */
  async generateNote1(
    folder: FolderWithRelations,
    balanceData?: BalanceData,
    balanceDataN1?: BalanceDataN1,
    dsfConfig?: DSFConfig,
    importedDSFData?: any
  ): Promise<Note1Data> {
    const accountMappings = dsfConfig?.accountMappings || [];

    // Generate header information
    const header = this.generateHeader(folder);

    // Generate debts table data - use imported DSF data if available
    const dettes = importedDSFData
      ? this.generateDebtsTableFromImportedData(importedDSFData)
      : this.generateDebtsTable(balanceData || { rows: [] }, accountMappings);

    // Generate financial commitments table data
    const engagementsFinanciers =
      this.generateEngagementsFinanciers(accountMappings);
    const totalEngagements = this.calculateTotalEngagements(
      engagementsFinanciers
    );

    return {
      header,
      dettes,
      engagementsFinanciers,
      totalEngagements,
    };
  }

  /**
   * Generate header information
   */
  private generateHeader(folder: FolderWithRelations) {
    return {
      raisonSociale: folder.client.name,
      numeroIdentification: folder.client.taxNumber || "",
      exerciceClos: folder.endDate
        ? new Date(folder.endDate).getFullYear().toString()
        : "",
      duree: this.calculateExerciseDuration(folder.startDate, folder.endDate),
    };
  }

  /**
   * Generate debts table data from imported DSF data
   */
  private generateDebtsTableFromImportedData(importedData: any) {
    // Default debt categories structure
    const defaultDettesFinancieres = [
      {
        libelle: "Emprunts obligataires convertibles",
        note: "",
        montantBrut: importedData.dettesFinancieres || 0,
        hypotheques: 0,
        nantissements: 0,
        gagesAutres: 0,
      },
      {
        libelle: "Autres emprunts obligataires",
        note: "",
        montantBrut: 0,
        hypotheques: 0,
        nantissements: 0,
        gagesAutres: 0,
      },
      {
        libelle: "Emprunts et dettes des établissements de crédit",
        note: "",
        montantBrut: 0,
        hypotheques: 0,
        nantissements: 0,
        gagesAutres: 0,
      },
      {
        libelle: "Autres dettes financières",
        note: "",
        montantBrut: 0,
        hypotheques: 0,
        nantissements: 0,
        gagesAutres: 0,
      },
    ];

    const defaultDettesLocationAcquisition = [
      {
        libelle: "Dettes de crédit-bail immobilier",
        note: "",
        montantBrut: importedData.dettesLocationAcquisition || 0,
        hypotheques: 0,
        nantissements: 0,
        gagesAutres: 0,
      },
      {
        libelle: "Dettes de crédit-bail mobilier",
        note: "",
        montantBrut: 0,
        hypotheques: 0,
        nantissements: 0,
        gagesAutres: 0,
      },
      {
        libelle: "Dettes sur contrats de location-vente",
        note: "",
        montantBrut: 0,
        hypotheques: 0,
        nantissements: 0,
        gagesAutres: 0,
      },
      {
        libelle: "Dettes sur contrats de location-acquisition",
        note: "",
        montantBrut: 0,
        hypotheques: 0,
        nantissements: 0,
        gagesAutres: 0,
      },
    ];

    const defaultDettesPassifCirculant = [
      {
        libelle: "Fournisseurs et comptes rattachés",
        note: "",
        montantBrut: importedData.dettesPassifCirculant || 0,
        hypotheques: 0,
        nantissements: 0,
        gagesAutres: 0,
      },
      {
        libelle: "Clients",
        note: "",
        montantBrut: 0,
        hypotheques: 0,
        nantissements: 0,
        gagesAutres: 0,
      },
      {
        libelle: "Personnel",
        note: "",
        montantBrut: 0,
        hypotheques: 0,
        nantissements: 0,
        gagesAutres: 0,
      },
      {
        libelle: "Sécurité sociale et organismes sociaux",
        note: "",
        montantBrut: 0,
        hypotheques: 0,
        nantissements: 0,
        gagesAutres: 0,
      },
      {
        libelle: "État",
        note: "",
        montantBrut: 0,
        hypotheques: 0,
        nantissements: 0,
        gagesAutres: 0,
      },
      {
        libelle: "Organismes internationaux",
        note: "",
        montantBrut: 0,
        hypotheques: 0,
        nantissements: 0,
        gagesAutres: 0,
      },
      {
        libelle: "Associés et groupe",
        note: "",
        montantBrut: 0,
        hypotheques: 0,
        nantissements: 0,
        gagesAutres: 0,
      },
      {
        libelle: "Créditeurs divers",
        note: "",
        montantBrut: 0,
        hypotheques: 0,
        nantissements: 0,
        gagesAutres: 0,
      },
    ];

    // Calculate subtotals
    const sousTotalDettesFinancieres = this.calculateDebtSubtotal(
      defaultDettesFinancieres
    );
    const sousTotalDettesLocationAcquisition = this.calculateDebtSubtotal(
      defaultDettesLocationAcquisition
    );
    const sousTotalDettesPassifCirculant = this.calculateDebtSubtotal(
      defaultDettesPassifCirculant
    );
    const total = this.calculateDebtTotal([
      sousTotalDettesFinancieres,
      sousTotalDettesLocationAcquisition,
      sousTotalDettesPassifCirculant,
    ]);

    return {
      dettesFinancieres: defaultDettesFinancieres,
      dettesLocationAcquisition: defaultDettesLocationAcquisition,
      dettesPassifCirculant: defaultDettesPassifCirculant,
      sousTotaux: {
        dettesFinancieres: sousTotalDettesFinancieres,
        dettesLocationAcquisition: sousTotalDettesLocationAcquisition,
        dettesPassifCirculant: sousTotalDettesPassifCirculant,
        total,
      },
    };
  }

  /**
   * Generate debts table data
   */
  private generateDebtsTable(
    balanceData: BalanceData,
    accountMappings: AccountMapping[]
  ) {
    // Default debt categories structure
    const defaultDettesFinancieres = [
      {
        libelle: "Emprunts obligataires convertibles",
        note: "",
        montantBrut: 0,
        hypotheques: 0,
        nantissements: 0,
        gagesAutres: 0,
      },
      {
        libelle: "Autres emprunts obligataires",
        note: "",
        montantBrut: 0,
        hypotheques: 0,
        nantissements: 0,
        gagesAutres: 0,
      },
      {
        libelle: "Emprunts et dettes des établissements de crédit",
        note: "",
        montantBrut: 0,
        hypotheques: 0,
        nantissements: 0,
        gagesAutres: 0,
      },
      {
        libelle: "Autres dettes financières",
        note: "",
        montantBrut: 0,
        hypotheques: 0,
        nantissements: 0,
        gagesAutres: 0,
      },
    ];

    const defaultDettesLocationAcquisition = [
      {
        libelle: "Dettes de crédit-bail immobilier",
        note: "",
        montantBrut: 0,
        hypotheques: 0,
        nantissements: 0,
        gagesAutres: 0,
      },
      {
        libelle: "Dettes de crédit-bail mobilier",
        note: "",
        montantBrut: 0,
        hypotheques: 0,
        nantissements: 0,
        gagesAutres: 0,
      },
      {
        libelle: "Dettes sur contrats de location-vente",
        note: "",
        montantBrut: 0,
        hypotheques: 0,
        nantissements: 0,
        gagesAutres: 0,
      },
      {
        libelle: "Dettes sur contrats de location-acquisition",
        note: "",
        montantBrut: 0,
        hypotheques: 0,
        nantissements: 0,
        gagesAutres: 0,
      },
    ];

    const defaultDettesPassifCirculant = [
      {
        libelle: "Fournisseurs et comptes rattachés",
        note: "",
        montantBrut: 0,
        hypotheques: 0,
        nantissements: 0,
        gagesAutres: 0,
      },
      {
        libelle: "Clients",
        note: "",
        montantBrut: 0,
        hypotheques: 0,
        nantissements: 0,
        gagesAutres: 0,
      },
      {
        libelle: "Personnel",
        note: "",
        montantBrut: 0,
        hypotheques: 0,
        nantissements: 0,
        gagesAutres: 0,
      },
      {
        libelle: "Sécurité sociale et organismes sociaux",
        note: "",
        montantBrut: 0,
        hypotheques: 0,
        nantissements: 0,
        gagesAutres: 0,
      },
      {
        libelle: "État",
        note: "",
        montantBrut: 0,
        hypotheques: 0,
        nantissements: 0,
        gagesAutres: 0,
      },
      {
        libelle: "Organismes internationaux",
        note: "",
        montantBrut: 0,
        hypotheques: 0,
        nantissements: 0,
        gagesAutres: 0,
      },
      {
        libelle: "Associés et groupe",
        note: "",
        montantBrut: 0,
        hypotheques: 0,
        nantissements: 0,
        gagesAutres: 0,
      },
      {
        libelle: "Créditeurs divers",
        note: "",
        montantBrut: 0,
        hypotheques: 0,
        nantissements: 0,
        gagesAutres: 0,
      },
    ];

    // Apply account mappings to populate the debt items
    const dettesFinancieres = this.applyMappingsToDebtItems(
      defaultDettesFinancieres,
      accountMappings,
      balanceData,
      "dettesFinancieres"
    );
    const dettesLocationAcquisition = this.applyMappingsToDebtItems(
      defaultDettesLocationAcquisition,
      accountMappings,
      balanceData,
      "dettesLocationAcquisition"
    );
    const dettesPassifCirculant = this.applyMappingsToDebtItems(
      defaultDettesPassifCirculant,
      accountMappings,
      balanceData,
      "dettesPassifCirculant"
    );

    // Calculate subtotals
    const sousTotalDettesFinancieres =
      this.calculateDebtSubtotal(dettesFinancieres);
    const sousTotalDettesLocationAcquisition = this.calculateDebtSubtotal(
      dettesLocationAcquisition
    );
    const sousTotalDettesPassifCirculant = this.calculateDebtSubtotal(
      dettesPassifCirculant
    );
    const total = this.calculateDebtTotal([
      sousTotalDettesFinancieres,
      sousTotalDettesLocationAcquisition,
      sousTotalDettesPassifCirculant,
    ]);

    return {
      dettesFinancieres,
      dettesLocationAcquisition,
      dettesPassifCirculant,
      sousTotaux: {
        dettesFinancieres: sousTotalDettesFinancieres,
        dettesLocationAcquisition: sousTotalDettesLocationAcquisition,
        dettesPassifCirculant: sousTotalDettesPassifCirculant,
        total,
      },
    };
  }

  /**
   * Apply account mappings to debt items
   */
  private applyMappingsToDebtItems(
    debtItems: DebtItem[],
    accountMappings: AccountMapping[],
    balanceData: BalanceData,
    categoryPrefix: string
  ): DebtItem[] {
    return debtItems.map((item) => {
      const updatedItem = { ...item };

      // Find mappings for this debt item
      const montantBrutMapping = accountMappings.find(
        (mapping) =>
          mapping.destination ===
          `${categoryPrefix}.${item.libelle}.montantBrut`
      );
      const hypothequesMapping = accountMappings.find(
        (mapping) =>
          mapping.destination ===
          `${categoryPrefix}.${item.libelle}.hypotheques`
      );
      const nantissementsMapping = accountMappings.find(
        (mapping) =>
          mapping.destination ===
          `${categoryPrefix}.${item.libelle}.nantissements`
      );
      const gagesAutresMapping = accountMappings.find(
        (mapping) =>
          mapping.destination ===
          `${categoryPrefix}.${item.libelle}.gagesAutres`
      );

      // Apply values from balance data
      if (montantBrutMapping) {
        updatedItem.montantBrut = this.getBalanceValue(
          balanceData,
          montantBrutMapping.accountNumber,
          montantBrutMapping.source
        );
      }
      if (hypothequesMapping) {
        updatedItem.hypotheques = this.getBalanceValue(
          balanceData,
          hypothequesMapping.accountNumber,
          hypothequesMapping.source
        );
      }
      if (nantissementsMapping) {
        updatedItem.nantissements = this.getBalanceValue(
          balanceData,
          nantissementsMapping.accountNumber,
          nantissementsMapping.source
        );
      }
      if (gagesAutresMapping) {
        updatedItem.gagesAutres = this.getBalanceValue(
          balanceData,
          gagesAutresMapping.accountNumber,
          gagesAutresMapping.source
        );
      }

      return updatedItem;
    });
  }

  /**
   * Calculate subtotal for a debt category
   */
  private calculateDebtSubtotal(debtItems: DebtItem[]): DebtItem {
    return debtItems.reduce(
      (total, item) => ({
        libelle: "SOUS TOTAL",
        note: "",
        montantBrut: total.montantBrut + item.montantBrut,
        hypotheques: total.hypotheques + item.hypotheques,
        nantissements: total.nantissements + item.nantissements,
        gagesAutres: total.gagesAutres + item.gagesAutres,
      }),
      {
        libelle: "SOUS TOTAL",
        note: "",
        montantBrut: 0,
        hypotheques: 0,
        nantissements: 0,
        gagesAutres: 0,
      }
    );
  }

  /**
   * Calculate total for all debt categories
   */
  private calculateDebtTotal(subtotals: DebtItem[]): DebtItem {
    return subtotals.reduce(
      (total, subtotal) => ({
        libelle: "TOTAL",
        note: "",
        montantBrut: total.montantBrut + subtotal.montantBrut,
        hypotheques: total.hypotheques + subtotal.hypotheques,
        nantissements: total.nantissements + subtotal.nantissements,
        gagesAutres: total.gagesAutres + subtotal.gagesAutres,
      }),
      {
        libelle: "TOTAL",
        note: "",
        montantBrut: 0,
        hypotheques: 0,
        nantissements: 0,
        gagesAutres: 0,
      }
    );
  }

  /**
   * Generate financial commitments table data
   */
  private generateEngagementsFinanciers(
    accountMappings: AccountMapping[]
  ): FinancialCommitment[] {
    const defaultEngagements = [
      {
        libelle: "Engagements consentis à des entités liées",
        engagementsDonnes: 0,
        engagementsRecus: 0,
      },
      {
        libelle: "Primes de remboursement non échues",
        engagementsDonnes: 0,
        engagementsRecus: 0,
      },
      {
        libelle: "Avals, cautions, garanties",
        engagementsDonnes: 0,
        engagementsRecus: 0,
      },
      {
        libelle: "Hypothèques, nantissements, gages, autres",
        engagementsDonnes: 0,
        engagementsRecus: 0,
      },
      {
        libelle: "Effets escomptés non échus",
        engagementsDonnes: 0,
        engagementsRecus: 0,
      },
      {
        libelle: "Créances commerciales et professionnelles cédées",
        engagementsDonnes: 0,
        engagementsRecus: 0,
      },
      {
        libelle: "Abandons de créances conditionnels",
        engagementsDonnes: 0,
        engagementsRecus: 0,
      },
    ];

    // Apply mappings (this would be expanded based on actual mapping destinations)
    return defaultEngagements;
  }

  /**
   * Calculate total financial commitments
   */
  private calculateTotalEngagements(
    engagements: FinancialCommitment[]
  ): FinancialCommitment {
    return engagements.reduce(
      (total, item) => ({
        libelle: "TOTAL",
        engagementsDonnes: total.engagementsDonnes + item.engagementsDonnes,
        engagementsRecus: total.engagementsRecus + item.engagementsRecus,
      }),
      {
        libelle: "TOTAL",
        engagementsDonnes: 0,
        engagementsRecus: 0,
      }
    );
  }

  /**
   * Get balance value based on account number and source
   */
  private getBalanceValue(
    balanceData: BalanceData,
    accountNumber: string,
    source: string
  ): number {
    const account = balanceData.rows.find(
      (row) => String(row.accountNumber) === accountNumber
    );
    if (!account) return 0;

    switch (source) {
      case "OD":
        return parseFloat(account.openingDebit?.toString() || "0");
      case "OC":
        return parseFloat(account.openingCredit?.toString() || "0");
      case "MD":
        return parseFloat(account.movementDebit?.toString() || "0");
      case "MC":
        return parseFloat(account.movementCredit?.toString() || "0");
      case "SD":
        return parseFloat(account.closingDebit?.toString() || "0");
      case "SC":
        return parseFloat(account.closingCredit?.toString() || "0");
      case "MCD":
        return (
          parseFloat(account.movementDebit?.toString() || "0") -
          parseFloat(account.movementCredit?.toString() || "0")
        );
      case "SCD":
        return (
          parseFloat(account.closingDebit?.toString() || "0") -
          parseFloat(account.closingCredit?.toString() || "0")
        );
      default:
        return 0;
    }
  }

  /**
   * Calculate exercise duration in months
   */
  private calculateExerciseDuration(
    startDate: Date | null,
    endDate: Date | null
  ): number {
    if (!startDate || !endDate) return 12;

    const diff = new Date(endDate).getTime() - new Date(startDate).getTime();
    return Math.ceil(diff / (1000 * 60 * 60 * 24 * 30));
  }

  /**
   * Export Note 1 data to Excel format
   */
  async exportToExcel(note1Data: Note1Data): Promise<any> {
    // This would implement Excel export functionality
    // For now, return the data structure that can be used by Excel service
    return note1Data;
  }
}
