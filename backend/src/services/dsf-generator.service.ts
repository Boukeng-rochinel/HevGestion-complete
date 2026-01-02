// src/services/dsf-generator.service.ts
import { DSF, Folder, Balance, Client } from "@prisma/client";
import * as XLSX from "xlsx";
import * as path from "path";
import { config } from "../config";

interface DSFData {
  taxTables: any;
  notes: any;
  signaletics: any;
  note1: any;
  note2: any;
  note3: any;
  note4: any;
  note5: any;
  note6: any;
  note7: any;
  note8: any;
  note9: any;
  note10: any;
  note11: any;
  note12: any;
  note13: any;
  note14: any;
  note15: any;
  note16: any;
  note17: any;
  note18: any;
  note19: any;
  note20: any;
  note21: any;
  note22: any;
  note23: any;
  note24: any;
  note25: any;
  note26: any;
  note27: any;
  note28: any;
  note29: any;
  note30: any;
  note31: any;
  note32: any;
  note33: any;
  fiche1: any;
  fiche2: any;
  fiche3: any;
  cter: any;
  cf1: any;
}

interface CoherenceResult {
  isCoherent: boolean;
  issues: any;
}

type FolderWithRelations = Folder & {
  client: Client & { clientType?: string };
  balances: (Balance & { fixedAssets?: any[]; equilibrium?: any })[];
};

export class DSFGenerator {
  async generate(folder: FolderWithRelations): Promise<any[]> {
    const nBalance = folder.balances.find((b) => b.type === "CURRENT_YEAR");
    const n1Balance = folder.balances.find((b) => b.type === "PREVIOUS_YEAR");

    if (!nBalance) {
      throw new Error("Current year balance is required");
    }

    const nData = nBalance.originalData as any;
    const n1Data = n1Balance?.originalData as any;

    const reports: any[] = [];

    // Generate all reports and add them to the array
    reports.push({
      type: "BALANCE_SHEET",
      data: this.generateBalanceSheet(nData, n1Data),
    });

    reports.push({
      type: "INCOME_STATEMENT",
      data: this.generateIncomeStatement(nData, n1Data),
    });

    reports.push({
      type: "TAX_TABLES",
      data: this.generateTaxTables(nData, n1Data, folder),
    });

    reports.push({
      type: "NOTES",
      data: await this.generateAllNotes(nData, n1Data, nBalance, folder),
    });

    reports.push({
      type: "SIGNALETICS",
      data: this.generateSignaletics(folder),
    });

    return reports;
  }

  private generateBalanceSheet(nData: any, n1Data: any): any {
    const n = nData.rows || [];
    const n1 = n1Data?.rows || [];

    return {
      assets: {
        immobilisations: {
          chargesImmobilisees: {
            brut: this.sumAccounts(n, ["201", "202", "203"]),
            amortissements: this.sumAccounts(n, ["2801", "2802", "2803"]),
            net: this.calculateNet(
              n,
              ["201", "202", "203"],
              ["2801", "2802", "2803"]
            ),
            netN1: this.calculateNet(
              n1,
              ["201", "202", "203"],
              ["2801", "2802", "2803"]
            ),
          },
          immobilisationsIncorporelles: {
            brut: this.sumAccounts(n, ["211", "212", "213", "214", "215"]),
            amortissements: this.sumAccounts(n, [
              "2811",
              "2812",
              "2813",
              "2814",
              "2815",
            ]),
            net: this.calculateNet(
              n,
              ["211", "212", "213", "214", "215"],
              ["2811", "2812", "2813", "2814", "2815"]
            ),
            netN1: this.calculateNet(
              n1,
              ["211", "212", "213", "214", "215"],
              ["2811", "2812", "2813", "2814", "2815"]
            ),
          },
          immobilisationsCorporelles: {
            terrains: {
              brut: this.sumAccounts(n, ["221", "222"]),
              amortissements: 0,
              net: this.sumAccounts(n, ["221", "222"]),
              netN1: this.sumAccounts(n1, ["221", "222"]),
            },
            batiments: {
              brut: this.sumAccounts(n, ["231", "232", "233", "234", "235"]),
              amortissements: this.sumAccounts(n, [
                "2831",
                "2832",
                "2833",
                "2834",
                "2835",
              ]),
              net: this.calculateNet(
                n,
                ["231", "232", "233", "234", "235"],
                ["2831", "2832", "2833", "2834", "2835"]
              ),
              netN1: this.calculateNet(
                n1,
                ["231", "232", "233", "234", "235"],
                ["2831", "2832", "2833", "2834", "2835"]
              ),
            },
            installationsEtAgencements: {
              brut: this.sumAccounts(n, ["241", "242", "243", "244", "245"]),
              amortissements: this.sumAccounts(n, [
                "2841",
                "2842",
                "2843",
                "2844",
                "2845",
              ]),
              net: this.calculateNet(
                n,
                ["241", "242", "243", "244", "245"],
                ["2841", "2842", "2843", "2844", "2845"]
              ),
              netN1: this.calculateNet(
                n1,
                ["241", "242", "243", "244", "245"],
                ["2841", "2842", "2843", "2844", "2845"]
              ),
            },
            materiel: {
              brut: this.sumAccounts(n, ["251", "252", "253", "254", "255"]),
              amortissements: this.sumAccounts(n, [
                "2851",
                "2852",
                "2853",
                "2854",
                "2855",
              ]),
              net: this.calculateNet(
                n,
                ["251", "252", "253", "254", "255"],
                ["2851", "2852", "2853", "2854", "2855"]
              ),
              netN1: this.calculateNet(
                n1,
                ["251", "252", "253", "254", "255"],
                ["2851", "2852", "2853", "2854", "2855"]
              ),
            },
          },
          immobilisationsFinancieres: {
            brut: this.sumAccounts(n, ["26", "27"]),
            provisions: this.sumAccounts(n, ["296", "297"]),
            net: this.calculateNet(n, ["26", "27"], ["296", "297"]),
            netN1: this.calculateNet(n1, ["26", "27"], ["296", "297"]),
          },
        },
        actifCirculant: {
          stocks: {
            brut: this.sumAccounts(n, [
              "31",
              "32",
              "33",
              "34",
              "35",
              "36",
              "37",
              "38",
            ]),
            provisions: this.sumAccounts(n, [
              "391",
              "392",
              "393",
              "394",
              "395",
              "396",
              "397",
              "398",
            ]),
            net: this.calculateNet(
              n,
              ["31", "32", "33", "34", "35", "36", "37", "38"],
              ["391", "392", "393", "394", "395", "396", "397", "398"]
            ),
            netN1: this.calculateNet(
              n1,
              ["31", "32", "33", "34", "35", "36", "37", "38"],
              ["391", "392", "393", "394", "395", "396", "397", "398"]
            ),
          },
          creances: {
            fournisseursAvances: {
              brut: this.sumAccounts(n, ["4091", "4092"]),
              provisions: this.sumAccounts(n, ["491", "492"]),
              net: this.calculateNet(n, ["4091", "4092"], ["491", "492"]),
              netN1: this.calculateNet(n1, ["4091", "4092"], ["491", "492"]),
            },
            clients: {
              brut: this.sumAccounts(n, ["411", "416"]),
              provisions: this.sumAccounts(n, ["491"]),
              net: this.calculateNet(n, ["411", "416"], ["491"]),
              netN1: this.calculateNet(n1, ["411", "416"], ["491"]),
            },
            autresCreances: {
              brut: this.sumAccounts(n, [
                "42",
                "43",
                "44",
                "45",
                "46",
                "47",
                "48",
              ]),
              provisions: this.sumAccounts(n, [
                "494",
                "495",
                "496",
                "497",
                "498",
              ]),
              net: this.calculateNet(
                n,
                ["42", "43", "44", "45", "46", "47", "48"],
                ["494", "495", "496", "497", "498"]
              ),
              netN1: this.calculateNet(
                n1,
                ["42", "43", "44", "45", "46", "47", "48"],
                ["494", "495", "496", "497", "498"]
              ),
            },
          },
          tresorerie: {
            brut: this.sumAccounts(n, [
              "50",
              "51",
              "52",
              "53",
              "54",
              "56",
              "57",
              "58",
            ]),
            provisions: 0,
            net: this.sumAccounts(n, [
              "50",
              "51",
              "52",
              "53",
              "54",
              "56",
              "57",
              "58",
            ]),
            netN1: this.sumAccounts(n1, [
              "50",
              "51",
              "52",
              "53",
              "54",
              "56",
              "57",
              "58",
            ]),
          },
        },
      },
      liabilities: {
        capitauxPropres: {
          capital: {
            n: this.getAccountBalance(n, "101"),
            n1: this.getAccountBalance(n1, "101"),
          },
          primes: {
            n: this.sumAccounts(n, ["1051", "1052", "1053", "1054"]),
            n1: this.sumAccounts(n1, ["1051", "1052", "1053", "1054"]),
          },
          reserves: {
            n: this.sumAccounts(n, ["106", "11"]),
            n1: this.sumAccounts(n1, ["106", "11"]),
          },
          reportANouveau: {
            n: this.getAccountBalance(n, "12"),
            n1: this.getAccountBalance(n1, "12"),
          },
          resultat: {
            n: this.getAccountBalance(n, "13"),
            n1: this.getAccountBalance(n1, "13"),
          },
          subventions: {
            n: this.sumAccounts(n, ["14"]),
            n1: this.sumAccounts(n1, ["14"]),
          },
          provisions: {
            n: this.sumAccounts(n, ["15"]),
            n1: this.sumAccounts(n1, ["15"]),
          },
        },
        dettesFinancieres: {
          emprunts: {
            n: this.sumAccounts(n, ["16", "17"]),
            n1: this.sumAccounts(n1, ["16", "17"]),
          },
          provisionsRisques: {
            n: this.sumAccounts(n, ["19"]),
            n1: this.sumAccounts(n1, ["19"]),
          },
        },
        passifCirculant: {
          fournisseurs: {
            n: this.sumAccounts(n, [
              "401",
              "402",
              "403",
              "404",
              "405",
              "406",
              "408",
            ]),
            n1: this.sumAccounts(n1, [
              "401",
              "402",
              "403",
              "404",
              "405",
              "406",
              "408",
            ]),
          },
          dettesFiscales: {
            n: this.sumAccounts(n, [
              "441",
              "442",
              "443",
              "444",
              "445",
              "446",
              "447",
            ]),
            n1: this.sumAccounts(n1, [
              "441",
              "442",
              "443",
              "444",
              "445",
              "446",
              "447",
            ]),
          },
          dettesSociales: {
            n: this.sumAccounts(n, ["42", "43"]),
            n1: this.sumAccounts(n1, ["42", "43"]),
          },
          autresDettes: {
            n: this.sumAccounts(n, ["46", "47", "48"]),
            n1: this.sumAccounts(n1, ["46", "47", "48"]),
          },
          tresoreriePassif: {
            n: this.sumAccounts(n, ["50", "56"]),
            n1: this.sumAccounts(n1, ["50", "56"]),
          },
        },
      },
    };
  }

  private generateIncomeStatement(nData: any, n1Data: any): any {
    const n = nData.rows || [];
    const n1 = n1Data?.rows || [];

    const produitsExploitation = this.sumAccounts(n, [
      "70",
      "71",
      "72",
      "73",
      "74",
      "75",
      "76",
      "77",
      "78",
    ]);
    const chargesExploitation = this.sumAccounts(n, [
      "60",
      "61",
      "62",
      "63",
      "64",
      "65",
      "66",
      "681",
      "691",
    ]);
    const resultatExploitation = produitsExploitation - chargesExploitation;

    const produitsFinanciers = this.sumAccounts(n, ["77"]);
    const chargesFinancieres = this.sumAccounts(n, ["67"]);
    const resultatFinancier = produitsFinanciers - chargesFinancieres;

    const produitsHAO = this.sumAccounts(n, [
      "81",
      "82",
      "84",
      "85",
      "86",
      "87",
      "88",
    ]);
    const chargesHAO = this.sumAccounts(n, ["83"]);
    const resultatHAO = produitsHAO - chargesHAO;

    const impotSurResultat = this.sumAccounts(n, ["89"]);
    const resultatNet =
      resultatExploitation + resultatFinancier + resultatHAO - impotSurResultat;

    return {
      exploitation: {
        ventes: {
          ventesMarchandises: {
            n: this.sumAccounts(n, ["701"]),
            n1: this.sumAccounts(n1, ["701"]),
          },
          ventesProduitsFinis: {
            n: this.sumAccounts(n, ["702", "703", "704"]),
            n1: this.sumAccounts(n1, ["702", "703", "704"]),
          },
          travauxServices: {
            n: this.sumAccounts(n, ["705", "706"]),
            n1: this.sumAccounts(n1, ["705", "706"]),
          },
          produitsAccessoires: {
            n: this.sumAccounts(n, ["707"]),
            n1: this.sumAccounts(n1, ["707"]),
          },
          variationStocks: {
            n: this.sumAccounts(n, ["72"]),
            n1: this.sumAccounts(n1, ["72"]),
          },
          productionImmobilisee: {
            n: this.sumAccounts(n, ["73"]),
            n1: this.sumAccounts(n1, ["73"]),
          },
          subventionsExploitation: {
            n: this.sumAccounts(n, ["74"]),
            n1: this.sumAccounts(n1, ["74"]),
          },
          autresProduits: {
            n: this.sumAccounts(n, ["75", "76", "77", "78"]),
            n1: this.sumAccounts(n1, ["75", "76", "77", "78"]),
          },
        },
        charges: {
          achatsMarchandises: {
            n: this.sumAccounts(n, ["601"]),
            n1: this.sumAccounts(n1, ["601"]),
          },
          variationStocks: {
            n: this.sumAccounts(n, ["6031"]),
            n1: this.sumAccounts(n1, ["6031"]),
          },
          achatsMatieresPremieres: {
            n: this.sumAccounts(n, ["602"]),
            n1: this.sumAccounts(n1, ["602"]),
          },
          autresAchats: {
            n: this.sumAccounts(n, ["604", "605", "606", "607", "608"]),
            n1: this.sumAccounts(n1, ["604", "605", "606", "607", "608"]),
          },
          transports: {
            n: this.sumAccounts(n, ["61"]),
            n1: this.sumAccounts(n1, ["61"]),
          },
          servicesExterieurs: {
            n: this.sumAccounts(n, ["62", "63"]),
            n1: this.sumAccounts(n1, ["62", "63"]),
          },
          impotsTaxes: {
            n: this.sumAccounts(n, ["64"]),
            n1: this.sumAccounts(n1, ["64"]),
          },
          autresCharges: {
            n: this.sumAccounts(n, ["65"]),
            n1: this.sumAccounts(n1, ["65"]),
          },
          chargesPersonnel: {
            n: this.sumAccounts(n, ["66"]),
            n1: this.sumAccounts(n1, ["66"]),
          },
          chargesFinancieres: {
            n: this.sumAccounts(n, ["67"]),
            n1: this.sumAccounts(n1, ["67"]),
          },
          dotationsAmortissements: {
            n: this.sumAccounts(n, ["681", "691"]),
            n1: this.sumAccounts(n1, ["681", "691"]),
          },
          dotationsProvisions: {
            n: this.sumAccounts(n, ["689", "699"]),
            n1: this.sumAccounts(n1, ["689", "699"]),
          },
        },
      },
      hao: {
        produits: {
          n: this.sumAccounts(n, ["81", "82", "84", "85", "86", "87", "88"]),
          n1: this.sumAccounts(n1, ["81", "82", "84", "85", "86", "87", "88"]),
        },
        charges: {
          n: this.sumAccounts(n, ["83"]),
          n1: this.sumAccounts(n1, ["83"]),
        },
      },
      resultat: {
        resultatExploitation: {
          n: resultatExploitation,
          n1:
            this.sumAccounts(n1, [
              "70",
              "71",
              "72",
              "73",
              "74",
              "75",
              "76",
              "77",
              "78",
            ]) -
            this.sumAccounts(n1, [
              "60",
              "61",
              "62",
              "63",
              "64",
              "65",
              "66",
              "681",
              "691",
            ]),
        },
        resultatFinancier: {
          n: resultatFinancier,
          n1: this.sumAccounts(n1, ["77"]) - this.sumAccounts(n1, ["67"]),
        },
        resultatHAO: {
          n: resultatHAO,
          n1:
            this.sumAccounts(n1, ["81", "82", "84", "85", "86", "87", "88"]) -
            this.sumAccounts(n1, ["83"]),
        },
        impotSurResultat: {
          n: impotSurResultat,
          n1: this.sumAccounts(n1, ["89"]),
        },
        resultatNet: {
          n: resultatNet,
          n1: this.getAccountBalance(n1, "13"),
        },
      },
    };
  }

  private generateTaxTables(
    nData: any,
    n1Data: any,
    folder: FolderWithRelations
  ): any {
    const n = nData.rows || [];
    const n1 = n1Data?.rows || [];

    const resultatComptable = this.getAccountBalance(n, "13");

    return {
      determinationResultatFiscal: {
        resultatComptable,
        reintegrations: {
          amendesEtPenalites: 0,
          chargesNonDeductibles: 0,
          depreciationNonDeductible: 0,
          autresReintegrations: 0,
          total: 0,
        },
        deductions: {
          provisionsExonerees: 0,
          amortissementsDifferes: 0,
          autresDeductions: 0,
          deficitsAnterieurs: 0,
          total: 0,
        },
        resultatFiscal: resultatComptable,
        impotSurSocietes: resultatComptable * 0.3,
      },
      cf1Bis: this.generateCF1Bis(n),
      cf1Ter: this.generateCF1Ter(n),
      cf1Quater: this.generateCF1Quater(n),
      cf2: this.generateCF2(n),
      cf2Bis: this.generateCF2Bis(n),
      cf2Ter: this.generateCF2Ter(n),
      amortissements: {
        immobilisations: [],
        totalAmortissements: this.sumAccounts(n, [
          "281",
          "282",
          "283",
          "284",
          "285",
        ]),
      },
      provisions: {
        provisionsReglementees: [],
        provisionsRisques: [],
        total: this.sumAccounts(n, ["15", "19"]),
      },
    };
  }

  private generateCF1Bis(n: any[]): any {
    return {
      title:
        "TABLEAU DE DETERMINATION DE L'IMPOT SUR LE RESULTAT: MINIMUM DE PERCEPTION",
      chiffreAffaires: this.sumAccounts(n, ["70", "71"]),
      minimumPerception: this.sumAccounts(n, ["70", "71"]) * 0.011,
    };
  }

  private generateCF1Ter(n: any[]): any {
    return {
      title: "MINIMUM DE PERCEPTION",
      chiffreAffairesHT: this.sumAccounts(n, ["70", "71"]),
      tauxMinimum: 0.011,
      minimumCalcule: this.sumAccounts(n, ["70", "71"]) * 0.011,
    };
  }

  private generateCF1Quater(n: any[]): any {
    return {
      title:
        "RECAPITULATIF DES VERSEMENTS D'ACOMPTES ET DE RETENUES SUBIES D'IMPOT SOCIETE ET D'ERENCE",
      acomptesVerses: 0,
      retenuesSubies: 0,
      total: 0,
    };
  }

  private generateCF2(n: any[]): any {
    const ca = this.sumAccounts(n, ["70", "71"]);
    const tvaBrute = ca * 0.1925;
    const tvaDeductible = this.sumAccounts(n, ["4452"]);

    return {
      title: "CALCUL DE REGULARISATION ANNUELLE DE LA TVA",
      chiffreAffairesHT: ca,
      tvaBrute,
      tvaDeductible,
      tvaNette: tvaBrute - tvaDeductible,
    };
  }

  private generateCF2Bis(n: any[]): any {
    return {
      title: "RECAPITULATIF DES VERSEMENTS EFFECTUES ET RETENUS SUBIES",
      versementsMensuels: [],
      total: 0,
    };
  }

  private generateCF2Ter(n: any[]): any {
    return {
      title: "SITUATION NETTE DE TVA",
      tvaDue: 0,
      tvaPayee: 0,
      solde: 0,
    };
  }

  private async generateAllNotes(
    nData: any,
    n1Data: any,
    nBalance: Balance,
    folder: FolderWithRelations
  ): Promise<any> {
    const n = nData.rows || [];
    const n1 = n1Data?.rows || [];
    const clientType = folder.client.clientType || "NORMAL";

    const notes: any = {};

    // Common notes for all client types
    notes.note1 = await this.generateNote1(folder, n);
    notes.note2 = this.generateNote2();
    notes.note3A = await this.generateNote3A(n, folder);
    notes.note3B = this.generateNote3B(n, n1);
    notes.note3C = this.generateNote3C(n);
    notes.c1Note3C = this.generateC1Note3C(n);
    notes.note3D = this.generateNote3D(n);
    notes.note3E = this.generateNote3E(n);
    notes.note3F = this.generateNote3F(n);
    notes.note4 = await this.generateNote4(n, n1, folder);
    notes.note5 = this.generateNote5(n);
    notes.note6 = this.generateNote6(n, n1);
    notes.note7 = await this.generateNote7(n, n1, folder);
    notes.note8 = this.generateNote8(n, n1);
    notes.note9 = this.generateNote9(n);
    notes.note10 = this.generateNote10(n);
    notes.note11 = this.generateNote11(n);
    notes.note12 = this.generateNote12(n);
    notes.note13 = this.generateNote13(folder);
    notes.note14 = this.generateNote14(n);
    notes.note15A = this.generateNote15A(n);
    notes.note15B = this.generateNote15B(n);
    notes.note16A = this.generateNote16A(n);
    notes.note16B = this.generateNote16B(n);
    notes.note16BBis = this.generateNote16BBis(n);
    notes.note16C = this.generateNote16C(n);
    notes.note17 = this.generateNote17(n);
    notes.c1Note17 = this.generateC1Note17(n);
    notes.note18 = this.generateNote18(n);
    notes.note19 = this.generateNote19(n);
    notes.note20 = this.generateNote20(n);
    notes.note21 = this.generateNote21(n, n1);
    notes.note22 = this.generateNote22(n, n1);
    notes.note23 = this.generateNote23(n, n1);
    notes.note24 = this.generateNote24(n, n1);
    notes.note25 = this.generateNote25(n);
    notes.c1Note25 = this.generateC1Note25(n);
    notes.c2Note25 = this.generateC2Note25(n);
    notes.note26 = this.generateNote26(n, n1);
    notes.note27A = this.generateNote27A(n, n1);
    notes.c1Note27A = this.generateC1Note27A(n);
    notes.note27B = this.generateNote27B(n);
    notes.note28 = this.generateNote28(n);
    notes.c1Note28 = this.generateC1Note28(n);
    notes.c2Note28 = this.generateC2Note28(n);
    notes.note29 = this.generateNote29(n, n1);
    notes.note30 = this.generateNote30(n, n1);
    notes.note31 = this.generateNote31(n);
    notes.note32 = this.generateNote32(n);
    notes.note33 = this.generateNote33(n);
    notes.note34 = this.generateNote34(n);
    notes.note35 = this.generateNote35();
    notes.cf1 = await this.generateCF1(n, folder);

    // Add client type specific notes
    if (clientType === "ASSURANCE") {
      // Add assurance-specific notes
      notes.bilanActif = this.generateBilanActif(n);
      notes.bilanPassif = this.generateBilanPassif(n);
      notes.charges = this.generateCharges(n);
      notes.compteGeneral = this.generateCompteGeneral(n);
      notes.etatC4 = this.generateEtatC4(n);
      notes.etatC11 = this.generateEtatC11(n);
      notes.etatC11Vie = this.generateEtatC11Vie(n);
      notes.produits = this.generateProduits(n);
      // Add other assurance notes...
    } else if (clientType === "SMT") {
      // Add SMT-specific notes
      notes.grilleAnalyseNotesSMT = this.generateGrilleAnalyseNotesSMT(n);
      notes.modBilan = this.generateModBilan(n);
      notes.note1Smt = this.generateNote1Smt(n);
      notes.note2Smt = this.generateNote2Smt(n);
      notes.note3Smt = this.generateNote3Smt(n);
      notes.note4Smt = this.generateNote4Smt(n);
      notes.note5Smt = this.generateNote5Smt(n);
      notes.note6Smt = this.generateNote6Smt(n);
      // Add other SMT notes...
    }

    return notes;
  }

  private async generateNote1(
    folder: FolderWithRelations,
    n: any[]
  ): Promise<any> {
    // Get Note1 config and account mappings
    const note1Config = await this.getConfigByCategory("note1", folder);
    const accountMappings = note1Config?.accountMappings || [];

    const dettesGaranties = accountMappings.map((mapping: any) => ({
      compte: mapping.accountNumber,
      montant: this.getBalanceValue(
        n,
        folder,
        mapping.accountNumber,
        mapping.source
      ),
      garantie: mapping.destination || "À préciser",
    }));

    return {
      title: "DETTES GARANTIES PAR DES SURETES REELLES",
      raisonSociale: folder.client.name,
      formeJuridique: folder.client.legalForm,
      activitePrincipale: "À compléter",
      effectif: 0,
      dettesGaranties,
    };
  }

  private generateNote2(): any {
    return {
      title: "INFORMATIONS OBLIGATOIRES",
      baseEvaluation: "Coûts historiques",
      methodesAmortissement: "Linéaire",
      methodesProvisions: "Au cas par cas",
    };
  }

  private async generateNote3A(
    n: any[],
    folder: FolderWithRelations
  ): Promise<any> {
    // Get Note3A config and account mappings
    const note3AConfig = await this.getConfigByCategory("note3A", folder);
    const accountMappings = note3AConfig?.accountMappings || [];

    let immobilisationsIncorporelles = this.sumAccounts(n, ["21"]);
    let immobilisationsCorporelles = this.sumAccounts(n, [
      "22",
      "23",
      "24",
      "25",
    ]);
    let immobilisationsFinancieres = this.sumAccounts(n, ["26", "27"]);

    // Apply account mappings to override default calculations
    accountMappings.forEach((mapping: any) => {
      const value = this.getBalanceValue(
        n,
        folder,
        mapping.accountNumber,
        mapping.source
      );
      if (mapping.destination === "immobilisationsIncorporelles") {
        immobilisationsIncorporelles = value;
      } else if (mapping.destination === "immobilisationsCorporelles") {
        immobilisationsCorporelles = value;
      } else if (mapping.destination === "immobilisationsFinancieres") {
        immobilisationsFinancieres = value;
      }
    });

    const total =
      immobilisationsIncorporelles +
      immobilisationsCorporelles +
      immobilisationsFinancieres;

    return {
      title: "IMMOBILISATIONS BRUTES",
      immobilisationsIncorporelles,
      immobilisationsCorporelles,
      immobilisationsFinancieres,
      total,
    };
  }

  private generateNote3B(n: any[], n1: any[]): any {
    const debutExercice = this.sumAccounts(n1, [
      "21",
      "22",
      "23",
      "24",
      "25",
      "26",
      "27",
    ]);
    const acquisitions = 0;
    const cessions = 0;
    const finExercice = this.sumAccounts(n, [
      "21",
      "22",
      "23",
      "24",
      "25",
      "26",
      "27",
    ]);

    return {
      title: "BIENS PRIS EN LOCATION ACQUISITION",
      debutExercice,
      acquisitions,
      cessions,
      finExercice,
      tableauDetails: [],
    };
  }

  private generateNote3C(n: any[]): any {
    return {
      title: "IMMOBILISATIONS: AMORTISSEMENTS",
      amortissementsCumules: this.sumAccounts(n, [
        "281",
        "282",
        "283",
        "284",
        "285",
      ]),
      dotationsExercice: this.sumAccounts(n, ["681"]),
      reprisesExercice: 0,
    };
  }

  private generateC1Note3C(n: any[]): any {
    return {
      title:
        "TABLEAU DE SUIVI DES AMORTISSEMENTS DEDUCTIBLES REPUTES DIFFERES EN PERIODE DEFICITAIRE",
      amortissementsDifferes: [],
      total: 0,
    };
  }

  private generateNote3D(n: any[]): any {
    return {
      title: "IMMOBILISATIONS: PLUS ET MOINS VALUE DE CESSION",
      prixCession: 0,
      valeurComptableNette: 0,
      plusValue: 0,
      moinsValue: 0,
    };
  }

  private generateNote3E(n: any[]): any {
    return {
      title: "INFORMATIONS SUR LES REEVALUATIONS EFFECTUEES PAR L'ENTITE",
      reevaluations: [],
      total: 0,
    };
  }

  private generateNote3F(n: any[]): any {
    return {
      title: "TABLEAU D'ETALEMENT DES CHARGES IMMOBILISEES",
      chargesImmobilisees: this.sumAccounts(n, ["201", "202", "203"]),
      amortissements: this.sumAccounts(n, ["2801", "2802", "2803"]),
      valeurNette: this.calculateNet(
        n,
        ["201", "202", "203"],
        ["2801", "2802", "2803"]
      ),
    };
  }

  private async generateNote4(
    n: any[],
    n1: any[],
    folder: FolderWithRelations
  ): Promise<any> {
    // Get Note4 config and account mappings
    const note4Config = await this.getConfigByCategory("note4", folder);
    const accountMappings = note4Config?.accountMappings || [];

    let titresDeParticipation = this.sumAccounts(n, ["261", "262"]);
    let autresTitres = this.sumAccounts(n, ["26", "27"]);
    let pretsEtCreances = this.sumAccounts(n, ["274", "275", "276"]);

    // Apply account mappings
    accountMappings.forEach((mapping: any) => {
      const value = this.getBalanceValue(
        n,
        folder,
        mapping.accountNumber,
        mapping.source
      );
      if (mapping.destination === "titresDeParticipation") {
        titresDeParticipation = value;
      } else if (mapping.destination === "autresTitres") {
        autresTitres = value;
      } else if (mapping.destination === "pretsEtCreances") {
        pretsEtCreances = value;
      }
    });

    const total = titresDeParticipation + autresTitres + pretsEtCreances;

    return {
      title: "IMMOBILISATIONS FINANCIERES",
      titresDeParticipation,
      autresTitres,
      pretsEtCreances,
      total,
    };
  }

  private generateNote5(n: any[]): any {
    return {
      title: "ACTIF CIRCULANT HAO",
      actifCirculantHAO: this.sumAccounts(n, ["485"]),
      details: [],
    };
  }

  private generateNote6(n: any[], n1: any[]): any {
    return {
      title: "STOCKS ET ENCOURS",
      marchandises: {
        n: this.sumAccounts(n, ["31"]),
        n1: this.sumAccounts(n1, ["31"]),
      },
      matieresPremieres: {
        n: this.sumAccounts(n, ["32"]),
        n1: this.sumAccounts(n1, ["32"]),
      },
      autresApprovisionnements: {
        n: this.sumAccounts(n, ["33"]),
        n1: this.sumAccounts(n1, ["33"]),
      },
      enCours: {
        n: this.sumAccounts(n, ["34", "35"]),
        n1: this.sumAccounts(n1, ["34", "35"]),
      },
      produitsFinis: {
        n: this.sumAccounts(n, ["36"]),
        n1: this.sumAccounts(n1, ["36"]),
      },
      total: {
        n: this.sumAccounts(n, [
          "31",
          "32",
          "33",
          "34",
          "35",
          "36",
          "37",
          "38",
        ]),
        n1: this.sumAccounts(n1, [
          "31",
          "32",
          "33",
          "34",
          "35",
          "36",
          "37",
          "38",
        ]),
      },
    };
  }

  private async generateNote7(
    n: any[],
    n1: any[],
    folder: FolderWithRelations
  ): Promise<any> {
    // Get Note7 config and account mappings
    const note7Config = await this.getConfigByCategory("note7", folder);
    const accountMappings = note7Config?.accountMappings || [];

    let clientsOrdinairesN = this.sumAccounts(n, ["411"]);
    let clientsOrdinairesN1 = this.sumAccounts(n1, ["411"]);
    let clientsDouteuxN = this.sumAccounts(n, ["416"]);
    let clientsDouteuxN1 = this.sumAccounts(n1, ["416"]);
    let creancesSurCessionsN = this.sumAccounts(n, ["4651", "4652"]);
    let creancesSurCessionsN1 = this.sumAccounts(n1, ["4651", "4652"]);
    let provisionsClientsN = this.sumAccounts(n, ["491"]);
    let provisionsClientsN1 = this.sumAccounts(n1, ["491"]);

    // Apply account mappings
    accountMappings.forEach((mapping: any) => {
      const valueN = this.getBalanceValue(
        n,
        folder,
        mapping.accountNumber,
        mapping.source
      );
      const valueN1 = n1
        ? this.getBalanceValue(
            n1,
            folder,
            mapping.accountNumber,
            mapping.source
          )
        : 0;

      if (mapping.destination === "clientsOrdinaires") {
        clientsOrdinairesN = valueN;
        clientsOrdinairesN1 = valueN1;
      } else if (mapping.destination === "clientsDouteux") {
        clientsDouteuxN = valueN;
        clientsDouteuxN1 = valueN1;
      } else if (mapping.destination === "creancesSurCessions") {
        creancesSurCessionsN = valueN;
        creancesSurCessionsN1 = valueN1;
      } else if (mapping.destination === "provisionsClients") {
        provisionsClientsN = valueN;
        provisionsClientsN1 = valueN1;
      }
    });

    const totalN =
      clientsOrdinairesN +
      clientsDouteuxN +
      creancesSurCessionsN -
      provisionsClientsN;
    const totalN1 =
      clientsOrdinairesN1 +
      clientsDouteuxN1 +
      creancesSurCessionsN1 -
      provisionsClientsN1;

    return {
      title: "CLIENTS",
      clientsOrdinaires: { n: clientsOrdinairesN, n1: clientsOrdinairesN1 },
      clientsDouteux: { n: clientsDouteuxN, n1: clientsDouteuxN1 },
      creancesSurCessions: {
        n: creancesSurCessionsN,
        n1: creancesSurCessionsN1,
      },
      provisionsClients: { n: provisionsClientsN, n1: provisionsClientsN1 },
      total: { n: totalN, n1: totalN1 },
    };
  }

  private generateNote8(n: any[], n1: any[]): any {
    return {
      title: "AUTRES CREANCES",
      fournisseursDebiteurs: {
        n: this.sumAccounts(n, ["4091", "4092"]),
        n1: this.sumAccounts(n1, ["4091", "4092"]),
      },
      personnel: {
        n: this.sumAccounts(n, [
          "421",
          "422",
          "423",
          "424",
          "425",
          "426",
          "427",
          "428",
        ]),
        n1: this.sumAccounts(n1, [
          "421",
          "422",
          "423",
          "424",
          "425",
          "426",
          "427",
          "428",
        ]),
      },
      etat: {
        n: this.sumAccounts(n, [
          "441",
          "442",
          "443",
          "444",
          "445",
          "446",
          "447",
        ]),
        n1: this.sumAccounts(n1, [
          "441",
          "442",
          "443",
          "444",
          "445",
          "446",
          "447",
        ]),
      },
      comptesDeLiaison: {
        n: this.sumAccounts(n, ["45"]),
        n1: this.sumAccounts(n1, ["45"]),
      },
      autresCreances: {
        n: this.sumAccounts(n, ["46", "47", "48"]),
        n1: this.sumAccounts(n1, ["46", "47", "48"]),
      },
      total: {
        n: this.sumAccounts(n, ["42", "43", "44", "45", "46", "47", "48"]),
        n1: this.sumAccounts(n1, ["42", "43", "44", "45", "46", "47", "48"]),
      },
    };
  }

  private generateNote9(n: any[]): any {
    return {
      title: "TITRES DE PLACEMENT",
      titresDePlacement: this.sumAccounts(n, ["50"]),
      provisions: this.sumAccounts(n, ["590"]),
      valeurNette: this.calculateNet(n, ["50"], ["590"]),
    };
  }

  private generateNote10(n: any[]): any {
    return {
      title: "VALEURS A ENCAISSER",
      effetsARecevoir: this.sumAccounts(n, ["413", "414"]),
      chequesAEncaisser: this.sumAccounts(n, ["513"]),
      couponsAEncaisser: this.sumAccounts(n, ["515"]),
      total: this.sumAccounts(n, ["413", "414", "513", "515"]),
    };
  }

  private generateNote11(n: any[]): any {
    return {
      title: "DISPONIBILITES",
      banques: this.sumAccounts(n, ["521", "522", "523", "524", "526"]),
      ccp: this.sumAccounts(n, ["531"]),
      caisse: this.sumAccounts(n, ["57"]),
      regiesAvances: this.sumAccounts(n, ["58"]),
      total: this.sumAccounts(n, ["52", "53", "57", "58"]),
    };
  }

  private generateNote12(n: any[]): any {
    return {
      title: "ECARTS DE CONVERSION",
      diminutionCreances: this.sumAccounts(n, ["476"]),
      augmentationDettes: this.sumAccounts(n, ["477"]),
      total: this.sumAccounts(n, ["476", "477"]),
    };
  }

  private generateNote13(folder: FolderWithRelations): any {
    return {
      title: "VALEUR NOMINALE DES ACTIONS OU PARTS",
      capitalSocial: 0,
      nombreActions: 0,
      valeurNominale: 0,
      repartition: [],
    };
  }

  private generateNote14(n: any[]): any {
    return {
      title: "PRIMES ET RESERVES",
      primesApport: this.sumAccounts(n, ["1051"]),
      primesFusion: this.sumAccounts(n, ["1052"]),
      primesEmission: this.sumAccounts(n, ["1053"]),
      reserveLegale: this.sumAccounts(n, ["1061"]),
      reserveStatutaire: this.sumAccounts(n, ["1062"]),
      reservesReglementees: this.sumAccounts(n, ["1063"]),
      autresReserves: this.sumAccounts(n, ["1068"]),
      total: this.sumAccounts(n, ["105", "106"]),
    };
  }

  private generateNote15A(n: any[]): any {
    return {
      title: "SUBVENTIONS ET PROVISIONS REGLEMENTEES",
      subventionsEquipement: this.sumAccounts(n, [
        "141",
        "142",
        "143",
        "144",
        "145",
        "146",
        "147",
        "148",
      ]),
      provisionsReglementees: this.sumAccounts(n, [
        "151",
        "152",
        "153",
        "154",
        "155",
        "156",
        "157",
        "158",
      ]),
      total: this.sumAccounts(n, ["14", "15"]),
    };
  }

  private generateNote15B(n: any[]): any {
    return {
      title: "AUTRES FONDS PROPRES",
      empruntsParticulaires: this.sumAccounts(n, ["166"]),
      autresEmprunts: this.sumAccounts(n, ["167", "168"]),
      total: this.sumAccounts(n, ["16"]),
    };
  }

  private generateNote16A(n: any[]): any {
    return {
      title: "DETTES FINANCIERES ET RESSOURCES ASSIMILEES",
      empruntsObligataires: this.sumAccounts(n, ["161", "162"]),
      empruntsEtablissementsCredit: this.sumAccounts(n, ["163", "164", "165"]),
      depotsCautionnements: this.sumAccounts(n, ["165", "166"]),
      total: this.sumAccounts(n, ["16", "17"]),
    };
  }

  private generateNote16B(n: any[]): any {
    return {
      title:
        "ENGAGEMENTS DE RETRAITE ET AVANTAGES ASSIMILES (METHODE ACTUARIELLE)",
      valeurActuelleEngagements: 0,
      justerValeurActifs: 0,
      ecartsActuariels: 0,
      total: 0,
    };
  }

  private generateNote16BBis(n: any[]): any {
    return {
      title: "ENGAGEMENTS DE RETRAITE ET AVANTAGES ASSIMILES",
      provisionOuverture: this.sumAccounts(n, ["1951", "1952"]),
      dotationsExercice: 0,
      reprisesExercice: 0,
      provisionCloture: this.sumAccounts(n, ["1951", "1952"]),
    };
  }

  private generateNote16C(n: any[]): any {
    return {
      title: "ACTIFS ET PASSIFS EVENTUELS",
      cautions: 0,
      avals: 0,
      garanties: 0,
      engagementsCredit: 0,
      total: 0,
    };
  }

  private generateNote17(n: any[]): any {
    return {
      title: "FOURNISSEURS D'EXPLOITATION",
      fournisseursOrdinaires: this.sumAccounts(n, ["401", "402"]),
      fournisseursEffetsAPayer: this.sumAccounts(n, ["403", "404", "405"]),
      fournisseursRetenues: this.sumAccounts(n, ["408"]),
      total: this.sumAccounts(n, [
        "401",
        "402",
        "403",
        "404",
        "405",
        "406",
        "408",
      ]),
    };
  }

  private generateC1Note17(n: any[]): any {
    return {
      title: "EXTRAIT DE LA BALANCE GENERALE FOURNISSEURS",
      fournisseurs: [],
      totalDebit: 0,
      totalCredit: 0,
      solde: 0,
    };
  }

  private generateNote18(n: any[]): any {
    return {
      title: "DETTES FISCALES ET SOCIALES",
      dettesFiscales: {
        tva: this.sumAccounts(n, ["4431", "4432", "4433", "4434", "4435"]),
        impotsSurSalaires: this.sumAccounts(n, ["4471", "4472", "4473"]),
        impotsSurResultat: this.sumAccounts(n, ["444"]),
        autresImpots: this.sumAccounts(n, ["441", "442", "445", "446", "447"]),
      },
      dettesSociales: {
        cnps: this.sumAccounts(n, ["431", "432", "433"]),
        personnel: this.sumAccounts(n, [
          "421",
          "422",
          "423",
          "424",
          "425",
          "426",
          "427",
          "428",
        ]),
      },
      total: this.sumAccounts(n, ["42", "43", "44"]),
    };
  }

  private generateNote19(n: any[]): any {
    return {
      title: "AUTRES DETTES ET PROVISIONS POUR RISQUES A COURT TERME",
      autresDettes: this.sumAccounts(n, ["46", "47", "48"]),
      provisionsRisques: this.sumAccounts(n, ["499"]),
      total: this.sumAccounts(n, ["46", "47", "48", "499"]),
    };
  }

  private generateNote20(n: any[]): any {
    return {
      title: "BANQUES, CREDIT D'ESCOMPTE ET DE TRESORERIE",
      creditsCourtsTermes: this.sumAccounts(n, ["561", "564"]),
      decouvertsBancaires: this.sumAccounts(n, ["565"]),
      escompteEffets: this.sumAccounts(n, ["564"]),
      total: this.sumAccounts(n, ["56"]),
    };
  }

  private generateNote21(n: any[], n1: any[]): any {
    return {
      title: "CHIFFRE D'AFFAIRES ET AUTRES PRODUITS",
      ventesMarchandises: {
        n: this.sumAccounts(n, ["701"]),
        n1: this.sumAccounts(n1, ["701"]),
      },
      ventesProduits: {
        n: this.sumAccounts(n, ["702", "703", "704"]),
        n1: this.sumAccounts(n1, ["702", "703", "704"]),
      },
      travaux: {
        n: this.sumAccounts(n, ["705"]),
        n1: this.sumAccounts(n1, ["705"]),
      },
      services: {
        n: this.sumAccounts(n, ["706", "707"]),
        n1: this.sumAccounts(n1, ["706", "707"]),
      },
      produitsDivers: {
        n: this.sumAccounts(n, ["708"]),
        n1: this.sumAccounts(n1, ["708"]),
      },
      rabaisRemises: {
        n: this.sumAccounts(n, ["709"]),
        n1: this.sumAccounts(n1, ["709"]),
      },
      total: {
        n: this.sumAccounts(n, ["70"]),
        n1: this.sumAccounts(n1, ["70"]),
      },
    };
  }

  private generateNote22(n: any[], n1: any[]): any {
    return {
      title: "ACHATS",
      marchandises: {
        n: this.sumAccounts(n, ["601"]),
        n1: this.sumAccounts(n1, ["601"]),
      },
      matieresPremieres: {
        n: this.sumAccounts(n, ["602"]),
        n1: this.sumAccounts(n1, ["602"]),
      },
      autresApprovisionnements: {
        n: this.sumAccounts(n, ["604", "605", "606", "607", "608"]),
        n1: this.sumAccounts(n1, ["604", "605", "606", "607", "608"]),
      },
      rabaisRemises: {
        n: this.sumAccounts(n, ["609"]),
        n1: this.sumAccounts(n1, ["609"]),
      },
      total: {
        n: this.sumAccounts(n, ["60"]),
        n1: this.sumAccounts(n1, ["60"]),
      },
    };
  }

  private generateNote23(n: any[], n1: any[]): any {
    return {
      title: "TRANSPORTS",
      transportsAchats: {
        n: this.sumAccounts(n, ["611", "612"]),
        n1: this.sumAccounts(n1, ["611", "612"]),
      },
      transportsVentes: {
        n: this.sumAccounts(n, ["613", "614"]),
        n1: this.sumAccounts(n1, ["613", "614"]),
      },
      transportsPersonnel: {
        n: this.sumAccounts(n, ["615"]),
        n1: this.sumAccounts(n1, ["615"]),
      },
      autresTransports: {
        n: this.sumAccounts(n, ["616", "617", "618", "619"]),
        n1: this.sumAccounts(n1, ["616", "617", "618", "619"]),
      },
      total: {
        n: this.sumAccounts(n, ["61"]),
        n1: this.sumAccounts(n1, ["61"]),
      },
    };
  }

  private generateNote24(n: any[], n1: any[]): any {
    return {
      title: "SERVICES EXTERIEURS",
      loyers: {
        n: this.sumAccounts(n, ["622", "623"]),
        n1: this.sumAccounts(n1, ["622", "623"]),
      },
      entretien: {
        n: this.sumAccounts(n, ["624", "625", "626"]),
        n1: this.sumAccounts(n1, ["624", "625", "626"]),
      },
      primes: {
        n: this.sumAccounts(n, ["627"]),
        n1: this.sumAccounts(n1, ["627"]),
      },
      documentation: {
        n: this.sumAccounts(n, ["628"]),
        n1: this.sumAccounts(n1, ["628"]),
      },
      autresServices: {
        n: this.sumAccounts(n, ["63"]),
        n1: this.sumAccounts(n1, ["63"]),
      },
      total: {
        n: this.sumAccounts(n, ["62", "63"]),
        n1: this.sumAccounts(n1, ["62", "63"]),
      },
    };
  }

  private generateNote25(n: any[]): any {
    const impotsTaxes = this.sumAccounts(n, ["64"]);
    return {
      title: "IMPOTS ET TAXES",
      impotsSurBenefices: this.sumAccounts(n, ["444"]),
      autresImpots: this.sumAccounts(n, [
        "641",
        "642",
        "643",
        "644",
        "645",
        "646",
        "647",
        "648",
      ]),
      total: impotsTaxes,
      detail: {
        patente: this.sumAccounts(n, ["642"]),
        foncier: this.sumAccounts(n, ["643"]),
        taxesVehicules: this.sumAccounts(n, ["644"]),
        autresTaxes: this.sumAccounts(n, ["645", "646", "647", "648"]),
      },
    };
  }

  private generateC1Note25(n: any[]): any {
    return {
      title: "SYNTHESE DES IMPOTS ET TAXES VERSES",
      impotsVersesExploitation: this.sumAccounts(n, ["64"]),
      impotsHAO: this.sumAccounts(n, ["848"]),
      total: this.sumAccounts(n, ["64", "848"]),
    };
  }

  private generateC2Note25(n: any[]): any {
    return {
      title:
        "TABLEAU DE LA REGULARISATION ANNUELLE DES DROITS D'ACCISES: DETERMINATION DES DROITS D'ACCISES A REVERSER",
      baseImposable: 0,
      tauxAccises: 0,
      droitsCalcules: 0,
      droitsVerses: 0,
      solde: 0,
    };
  }

  private generateNote26(n: any[], n1: any[]): any {
    return {
      title: "AUTRES CHARGES",
      chargesDiverses: {
        n: this.sumAccounts(n, ["65"]),
        n1: this.sumAccounts(n1, ["65"]),
      },
      detail: {
        pertesSurCreances: this.sumAccounts(n, ["654"]),
        chargesExceptionnelles: this.sumAccounts(n, ["658"]),
        autresCharges: this.sumAccounts(n, [
          "651",
          "652",
          "653",
          "655",
          "656",
          "657",
        ]),
      },
      total: {
        n: this.sumAccounts(n, ["65"]),
        n1: this.sumAccounts(n1, ["65"]),
      },
    };
  }

  private generateNote27A(n: any[], n1: any[]): any {
    return {
      title: "CHARGES DE PERSONNEL",
      salairesEtTraitements: {
        n: this.sumAccounts(n, ["661", "662", "663", "664"]),
        n1: this.sumAccounts(n1, ["661", "662", "663", "664"]),
      },
      chargesSociales: {
        n: this.sumAccounts(n, ["665", "666", "667"]),
        n1: this.sumAccounts(n1, ["665", "666", "667"]),
      },
      autresCharges: {
        n: this.sumAccounts(n, ["668"]),
        n1: this.sumAccounts(n1, ["668"]),
      },
      total: {
        n: this.sumAccounts(n, ["66"]),
        n1: this.sumAccounts(n1, ["66"]),
      },
    };
  }

  private generateC1Note27A(n: any[]): any {
    return {
      title:
        "TABLEAU DE REGULARISATION ANNUELLE DES IMPOTS ET TAXES SUR SALAIRES",
      masseSalariale: this.sumAccounts(n, ["661", "662", "663", "664"]),
      irppVerse: this.sumAccounts(n, ["4472"]),
      centimesCommunaux: this.sumAccounts(n, ["4473"]),
      cfpVerse: this.sumAccounts(n, ["4474"]),
      total: this.sumAccounts(n, ["4472", "4473", "4474"]),
    };
  }

  private generateNote27B(n: any[]): any {
    return {
      title: "EFFECTIFS, MASSE SALARIALE ET PERSONNEL EXTERIEUR",
      effectif: {
        cadres: 0,
        employes: 0,
        ouvriers: 0,
        total: 0,
      },
      masseSalariale: {
        salaires: this.sumAccounts(n, ["661", "662", "663", "664"]),
        chargesSociales: this.sumAccounts(n, ["665", "666", "667"]),
        total: this.sumAccounts(n, ["66"]),
      },
      personnelExterieur: this.sumAccounts(n, ["637"]),
    };
  }

  private generateNote28(n: any[]): any {
    return {
      title: "PROVISIONS ET DEPRECIATIONS INSCRITES AU BILAN",
      provisions: {
        exploitation: this.sumAccounts(n, ["691"]),
        financieres: this.sumAccounts(n, ["697"]),
        hao: this.sumAccounts(n, ["857"]),
      },
      depreciations: {
        exploitation: this.sumAccounts(n, ["691"]),
        financieres: this.sumAccounts(n, ["697"]),
        hao: this.sumAccounts(n, ["857"]),
      },
      total: this.sumAccounts(n, ["691", "697", "857"]),
    };
  }

  private generateC1Note28(n: any[]): any {
    return {
      title:
        "TABLEAU RECAPITULATIF DU TRAITEMENT FISCAL DES PROVISIONS DE L'EXERCICE: LES REPRISES",
      reprisesExploitation: this.sumAccounts(n, ["791"]),
      reprisesFinancieres: this.sumAccounts(n, ["797"]),
      reprisesHAO: this.sumAccounts(n, ["867"]),
      total: this.sumAccounts(n, ["791", "797", "867"]),
    };
  }

  private generateC2Note28(n: any[]): any {
    return {
      title:
        "TABLEAU RECAPITULATIF DU TRAITEMENT FISCAL DES PROVISIONS DE L'EXERCICE: LES DOTATIONS",
      dotationsExploitation: this.sumAccounts(n, ["691"]),
      dotationsFinancieres: this.sumAccounts(n, ["697"]),
      dotationsHAO: this.sumAccounts(n, ["857"]),
      total: this.sumAccounts(n, ["691", "697", "857"]),
    };
  }

  private generateNote29(n: any[], n1: any[]): any {
    return {
      title: "CHARGES ET REVENUS FINANCIERS",
      revenus: {
        revenusFinanciers: {
          n: this.sumAccounts(n, [
            "771",
            "772",
            "773",
            "774",
            "776",
            "777",
            "778",
          ]),
          n1: this.sumAccounts(n1, [
            "771",
            "772",
            "773",
            "774",
            "776",
            "777",
            "778",
          ]),
        },
        reprisesProvisions: {
          n: this.sumAccounts(n, ["797"]),
          n1: this.sumAccounts(n1, ["797"]),
        },
      },
      charges: {
        interets: {
          n: this.sumAccounts(n, ["671", "672", "673"]),
          n1: this.sumAccounts(n1, ["671", "672", "673"]),
        },
        pertesChange: {
          n: this.sumAccounts(n, ["676"]),
          n1: this.sumAccounts(n1, ["676"]),
        },
        autresCharges: {
          n: this.sumAccounts(n, ["674", "675", "677", "678"]),
          n1: this.sumAccounts(n1, ["674", "675", "677", "678"]),
        },
        dotationsProvisions: {
          n: this.sumAccounts(n, ["697"]),
          n1: this.sumAccounts(n1, ["697"]),
        },
      },
      resultatFinancier: {
        n: this.sumAccounts(n, ["77"]) - this.sumAccounts(n, ["67"]),
        n1: this.sumAccounts(n1, ["77"]) - this.sumAccounts(n1, ["67"]),
      },
    };
  }

  private generateNote30(n: any[], n1: any[]): any {
    return {
      title: "AUTRES CHARGES ET PRODUITS HAO",
      produits: {
        plusValuesCessions: {
          n: this.sumAccounts(n, [
            "821",
            "822",
            "823",
            "824",
            "825",
            "826",
            "827",
          ]),
          n1: this.sumAccounts(n1, [
            "821",
            "822",
            "823",
            "824",
            "825",
            "826",
            "827",
          ]),
        },
        produitsExceptionnels: {
          n: this.sumAccounts(n, ["84", "85", "86", "87", "88"]),
          n1: this.sumAccounts(n1, ["84", "85", "86", "87", "88"]),
        },
      },
      charges: {
        moinsValuesCessions: {
          n: this.sumAccounts(n, [
            "831",
            "832",
            "833",
            "834",
            "835",
            "836",
            "837",
          ]),
          n1: this.sumAccounts(n1, [
            "831",
            "832",
            "833",
            "834",
            "835",
            "836",
            "837",
          ]),
        },
        chargesExceptionnelles: {
          n: this.sumAccounts(n, ["838", "839"]),
          n1: this.sumAccounts(n1, ["838", "839"]),
        },
      },
      resultatHAO: {
        n:
          this.sumAccounts(n, ["81", "82", "84", "85", "86", "87", "88"]) -
          this.sumAccounts(n, ["83"]),
        n1:
          this.sumAccounts(n1, ["81", "82", "84", "85", "86", "87", "88"]) -
          this.sumAccounts(n1, ["83"]),
      },
    };
  }

  private generateNote31(n: any[]): any {
    const resultatAvantImpot =
      this.getAccountBalance(n, "13") + this.sumAccounts(n, ["89"]);
    const impotSurResultat = this.sumAccounts(n, ["89"]);

    return {
      title:
        "REPARTITION DU RESULTAT ET AUTRES ELEMENTS CARACTERISTIQUES DES CINQ DERNIERS EXERCICES",
      resultatAvantImpot,
      impotSurResultat,
      resultatNet: this.getAccountBalance(n, "13"),
      dividendes: 0,
      reportANouveau: this.getAccountBalance(n, "12"),
    };
  }

  private generateNote32(n: any[]): any {
    return {
      title: "PRODUCTION DE L'EXERCICE",
      ventesProduction: this.sumAccounts(n, [
        "702",
        "703",
        "704",
        "705",
        "706",
      ]),
      productionStockee: this.sumAccounts(n, ["73"]),
      productionImmobilisee: this.sumAccounts(n, ["72"]),
      total: this.sumAccounts(n, ["70", "71", "72", "73"]),
    };
  }

  private generateNote33(n: any[]): any {
    return {
      title: "ACHATS DESTINES A LA PRODUCTION",
      achatsMatieresPremieres: this.sumAccounts(n, ["602"]),
      autresApprovisionnements: this.sumAccounts(n, ["604", "605", "606"]),
      variationStocks: this.sumAccounts(n, ["6032", "6033"]),
      total: this.sumAccounts(n, ["602", "604", "605", "606", "6032", "6033"]),
    };
  }

  private generateNote34(n: any[]): any {
    const ca = this.sumAccounts(n, ["70", "71"]);
    const valeurAjoutee =
      ca - this.sumAccounts(n, ["60", "61", "62", "63", "64"]);
    const ebe = valeurAjoutee - this.sumAccounts(n, ["66"]);
    const resultatExploitation = ebe - this.sumAccounts(n, ["681"]);

    return {
      title: "FICHE DE SYNTHESE DES PRINCIPAUX INDICATEURS FINANCIERS",
      chiffreAffaires: ca,
      valeurAjoutee,
      excedentBrutExploitation: ebe,
      resultatExploitation,
      resultatFinancier:
        this.sumAccounts(n, ["77"]) - this.sumAccounts(n, ["67"]),
      resultatHAO:
        this.sumAccounts(n, ["81", "82", "84", "85", "86", "87", "88"]) -
        this.sumAccounts(n, ["83"]),
      resultatNet: this.getAccountBalance(n, "13"),
      capaciteAutofinancement:
        this.getAccountBalance(n, "13") + this.sumAccounts(n, ["681", "691"]),
      ratiosRentabilite: {
        margeCommerciale: 0,
        tauxMarque: 0,
        rentabiliteCommerciale: 0,
        rentabiliteEconomique: 0,
      },
    };
  }

  private generateNote35(): any {
    return {
      title:
        "LISTE DES INFORMATIONS SOCIALES, ENVIRONNEMENTALES ET SOCIETALES A FOURNIR",
      informationsSociales: [],
      informationsEnvironnementales: [],
      informationsSocietales: [],
    };
  }

  private async getConfigByCategory(
    category: string,
    folder: FolderWithRelations
  ): Promise<any> {
    // Import prisma here to avoid circular dependencies
    const { prisma } = require("../lib/prisma");

    // Find the config by category
    const config = await prisma.dSFConfig.findUnique({
      where: { category: category.toLowerCase() },
      include: {
        accountMappings: {
          where: { isActive: true },
        },
      },
    });

    return config;
  }

  private calculateFromMappings(
    n: any[],
    folder: FolderWithRelations,
    accountMappings: any[],
    type: "reintegrations" | "deductions"
  ): number {
    // Group mappings by destination and sum values for same destination
    const destinationMap = new Map<string, number>();

    accountMappings.forEach((mapping: any) => {
      const value = this.getBalanceValue(
        n,
        folder,
        mapping.accountNumber,
        mapping.source
      );
      const currentSum = destinationMap.get(mapping.destination) || 0;
      destinationMap.set(mapping.destination, currentSum + value);
    });

    // For now, return sum of all values (can be filtered by type later based on destination patterns)
    return Array.from(destinationMap.values()).reduce(
      (sum, val) => sum + val,
      0
    );
  }

  private getBalanceValue(
    n: any[],
    folder: FolderWithRelations,
    accountNumber: string,
    source: string
  ): number {
    // Find the account in balance data
    const account = n.find(
      (row: any) => String(row.accountNumber) === accountNumber
    );

    if (!account) return 0;

    // Get the appropriate balance value based on source
    switch (source) {
      case "OD":
        return parseFloat(account.openingDebit || 0);
      case "OC":
        return parseFloat(account.openingCredit || 0);
      case "MD":
        return parseFloat(account.movementDebit || 0);
      case "MC":
        return parseFloat(account.movementCredit || 0);
      case "SD":
        return parseFloat(account.closingDebit || 0);
      case "SC":
        return parseFloat(account.closingCredit || 0);
      case "MCD":
        return (
          parseFloat(account.movementDebit || 0) -
          parseFloat(account.movementCredit || 0)
        );
      case "SCD":
        return (
          parseFloat(account.closingDebit || 0) -
          parseFloat(account.closingCredit || 0)
        );
      default:
        return 0;
    }
  }

  private applyAccountMappings(
    n: any[],
    folder: FolderWithRelations,
    accountMappings: any[]
  ): Map<string, number> {
    const destinationMap = new Map<string, number>();

    accountMappings.forEach((mapping: any) => {
      const value = this.getBalanceValue(
        n,
        folder,
        mapping.accountNumber,
        mapping.source
      );
      const currentSum = destinationMap.get(mapping.destination) || 0;
      destinationMap.set(mapping.destination, currentSum + value);
    });

    return destinationMap;
  }

  private async generateCF1(
    n: any[],
    folder: FolderWithRelations
  ): Promise<any> {
    const resultatComptable = this.getAccountBalance(n, "13");

    // Get CF1 config and account mappings
    const cf1Config = await this.getConfigByCategory("cf1", folder);
    const accountMappings = cf1Config?.accountMappings || [];

    // Initialize CF1 data structure with default values
    const cf1Data = {
      headerInfo: {
        entityName: folder.client.name,
        fiscalYear: folder.fiscalYear.toString(),
        idNumber: folder.client.taxNumber || "",
        duration: "12",
      },
      rows: [
        {
          id: "1",
          label: "Bénéfice net comptable avant impôt",
          line: 1,
          amount: resultatComptable,
        },
        { id: "2", label: "Amortissement non déductible", line: 3, amount: 0 },
        {
          id: "3",
          label:
            "Amortissement comptable mais réputes différés en période déficitaire",
          line: 4,
          amount: 0,
        },
        { id: "4", label: "Provisions non déductibles", line: 5, amount: 0 },
        {
          id: "5",
          label: "Intérêt excédentaires des comptes courants d'associés",
          line: 6,
          amount: 0,
        },
        {
          id: "6",
          label: "Frais de siège et d'assistance technique",
          line: 7,
          amount: 0,
        },
        {
          id: "7",
          label: "Impôt non déductibles autres qu'impôt sur le résultat",
          line: 8,
          amount: 0,
        },
        {
          id: "8",
          label: "Amendes et pénalités non déductibles",
          line: 9,
          amount: 0,
        },
        {
          id: "9",
          label: "Pourboires et dons non déductibles",
          line: 10,
          amount: 0,
        },
        {
          id: "10",
          label: "Revenu à la source(IRMC) sur revenus des capitaux mobiliers",
          line: 12,
          amount: 0,
        },
        { id: "11", label: "Divers 1", line: 13, amount: 0 },
        { id: "12", label: "Divers 2", line: 14, amount: 0 },
        { id: "13", label: "Divers 3", line: 15, amount: 0 },
        {
          id: "14",
          label:
            "Total intermédiaire POSITIF : ligne 15=lignes1ou ligne15ligne2",
          line: 16,
          amount: 0,
        },
        {
          id: "15",
          label: "Total intermédiaire NEGATIF : ligne2=lignes 15",
          line: 17,
          amount: 0,
        },
        {
          id: "16",
          label: "Amortissement antérieur différés et imputés sur l'exercice",
          line: 18,
          amount: 0,
        },
        {
          id: "17",
          label:
            "Provisions antérieurement taxées ou définitivement exonérées réintégrées dans",
          line: 19,
          amount: 0,
        },
        {
          id: "18",
          label:
            "Fraction non imposable des plus-values réalisées en fin d'explication",
          line: 20,
          amount: 0,
        },
        {
          id: "19",
          label:
            "Produit net des filiales (après déduction de la quote-part de frais et charges)",
          line: 21,
          amount: 0,
        },
        {
          id: "20",
          label: "Autres revenus mobiliers déductibles",
          line: 22,
          amount: 0,
        },
        {
          id: "21",
          label: "Frais de siège et d'assistance technique déductible",
          line: 23,
          amount: 0,
        },
        { id: "22", label: "Divers 1", line: 24, amount: 0 },
        { id: "23", label: "Divers 2", line: 25, amount: 0 },
        { id: "24", label: "Total lignes 18 à 26", line: 27, amount: 0 },
        {
          id: "25",
          label: "BÉNÉFICE FISCAL DE L'EXERCICE : ligne 16 - ligne 27",
          line: 28,
          amount: 0,
        },
        {
          id: "26",
          label:
            "PERTE FISCALE DE L'EXERCICE : ligne 27 - ligne 16 ou ligne 17 +",
          line: 29,
          amount: 0,
        },
      ],
      rubriques: [
        {
          id: "1",
          label: "Impôt sur les sociétés",
          line: 31,
          minimum: "Minimum de perception",
          base: "30%",
          rate: "30%",
          principal: "",
        },
        {
          id: "2",
          label: "BIC et BNC",
          line: 32,
          minimum: "",
          base: "",
          rate: "22%",
          principal: "",
        },
        {
          id: "3",
          label: "",
          line: 33,
          minimum: "",
          base: "",
          rate: "",
          principal: "",
        },
        {
          id: "4",
          label: "Bénéfice artisanaux",
          line: 34,
          minimum: "",
          base: "",
          rate: "11%",
          principal: "",
        },
        {
          id: "5",
          label: "",
          line: 35,
          minimum: "",
          base: "",
          rate: "",
          principal: "",
        },
        {
          id: "6",
          label: "Bénéfices agricoles",
          line: 36,
          minimum: "",
          base: "",
          rate: "15%",
          principal: "",
        },
        {
          id: "7",
          label: "",
          line: 37,
          minimum: "",
          base: "",
          rate: "",
          principal: "",
        },
        {
          id: "8",
          label: "TOTAL lignes 32 à 38",
          line: 39,
          minimum: "",
          base: "",
          rate: "",
          principal: "",
        },
      ],
    };

    // Apply account mappings to populate CF1 rows
    accountMappings.forEach((mapping: any) => {
      const value = this.getBalanceValue(
        n,
        folder,
        mapping.accountNumber,
        mapping.source
      );
      const rowIndex = cf1Data.rows.findIndex(
        (row) => row.id === mapping.destination
      );

      if (rowIndex !== -1) {
        cf1Data.rows[rowIndex].amount = value;
      }
    });

    // Calculate totals
    const reintegrationsSum = cf1Data.rows
      .slice(1, 13)
      .reduce((sum, row) => sum + row.amount, 0);
    const deductionsSum = cf1Data.rows
      .slice(15, 24)
      .reduce((sum, row) => sum + row.amount, 0);
    const beneficeFiscal = cf1Data.rows[13].amount - deductionsSum;
    const perteFiscal = deductionsSum - cf1Data.rows[13].amount;

    cf1Data.rows[12].amount = reintegrationsSum; // Line 15
    cf1Data.rows[23].amount = deductionsSum; // Line 27
    cf1Data.rows[24].amount = beneficeFiscal; // Line 28
    cf1Data.rows[25].amount = perteFiscal; // Line 29

    return cf1Data;
  }

  private generateSignaletics(folder: FolderWithRelations): any {
    return {
      r1: {
        title: "RENSEIGNEMENTS GENERAUX",
        denominationSociale: folder.client.name,
        formeJuridique: folder.client.legalForm,
        numeroContribuable: folder.client.taxNumber,
        exerciceFiscal: {
          debut: folder.startDate,
          fin: folder.endDate,
          duree: this.calculateExerciseDuration(
            folder.startDate,
            folder.endDate
          ),
        },
        adresse: folder.client.address,
        ville: folder.client.city,
        telephone: folder.client.phone,
        activitePrincipale: "À compléter",
        dateCreation: null,
        dateImmatriculation: null,
        numeroRCCM: null,
      },
      r2: {
        title: "ASSOCIES/ACTIONNAIRES",
        capitalSocial: 0,
        nombreParts: 0,
        valeurNominale: 0,
        associes: [],
        repartitionCapital: [],
      },
      r3: {
        title: "IDENTITE DES DIRIGEANTS",
        dirigeants: [],
        commissairesAuxComptes: [],
      },
      r4: {
        title: "EFFECTIF ET MASSE SALARIALE",
        effectif: {
          cadres: 0,
          agents: 0,
          employes: 0,
          ouvriers: 0,
          total: 0,
        },
        masseSalariale: {
          salaires: 0,
          chargesSociales: 0,
          total: 0,
        },
        evolutionEffectif: [],
      },
      r4Bis: {
        title: "INFORMATIONS COMPLEMENTAIRES",
        investissements: 0,
        subventions: 0,
        exportations: 0,
        importations: 0,
      },
    };
  }

  async performCoherenceControl(
    dsf: DSF & { folder: FolderWithRelations }
  ): Promise<CoherenceResult> {
    const issues: any[] = [];

    // Check balance sheet equilibrium
    const bs = dsf.balanceSheet as any;
    const totalAssets = this.sumBalanceSheetAssets(bs);
    const totalLiabilities = this.sumBalanceSheetLiabilities(bs);

    if (Math.abs(totalAssets - totalLiabilities) > 1) {
      issues.push({
        type: "EQUILIBRIUM",
        severity: "ERROR",
        message: `Balance sheet not balanced: Assets ${totalAssets} vs Liabilities ${totalLiabilities}`,
      });
    }

    // Check income statement
    const is = dsf.incomeStatement as any;
    const totalProducts = this.sumIncomeStatementProducts(is);
    const totalCharges = this.sumIncomeStatementCharges(is);
    const calculatedResult = totalProducts - totalCharges;
    const declaredResult = is.resultat?.resultatNet?.n || 0;

    if (Math.abs(calculatedResult - declaredResult) > 1) {
      issues.push({
        type: "RESULT_MISMATCH",
        severity: "ERROR",
        message: `Result mismatch: Calculated ${calculatedResult} vs Declared ${declaredResult}`,
      });
    }

    // Check tax tables coherence
    const taxTables = dsf.taxTables as any;
    const resultatComptable =
      taxTables.determinationResultatFiscal?.resultatComptable || 0;

    if (Math.abs(resultatComptable - declaredResult) > 1) {
      issues.push({
        type: "TAX_RESULT_MISMATCH",
        severity: "ERROR",
        message: `Tax result doesn't match accounting result`,
      });
    }

    // Check notes coherence
    const notes = dsf.notes as any;
    if (!notes.note34 || !notes.note34.chiffreAffaires) {
      issues.push({
        type: "MISSING_NOTE",
        severity: "WARNING",
        message: "Note 34 (Financial indicators) is incomplete",
      });
    }

    return {
      isCoherent: issues.filter((i) => i.severity === "ERROR").length === 0,
      issues,
    };
  }

  async exportToExcel(
    dsf: DSF & { folder: FolderWithRelations }
  ): Promise<string> {
    const workbook = XLSX.utils.book_new();

    // Create Balance Sheet
    const bsSheet = this.createBalanceSheetWorksheet(dsf.balanceSheet);
    XLSX.utils.book_append_sheet(workbook, bsSheet, "Bilan");

    // Create Income Statement
    const isSheet = this.createIncomeStatementWorksheet(dsf.incomeStatement);
    XLSX.utils.book_append_sheet(workbook, isSheet, "Compte de Résultat");

    // Create Tax Tables
    const taxSheet = this.createTaxTablesWorksheet(dsf.taxTables);
    XLSX.utils.book_append_sheet(workbook, taxSheet, "Tableaux Fiscaux");

    // Create all notes
    const notes = dsf.notes as any;
    Object.keys(notes).forEach((noteKey) => {
      const note = notes[noteKey];
      if (note && note.title) {
        const noteSheet = this.createNoteWorksheet(note);
        const sheetName = noteKey
          .toUpperCase()
          .replace("NOTE", "Note ")
          .substring(0, 31);
        XLSX.utils.book_append_sheet(workbook, noteSheet, sheetName);
      }
    });

    // Create Signaletics sheets
    const signaletics = dsf.signaletics as any;
    ["r1", "r2", "r3", "r4", "r4Bis"].forEach((ficheKey) => {
      if (signaletics[ficheKey]) {
        const ficheSheet = this.createSignaleticWorksheet(
          signaletics[ficheKey]
        );
        const sheetName = ficheKey.toUpperCase();
        XLSX.utils.book_append_sheet(workbook, ficheSheet, sheetName);
      }
    });

    // Save file
    const fileName = `DSF_${dsf.folder.client.name.replace(/\s+/g, "_")}_${dsf.folder.fiscalYear}_${Date.now()}.xlsx`;
    const filePath = path.join(config.upload.directory, fileName);

    XLSX.writeFile(workbook, filePath);

    return filePath;
  }

  // Helper methods
  private sumAccounts(rows: any[], accountPrefixes: string[]): number {
    if (!rows || !Array.isArray(rows)) return 0;

    return rows.reduce((sum, row) => {
      const accountNumber = String(row.accountNumber || "");
      const matchesPrefix = accountPrefixes.some((prefix) =>
        accountNumber.startsWith(prefix)
      );

      if (matchesPrefix) {
        const debit = parseFloat(row.closingDebit || 0);
        const credit = parseFloat(row.closingCredit || 0);
        return sum + (debit - credit);
      }

      return sum;
    }, 0);
  }

  private calculateNet(
    rows: any[],
    assetAccounts: string[],
    depreciationAccounts: string[]
  ): number {
    const gross = this.sumAccounts(rows, assetAccounts);
    const depreciation = this.sumAccounts(rows, depreciationAccounts);
    return gross - Math.abs(depreciation);
  }

  private getAccountBalance(rows: any[], accountPrefix: string): number {
    return this.sumAccounts(rows, [accountPrefix]);
  }

  private calculateExerciseDuration(startDate: Date, endDate: Date): number {
    const diff = new Date(endDate).getTime() - new Date(startDate).getTime();
    return Math.ceil(diff / (1000 * 60 * 60 * 24 * 30));
  }

  private sumBalanceSheetAssets(bs: any): number {
    let total = 0;

    if (bs.assets?.immobilisations) {
      const immo = bs.assets.immobilisations;
      total += immo.chargesImmobilisees?.net || 0;
      total += immo.immobilisationsIncorporelles?.net || 0;
      if (immo.immobilisationsCorporelles) {
        total += immo.immobilisationsCorporelles.terrains?.net || 0;
        total += immo.immobilisationsCorporelles.batiments?.net || 0;
        total +=
          immo.immobilisationsCorporelles.installationsEtAgencements?.net || 0;
        total += immo.immobilisationsCorporelles.materiel?.net || 0;
      }
      total += immo.immobilisationsFinancieres?.net || 0;
    }

    if (bs.assets?.actifCirculant) {
      const ac = bs.assets.actifCirculant;
      total += ac.stocks?.net || 0;
      total += ac.creances?.fournisseursAvances?.net || 0;
      total += ac.creances?.clients?.net || 0;
      total += ac.creances?.autresCreances?.net || 0;
      total += ac.tresorerie?.net || 0;
    }

    return total;
  }

  private sumBalanceSheetLiabilities(bs: any): number {
    let total = 0;

    if (bs.liabilities?.capitauxPropres) {
      const cp = bs.liabilities.capitauxPropres;
      total += cp.capital?.n || 0;
      total += cp.primes?.n || 0;
      total += cp.reserves?.n || 0;
      total += cp.reportANouveau?.n || 0;
      total += cp.resultat?.n || 0;
      total += cp.subventions?.n || 0;
      total += cp.provisions?.n || 0;
    }

    if (bs.liabilities?.dettesFinancieres) {
      total += bs.liabilities.dettesFinancieres.emprunts?.n || 0;
      total += bs.liabilities.dettesFinancieres.provisionsRisques?.n || 0;
    }

    if (bs.liabilities?.passifCirculant) {
      const pc = bs.liabilities.passifCirculant;
      total += pc.fournisseurs?.n || 0;
      total += pc.dettesFiscales?.n || 0;
      total += pc.dettesSociales?.n || 0;
      total += pc.autresDettes?.n || 0;
      total += pc.tresoreriePassif?.n || 0;
    }

    return total;
  }

  private sumIncomeStatementProducts(is: any): number {
    let total = 0;

    if (is.exploitation?.ventes) {
      const v = is.exploitation.ventes;
      total += v.ventesMarchandises?.n || 0;
      total += v.ventesProduitsFinis?.n || 0;
      total += v.travauxServices?.n || 0;
      total += v.produitsAccessoires?.n || 0;
      total += v.variationStocks?.n || 0;
      total += v.productionImmobilisee?.n || 0;
      total += v.subventionsExploitation?.n || 0;
      total += v.autresProduits?.n || 0;
    }

    if (is.hao?.produits?.n) {
      total += is.hao.produits.n;
    }

    return total;
  }

  private sumIncomeStatementCharges(is: any): number {
    let total = 0;

    if (is.exploitation?.charges) {
      const c = is.exploitation.charges;
      total += c.achatsMarchandises?.n || 0;
      total += c.variationStocks?.n || 0;
      total += c.achatsMatieresPremieres?.n || 0;
      total += c.autresAchats?.n || 0;
      total += c.transports?.n || 0;
      total += c.servicesExterieurs?.n || 0;
      total += c.impotsTaxes?.n || 0;
      total += c.autresCharges?.n || 0;
      total += c.chargesPersonnel?.n || 0;
      total += c.chargesFinancieres?.n || 0;
      total += c.dotationsAmortissements?.n || 0;
      total += c.dotationsProvisions?.n || 0;
    }

    if (is.hao?.charges?.n) {
      total += is.hao.charges.n;
    }

    if (is.resultat?.impotSurResultat?.n) {
      total += is.resultat.impotSurResultat.n;
    }

    return total;
  }

  private createBalanceSheetWorksheet(data: any): XLSX.WorkSheet {
    const wsData: any[][] = [
      ["BILAN ACTIF", "", "", "", ""],
      ["", "", "", "", ""],
      ["ACTIF", "Brut N", "Amort/Prov", "Net N", "Net N-1"],
      ["", "", "", "", ""],
      ["ACTIF IMMOBILISE", "", "", "", ""],
      [
        "Charges immobilisées",
        data.assets?.immobilisations?.chargesImmobilisees?.brut || 0,
        data.assets?.immobilisations?.chargesImmobilisees?.amortissements || 0,
        data.assets?.immobilisations?.chargesImmobilisees?.net || 0,
        data.assets?.immobilisations?.chargesImmobilisees?.netN1 || 0,
      ],
      ["", "", "", "", ""],
      ["TOTAL ACTIF", "", "", this.sumBalanceSheetAssets(data), ""],
      ["", "", "", "", ""],
      ["", "", "", "", ""],
      ["PASSIF", "", "N", "N-1", ""],
      ["", "", "", "", ""],
      ["CAPITAUX PROPRES", "", "", "", ""],
      [
        "Capital",
        "",
        data.liabilities?.capitauxPropres?.capital?.n || 0,
        data.liabilities?.capitauxPropres?.capital?.n1 || 0,
        "",
      ],
      ["", "", "", "", ""],
      ["TOTAL PASSIF", "", this.sumBalanceSheetLiabilities(data), "", ""],
    ];

    return XLSX.utils.aoa_to_sheet(wsData);
  }

  private createIncomeStatementWorksheet(data: any): XLSX.WorkSheet {
    const wsData: any[][] = [
      ["COMPTE DE RESULTAT", "", "", ""],
      ["", "", "", ""],
      ["COMPTE D'EXPLOITATION", "N", "N-1", ""],
      ["", "", "", ""],
      ["PRODUITS", "", "", ""],
      [
        "Ventes de marchandises",
        data.exploitation?.ventes?.ventesMarchandises?.n || 0,
        data.exploitation?.ventes?.ventesMarchandises?.n1 || 0,
        "",
      ],
      ["", "", "", ""],
      ["CHARGES", "", "", ""],
      [
        "Achats de marchandises",
        data.exploitation?.charges?.achatsMarchandises?.n || 0,
        data.exploitation?.charges?.achatsMarchandises?.n1 || 0,
        "",
      ],
      ["", "", "", ""],
      [
        "RESULTAT NET",
        data.resultat?.resultatNet?.n || 0,
        data.resultat?.resultatNet?.n1 || 0,
        "",
      ],
    ];

    return XLSX.utils.aoa_to_sheet(wsData);
  }

  private createTaxTablesWorksheet(data: any): XLSX.WorkSheet {
    const wsData: any[][] = [
      ["TABLEAUX DE DETERMINATION DU RESULTAT FISCAL", ""],
      ["", ""],
      [
        "Résultat comptable",
        data.determinationResultatFiscal?.resultatComptable || 0,
      ],
      ["", ""],
      ["REINTEGRATIONS", ""],
      [
        "Amendes et pénalités",
        data.determinationResultatFiscal?.reintegrations?.amendesEtPenalites ||
          0,
      ],
      [
        "Charges non déductibles",
        data.determinationResultatFiscal?.reintegrations
          ?.chargesNonDeductibles || 0,
      ],
      [
        "Total réintégrations",
        data.determinationResultatFiscal?.reintegrations?.total || 0,
      ],
      ["", ""],
      ["DEDUCTIONS", ""],
      [
        "Provisions exonérées",
        data.determinationResultatFiscal?.deductions?.provisionsExonerees || 0,
      ],
      [
        "Déficits antérieurs",
        data.determinationResultatFiscal?.deductions?.deficitsAnterieurs || 0,
      ],
      [
        "Total déductions",
        data.determinationResultatFiscal?.deductions?.total || 0,
      ],
      ["", ""],
      [
        "RESULTAT FISCAL",
        data.determinationResultatFiscal?.resultatFiscal || 0,
      ],
      [
        "Impôt sur sociétés (30%)",
        data.determinationResultatFiscal?.impotSurSocietes || 0,
      ],
    ];

    return XLSX.utils.aoa_to_sheet(wsData);
  }

  private createNoteWorksheet(note: any): XLSX.WorkSheet {
    const wsData: any[][] = [[note.title || "NOTE"], [""]];

    Object.keys(note).forEach((key) => {
      if (key !== "title" && note[key] !== null && note[key] !== undefined) {
        if (typeof note[key] === "object" && !Array.isArray(note[key])) {
          wsData.push([key.toUpperCase(), ""]);
          Object.keys(note[key]).forEach((subKey) => {
            wsData.push([`  ${subKey}`, note[key][subKey]]);
          });
        } else {
          wsData.push([key, note[key]]);
        }
      }
    });

    return XLSX.utils.aoa_to_sheet(wsData);
  }

  private createSignaleticWorksheet(data: any): XLSX.WorkSheet {
    const wsData: any[][] = [[data.title || "FICHE"], [""]];

    Object.keys(data).forEach((key) => {
      if (key !== "title") {
        if (typeof data[key] === "object" && !Array.isArray(data[key])) {
          wsData.push([key.toUpperCase(), ""]);
          Object.keys(data[key]).forEach((subKey) => {
            wsData.push([`  ${subKey}`, data[key][subKey]]);
          });
        } else if (Array.isArray(data[key])) {
          wsData.push([key.toUpperCase(), `${data[key].length} éléments`]);
        } else {
          wsData.push([key, data[key]]);
        }
      }
    });

    return XLSX.utils.aoa_to_sheet(wsData);
  }

  // New functions for processing DSF configs and generating reports

  /**
   * Generic function to generate a report from account mappings
   */
  private generateReportFromMappings(
    n: any[],
    n1: any[],
    folder: FolderWithRelations,
    accountMappings: any[],
    baseReportData: any
  ): any {
    const reportData = { ...baseReportData };

    accountMappings.forEach((mapping: any) => {
      const valueN = this.getBalanceValue(
        n,
        folder,
        mapping.accountNumber,
        mapping.source
      );
      const valueN1 = n1
        ? this.getBalanceValue(
            n1,
            folder,
            mapping.accountNumber,
            mapping.source
          )
        : 0;

      // Apply the value to the destination in the report data
      this.applyValueToReport(reportData, mapping.destination, valueN, valueN1);
    });

    return reportData;
  }

  /**
   * Apply value to report data based on destination path
   */
  private applyValueToReport(
    reportData: any,
    destination: string,
    valueN: number,
    valueN1?: number
  ): void {
    const keys = destination.split(".");
    let current = reportData;

    for (let i = 0; i < keys.length - 1; i++) {
      if (!current[keys[i]]) {
        current[keys[i]] = {};
      }
      current = current[keys[i]];
    }

    const lastKey = keys[keys.length - 1];

    if (
      valueN1 !== undefined &&
      typeof current[lastKey] === "object" &&
      current[lastKey] !== null
    ) {
      // If it's an object with n and n1 properties
      if ("n" in current[lastKey]) {
        current[lastKey].n = valueN;
      }
      if ("n1" in current[lastKey]) {
        current[lastKey].n1 = valueN1;
      }
    } else {
      // Direct assignment
      current[lastKey] = valueN;
    }
  }

  // Functions for generating notes from DSF configs

  private async generateNote1FromConfig(
    n: any[],
    folder: FolderWithRelations,
    accountMappings: any[]
  ): Promise<any> {
    const baseData = {
      title: "DETTES GARANTIES PAR DES SURETES REELLES",
      raisonSociale: folder.client.name,
      formeJuridique: folder.client.legalForm,
      activitePrincipale: "À compléter",
      effectif: 0,
      dettesGaranties: [],
    };

    const reportData = this.generateReportFromMappings(
      n,
      [],
      folder,
      accountMappings,
      baseData
    );

    // Process dettesGaranties array
    const dettesGaranties = accountMappings
      .filter((mapping) => mapping.destination.startsWith("dettesGaranties."))
      .map((mapping) => ({
        compte: mapping.accountNumber,
        montant: this.getBalanceValue(
          n,
          folder,
          mapping.accountNumber,
          mapping.source
        ),
        garantie:
          mapping.libelle ||
          mapping.destination.split(".").pop() ||
          "À préciser",
      }));

    reportData.dettesGaranties = dettesGaranties;

    return reportData;
  }

  private async generateNote3AFromConfig(
    n: any[],
    folder: FolderWithRelations,
    accountMappings: any[]
  ): Promise<any> {
    const baseData = {
      title: "IMMOBILISATIONS BRUTES",
      immobilisationsIncorporelles: 0,
      immobilisationsCorporelles: 0,
      immobilisationsFinancieres: 0,
      total: 0,
    };

    const reportData = this.generateReportFromMappings(
      n,
      [],
      folder,
      accountMappings,
      baseData
    );

    // Calculate total
    reportData.total =
      reportData.immobilisationsIncorporelles +
      reportData.immobilisationsCorporelles +
      reportData.immobilisationsFinancieres;

    return reportData;
  }

  private async generateNote4FromConfig(
    n: any[],
    n1: any[],
    folder: FolderWithRelations,
    accountMappings: any[]
  ): Promise<any> {
    const baseData = {
      title: "IMMOBILISATIONS FINANCIERES",
      titresDeParticipation: { n: 0, n1: 0 },
      autresTitres: { n: 0, n1: 0 },
      pretsEtCreances: { n: 0, n1: 0 },
      total: { n: 0, n1: 0 },
    };

    const reportData = this.generateReportFromMappings(
      n,
      n1,
      folder,
      accountMappings,
      baseData
    );

    // Calculate totals
    reportData.total.n =
      reportData.titresDeParticipation.n +
      reportData.autresTitres.n +
      reportData.pretsEtCreances.n;
    reportData.total.n1 =
      reportData.titresDeParticipation.n1 +
      reportData.autresTitres.n1 +
      reportData.pretsEtCreances.n1;

    return reportData;
  }

  private async generateNote7FromConfig(
    n: any[],
    n1: any[],
    folder: FolderWithRelations,
    accountMappings: any[]
  ): Promise<any> {
    const baseData = {
      title: "CLIENTS",
      clientsOrdinaires: { n: 0, n1: 0 },
      clientsDouteux: { n: 0, n1: 0 },
      creancesSurCessions: { n: 0, n1: 0 },
      provisionsClients: { n: 0, n1: 0 },
      total: { n: 0, n1: 0 },
    };

    const reportData = this.generateReportFromMappings(
      n,
      n1,
      folder,
      accountMappings,
      baseData
    );

    // Calculate totals
    reportData.total.n =
      reportData.clientsOrdinaires.n +
      reportData.clientsDouteux.n +
      reportData.creancesSurCessions.n -
      reportData.provisionsClients.n;
    reportData.total.n1 =
      reportData.clientsOrdinaires.n1 +
      reportData.clientsDouteux.n1 +
      reportData.creancesSurCessions.n1 -
      reportData.provisionsClients.n1;

    return reportData;
  }

  // Functions for generating tax reports from DSF configs

  private async generateCF1FromConfig(
    n: any[],
    folder: FolderWithRelations,
    accountMappings: any[]
  ): Promise<any> {
    const baseData = {
      headerInfo: {
        entityName: folder.client.name,
        fiscalYear: folder.fiscalYear.toString(),
        idNumber: folder.client.taxNumber || "",
        duration: "12",
      },
      rows: [
        {
          id: "1",
          label: "Bénéfice net comptable avant impôt",
          line: 1,
          amount: this.getAccountBalance(n, "13"),
        },
        { id: "2", label: "Amortissement non déductible", line: 3, amount: 0 },
        {
          id: "3",
          label:
            "Amortissement comptable mais réputes différés en période déficitaire",
          line: 4,
          amount: 0,
        },
        { id: "4", label: "Provisions non déductibles", line: 5, amount: 0 },
        {
          id: "5",
          label: "Intérêt excédentaires des comptes courants d'associés",
          line: 6,
          amount: 0,
        },
        {
          id: "6",
          label: "Frais de siège et d'assistance technique",
          line: 7,
          amount: 0,
        },
        {
          id: "7",
          label: "Impôt non déductibles autres qu'impôt sur le résultat",
          line: 8,
          amount: 0,
        },
        {
          id: "8",
          label: "Amendes et pénalités non déductibles",
          line: 9,
          amount: 0,
        },
        {
          id: "9",
          label: "Pourboires et dons non déductibles",
          line: 10,
          amount: 0,
        },
        {
          id: "10",
          label: "Revenu à la source(IRMC) sur revenus des capitaux mobiliers",
          line: 12,
          amount: 0,
        },
        { id: "11", label: "Divers 1", line: 13, amount: 0 },
        { id: "12", label: "Divers 2", line: 14, amount: 0 },
        { id: "13", label: "Divers 3", line: 15, amount: 0 },
        {
          id: "14",
          label:
            "Total intermédiaire POSITIF : ligne 15=lignes1ou ligne15ligne2",
          line: 16,
          amount: 0,
        },
        {
          id: "15",
          label: "Total intermédiaire NEGATIF : ligne2=lignes 15",
          line: 17,
          amount: 0,
        },
        {
          id: "16",
          label: "Amortissement antérieur différés et imputés sur l'exercice",
          line: 18,
          amount: 0,
        },
        {
          id: "17",
          label:
            "Provisions antérieurement taxées ou définitivement exonérées réintégrées dans",
          line: 19,
          amount: 0,
        },
        {
          id: "18",
          label:
            "Fraction non imposable des plus-values réalisées en fin d'explication",
          line: 20,
          amount: 0,
        },
        {
          id: "19",
          label:
            "Produit net des filiales (après déduction de la quote-part de frais et charges)",
          line: 21,
          amount: 0,
        },
        {
          id: "20",
          label: "Autres revenus mobiliers déductibles",
          line: 22,
          amount: 0,
        },
        {
          id: "21",
          label: "Frais de siège et d'assistance technique déductible",
          line: 23,
          amount: 0,
        },
        { id: "22", label: "Divers 1", line: 24, amount: 0 },
        { id: "23", label: "Divers 2", line: 25, amount: 0 },
        { id: "24", label: "Total lignes 18 à 26", line: 27, amount: 0 },
        {
          id: "25",
          label: "BÉNÉFICE FISCAL DE L'EXERCICE : ligne 16 - ligne 27",
          line: 28,
          amount: 0,
        },
        {
          id: "26",
          label:
            "PERTE FISCALE DE L'EXERCICE : ligne 27 - ligne 16 ou ligne 17 +",
          line: 29,
          amount: 0,
        },
      ],
      rubriques: [
        {
          id: "1",
          label: "Impôt sur les sociétés",
          line: 31,
          minimum: "Minimum de perception",
          base: "30%",
          rate: "30%",
          principal: "",
        },
        {
          id: "2",
          label: "BIC et BNC",
          line: 32,
          minimum: "",
          base: "",
          rate: "22%",
          principal: "",
        },
        {
          id: "3",
          label: "",
          line: 33,
          minimum: "",
          base: "",
          rate: "",
          principal: "",
        },
        {
          id: "4",
          label: "Bénéfice artisanaux",
          line: 34,
          minimum: "",
          base: "",
          rate: "11%",
          principal: "",
        },
        {
          id: "5",
          label: "",
          line: 35,
          minimum: "",
          base: "",
          rate: "",
          principal: "",
        },
        {
          id: "6",
          label: "Bénéfices agricoles",
          line: 36,
          minimum: "",
          base: "",
          rate: "15%",
          principal: "",
        },
        {
          id: "7",
          label: "",
          line: 37,
          minimum: "",
          base: "",
          rate: "",
          principal: "",
        },
        {
          id: "8",
          label: "TOTAL lignes 32 à 38",
          line: 39,
          minimum: "",
          base: "",
          rate: "",
          principal: "",
        },
      ],
    };

    // Apply account mappings to CF1 rows
    accountMappings.forEach((mapping: any) => {
      const value = this.getBalanceValue(
        n,
        folder,
        mapping.accountNumber,
        mapping.source
      );
      const row = baseData.rows.find((r: any) => r.id === mapping.destination);
      if (row) {
        row.amount = value;
      }
    });

    // Calculate totals
    const reintegrationsSum = baseData.rows
      .slice(1, 13)
      .reduce((sum: number, row: any) => sum + row.amount, 0);
    const deductionsSum = baseData.rows
      .slice(15, 24)
      .reduce((sum: number, row: any) => sum + row.amount, 0);
    const beneficeFiscal = baseData.rows[13].amount - deductionsSum;
    const perteFiscal = deductionsSum - baseData.rows[13].amount;

    baseData.rows[12].amount = reintegrationsSum; // Line 15
    baseData.rows[23].amount = deductionsSum; // Line 27
    baseData.rows[24].amount = beneficeFiscal; // Line 28
    baseData.rows[25].amount = perteFiscal; // Line 29

    return baseData;
  }

  private async generateCF2FromConfig(
    n: any[],
    folder: FolderWithRelations,
    accountMappings: any[]
  ): Promise<any> {
    const ca = this.sumAccounts(n, ["70", "71"]);
    const tvaBrute = ca * 0.1925;
    const baseData = {
      title: "CALCUL DE REGULARISATION ANNUELLE DE LA TVA",
      chiffreAffairesHT: ca,
      tvaBrute,
      tvaDeductible: 0,
      tvaNette: tvaBrute,
    };

    // Apply account mappings
    accountMappings.forEach((mapping: any) => {
      const value = this.getBalanceValue(
        n,
        folder,
        mapping.accountNumber,
        mapping.source
      );
      if (mapping.destination === "tvaDeductible") {
        baseData.tvaDeductible = value;
        baseData.tvaNette = baseData.tvaBrute - value;
      }
    });

    return baseData;
  }

  private generateNote2FromConfig(): any {
    return {
      title: "INFORMATIONS OBLIGATOIRES",
      baseEvaluation: "Coûts historiques",
      methodesAmortissement: "Linéaire",
      methodesProvisions: "Au cas par cas",
    };
  }

  private generateNote3BFromConfig(n: any[], n1: any[]): any {
    const debutExercice = this.sumAccounts(n1, [
      "21",
      "22",
      "23",
      "24",
      "25",
      "26",
      "27",
    ]);
    const finExercice = this.sumAccounts(n, [
      "21",
      "22",
      "23",
      "24",
      "25",
      "26",
      "27",
    ]);

    return {
      title: "BIENS PRIS EN LOCATION ACQUISITION",
      debutExercice,
      acquisitions: 0,
      cessions: 0,
      finExercice,
      tableauDetails: [],
    };
  }

  private generateNote3CFromConfig(n: any[]): any {
    return {
      title: "IMMOBILISATIONS: AMORTISSEMENTS",
      amortissementsCumules: this.sumAccounts(n, [
        "281",
        "282",
        "283",
        "284",
        "285",
      ]),
      dotationsExercice: this.sumAccounts(n, ["681"]),
      reprisesExercice: 0,
    };
  }

  private generateNote5FromConfig(n: any[]): any {
    return {
      title: "ACTIF CIRCULANT HAO",
      actifCirculantHAO: this.sumAccounts(n, ["485"]),
      details: [],
    };
  }

  private generateNote6FromConfig(n: any[], n1: any[]): any {
    return {
      title: "STOCKS ET ENCOURS",
      marchandises: {
        n: this.sumAccounts(n, ["31"]),
        n1: this.sumAccounts(n1, ["31"]),
      },
      matieresPremieres: {
        n: this.sumAccounts(n, ["32"]),
        n1: this.sumAccounts(n1, ["32"]),
      },
      autresApprovisionnements: {
        n: this.sumAccounts(n, ["33"]),
        n1: this.sumAccounts(n1, ["33"]),
      },
      enCours: {
        n: this.sumAccounts(n, ["34", "35"]),
        n1: this.sumAccounts(n1, ["34", "35"]),
      },
      produitsFinis: {
        n: this.sumAccounts(n, ["36"]),
        n1: this.sumAccounts(n1, ["36"]),
      },
      total: {
        n: this.sumAccounts(n, [
          "31",
          "32",
          "33",
          "34",
          "35",
          "36",
          "37",
          "38",
        ]),
        n1: this.sumAccounts(n1, [
          "31",
          "32",
          "33",
          "34",
          "35",
          "36",
          "37",
          "38",
        ]),
      },
    };
  }

  private generateNote8FromConfig(n: any[], n1: any[]): any {
    return {
      title: "AUTRES CREANCES",
      fournisseursDebiteurs: {
        n: this.sumAccounts(n, ["4091", "4092"]),
        n1: this.sumAccounts(n1, ["4091", "4092"]),
      },
      personnel: {
        n: this.sumAccounts(n, [
          "421",
          "422",
          "423",
          "424",
          "425",
          "426",
          "427",
          "428",
        ]),
        n1: this.sumAccounts(n1, [
          "421",
          "422",
          "423",
          "424",
          "425",
          "426",
          "427",
          "428",
        ]),
      },
      etat: {
        n: this.sumAccounts(n, [
          "441",
          "442",
          "443",
          "444",
          "445",
          "446",
          "447",
        ]),
        n1: this.sumAccounts(n1, [
          "441",
          "442",
          "443",
          "444",
          "445",
          "446",
          "447",
        ]),
      },
      comptesDeLiaison: {
        n: this.sumAccounts(n, ["45"]),
        n1: this.sumAccounts(n1, ["45"]),
      },
      autresCreances: {
        n: this.sumAccounts(n, ["46", "47", "48"]),
        n1: this.sumAccounts(n1, ["46", "47", "48"]),
      },
      total: {
        n: this.sumAccounts(n, ["42", "43", "44", "45", "46", "47", "48"]),
        n1: this.sumAccounts(n1, ["42", "43", "44", "45", "46", "47", "48"]),
      },
    };
  }

  private generateNote9FromConfig(n: any[]): any {
    return {
      title: "TITRES DE PLACEMENT",
      titresDePlacement: this.sumAccounts(n, ["50"]),
      provisions: this.sumAccounts(n, ["590"]),
      valeurNette: this.calculateNet(n, ["50"], ["590"]),
    };
  }

  private generateNote10FromConfig(n: any[]): any {
    return {
      title: "VALEURS A ENCAISSER",
      effetsARecevoir: this.sumAccounts(n, ["413", "414"]),
      chequesAEncaisser: this.sumAccounts(n, ["513"]),
      couponsAEncaisser: this.sumAccounts(n, ["515"]),
      total: this.sumAccounts(n, ["413", "414", "513", "515"]),
    };
  }

  private generateNote11FromConfig(n: any[]): any {
    return {
      title: "DISPONIBILITES",
      banques: this.sumAccounts(n, ["521", "522", "523", "524", "526"]),
      ccp: this.sumAccounts(n, ["531"]),
      caisse: this.sumAccounts(n, ["57"]),
      regiesAvances: this.sumAccounts(n, ["58"]),
      total: this.sumAccounts(n, ["52", "53", "57", "58"]),
    };
  }

  private generateNote17FromConfig(n: any[]): any {
    return {
      title: "FOURNISSEURS D'EXPLOITATION",
      fournisseursOrdinaires: this.sumAccounts(n, ["401", "402"]),
      fournisseursEffetsAPayer: this.sumAccounts(n, ["403", "404", "405"]),
      fournisseursRetenues: this.sumAccounts(n, ["408"]),
      total: this.sumAccounts(n, [
        "401",
        "402",
        "403",
        "404",
        "405",
        "406",
        "408",
      ]),
    };
  }

  private generateNote18FromConfig(n: any[]): any {
    return {
      title: "DETTES FISCALES ET SOCIALES",
      dettesFiscales: {
        tva: this.sumAccounts(n, ["4431", "4432", "4433", "4434", "4435"]),
        impotsSurSalaires: this.sumAccounts(n, ["4471", "4472", "4473"]),
        impotsSurResultat: this.sumAccounts(n, ["444"]),
        autresImpots: this.sumAccounts(n, ["441", "442", "445", "446", "447"]),
      },
      dettesSociales: {
        cnps: this.sumAccounts(n, ["431", "432", "433"]),
        personnel: this.sumAccounts(n, [
          "421",
          "422",
          "423",
          "424",
          "425",
          "426",
          "427",
          "428",
        ]),
      },
      total: this.sumAccounts(n, ["42", "43", "44"]),
    };
  }

  private generateNote21FromConfig(n: any[], n1: any[]): any {
    return {
      title: "CHIFFRE D'AFFAIRES ET AUTRES PRODUITS",
      ventesMarchandises: {
        n: this.sumAccounts(n, ["701"]),
        n1: this.sumAccounts(n1, ["701"]),
      },
      ventesProduits: {
        n: this.sumAccounts(n, ["702", "703", "704"]),
        n1: this.sumAccounts(n1, ["702", "703", "704"]),
      },
      travaux: {
        n: this.sumAccounts(n, ["705"]),
        n1: this.sumAccounts(n1, ["705"]),
      },
      services: {
        n: this.sumAccounts(n, ["706", "707"]),
        n1: this.sumAccounts(n1, ["706", "707"]),
      },
      produitsDivers: {
        n: this.sumAccounts(n, ["708"]),
        n1: this.sumAccounts(n1, ["708"]),
      },
      rabaisRemises: {
        n: this.sumAccounts(n, ["709"]),
        n1: this.sumAccounts(n1, ["709"]),
      },
      total: {
        n: this.sumAccounts(n, ["70"]),
        n1: this.sumAccounts(n1, ["70"]),
      },
    };
  }

  private generateNote27AFromConfig(n: any[], n1: any[]): any {
    return {
      title: "CHARGES DE PERSONNEL",
      salairesEtTraitements: {
        n: this.sumAccounts(n, ["661", "662", "663", "664"]),
        n1: this.sumAccounts(n1, ["661", "662", "663", "664"]),
      },
      chargesSociales: {
        n: this.sumAccounts(n, ["665", "666", "667"]),
        n1: this.sumAccounts(n1, ["665", "666", "667"]),
      },
      autresCharges: {
        n: this.sumAccounts(n, ["668"]),
        n1: this.sumAccounts(n1, ["668"]),
      },
      total: {
        n: this.sumAccounts(n, ["66"]),
        n1: this.sumAccounts(n1, ["66"]),
      },
    };
  }

  private generateNote28FromConfig(n: any[]): any {
    return {
      title: "PROVISIONS ET DEPRECIATIONS INSCRITES AU BILAN",
      provisions: {
        exploitation: this.sumAccounts(n, ["691"]),
        financieres: this.sumAccounts(n, ["697"]),
        hao: this.sumAccounts(n, ["857"]),
      },
      depreciations: {
        exploitation: this.sumAccounts(n, ["691"]),
        financieres: this.sumAccounts(n, ["697"]),
        hao: this.sumAccounts(n, ["857"]),
      },
      total: this.sumAccounts(n, ["691", "697", "857"]),
    };
  }

  // Tax report functions

  private generateCF1BisFromConfig(n: any[]): any {
    return {
      title:
        "TABLEAU DE DETERMINATION DE L'IMPOT SUR LE RESULTAT: MINIMUM DE PERCEPTION",
      chiffreAffaires: this.sumAccounts(n, ["70", "71"]),
      minimumPerception: this.sumAccounts(n, ["70", "71"]) * 0.011,
    };
  }

  private generateCF1TerFromConfig(n: any[]): any {
    return {
      title: "MINIMUM DE PERCEPTION",
      chiffreAffairesHT: this.sumAccounts(n, ["70", "71"]),
      tauxMinimum: 0.011,
      minimumCalcule: this.sumAccounts(n, ["70", "71"]) * 0.011,
    };
  }

  private generateCF1QuaterFromConfig(): any {
    return {
      title:
        "RECAPITULATIF DES VERSEMENTS D'ACOMPTES ET DE RETENUES SUBIES D'IMPOT SOCIETE ET D'ERENCE",
      acomptesVerses: 0,
      retenuesSubies: 0,
      total: 0,
    };
  }

  private generateCF2BisFromConfig(): any {
    return {
      title: "RECAPITULATIF DES VERSEMENTS EFFECTUES ET RETENUS SUBIES",
      versementsMensuels: [],
      total: 0,
    };
  }

  private generateCF2TerFromConfig(): any {
    return {
      title: "SITUATION NETTE DE TVA",
      tvaDue: 0,
      tvaPayee: 0,
      solde: 0,
    };
  }

  /**
   * Generate all reports from DSF configs
   */
  async generateAllReportsFromConfigs(
    folder: FolderWithRelations,
    nData: any,
    n1Data: any
  ): Promise<any> {
    const n = nData.rows || [];
    const n1 = n1Data?.rows || [];

    // Get all DSF configs for this folder/client
    const configs = await this.getAllConfigsForFolder(folder);

    const reports: any = {};

    // Generate each report based on available configs
    for (const config of configs) {
      const accountMappings = config.accountMappings || [];

      switch (config.category.toLowerCase()) {
        case "note1":
          reports.note1 = await this.generateNote1FromConfig(
            n,
            folder,
            accountMappings
          );
          break;
        case "note3a":
          reports.note3A = await this.generateNote3AFromConfig(
            n,
            folder,
            accountMappings
          );
          break;
        case "note4":
          reports.note4 = await this.generateNote4FromConfig(
            n,
            n1,
            folder,
            accountMappings
          );
          break;
        case "note7":
          reports.note7 = await this.generateNote7FromConfig(
            n,
            n1,
            folder,
            accountMappings
          );
          break;
        case "cf1":
          reports.cf1 = await this.generateCF1FromConfig(
            n,
            folder,
            accountMappings
          );
          break;
        case "cf2":
          reports.cf2 = await this.generateCF2FromConfig(
            n,
            folder,
            accountMappings
          );
          break;
        // Add more cases for other notes and reports
        default:
          // For notes/reports without specific config-based generation, use default
          break;
      }
    }

    // Generate notes that don't have configs with default values
    reports.note2 = this.generateNote2FromConfig();
    reports.note3B = this.generateNote3BFromConfig(n, n1);
    reports.note3C = this.generateNote3CFromConfig(n);
    reports.note5 = this.generateNote5FromConfig(n);
    reports.note6 = this.generateNote6FromConfig(n, n1);
    reports.note8 = this.generateNote8FromConfig(n, n1);
    reports.note9 = this.generateNote9FromConfig(n);
    reports.note10 = this.generateNote10FromConfig(n);
    reports.note11 = this.generateNote11FromConfig(n);
    reports.note17 = this.generateNote17FromConfig(n);
    reports.note18 = this.generateNote18FromConfig(n);
    reports.note21 = this.generateNote21FromConfig(n, n1);
    reports.note27A = this.generateNote27AFromConfig(n, n1);
    reports.note28 = this.generateNote28FromConfig(n);

    // Generate tax reports
    reports.cf1Bis = this.generateCF1BisFromConfig(n);
    reports.cf1Ter = this.generateCF1TerFromConfig(n);
    reports.cf1Quater = this.generateCF1QuaterFromConfig();
    reports.cf2Bis = this.generateCF2BisFromConfig();
    reports.cf2Ter = this.generateCF2TerFromConfig();

    return reports;
  }

  /**
   * Get all DSF configs for a folder
   */
  private async getAllConfigsForFolder(
    folder: FolderWithRelations
  ): Promise<any[]> {
    // Import prisma here to avoid circular dependencies
    const { prisma } = require("../lib/prisma");

    // Get configs by folder ID
    const configs = await prisma.DSFComptableConfig.findMany({
      where: {
        OR: [
          { exerciseId: folder.id },
          { clientId: folder.clientId, exerciseId: null },
          { ownerType: "SYSTEM" },
        ],
        isActive: true,
      },
      include: {
        config: {
          include: {
            accountMappings: true,
          },
        },
      },
    });

    return configs.map((c) => ({
      ...c,
      category: c.config?.category || "unknown",
      accountMappings: c.accountMappings || [],
    }));
  }

  // Assurance-specific note generation methods
  private generateBilanActif(n: any[]): any {
    return {
      title: "Bilan Actif - Assurance",
      description: "État de l'actif pour les entreprises d'assurance",
      // Add specific logic for assurance bilan actif
    };
  }

  private generateBilanPassif(n: any[]): any {
    return {
      title: "Bilan Passif - Assurance",
      description: "État du passif pour les entreprises d'assurance",
      // Add specific logic for assurance bilan passif
    };
  }

  private generateCharges(n: any[]): any {
    return {
      title: "Charges d'Exploitation Assurance",
      description: "Charges d'exploitation spécifiques aux assurances",
      // Add specific logic for assurance charges
    };
  }

  private generateCompteGeneral(n: any[]): any {
    return {
      title: "Compte de Résultat Général",
      description: "État des résultats généraux pour assurances",
      // Add specific logic for assurance compte general
    };
  }

  private generateEtatC4(n: any[]): any {
    return {
      title: "État C4 Sectoriel",
      description: "État réglementaire C4 pour les assurances",
      // Add specific logic for assurance etat C4
    };
  }

  private generateEtatC11(n: any[]): any {
    return {
      title: "État C11 Sectoriel",
      description: "État réglementaire C11 pour les assurances",
      // Add specific logic for assurance etat C11
    };
  }

  private generateEtatC11Vie(n: any[]): any {
    return {
      title: "État C11 Vie Sectoriel",
      description: "État réglementaire C11 Vie pour les assurances",
      // Add specific logic for assurance etat C11 vie
    };
  }

  private generateProduits(n: any[]): any {
    return {
      title: "Produits d'Exploitation Assurance",
      description: "Produits d'exploitation spécifiques aux assurances",
      // Add specific logic for assurance produits
    };
  }

  // SMT-specific note generation methods
  private generateGrilleAnalyseNotesSMT(n: any[]): any {
    return {
      title: "Grille d'Analyse des Notes SMT",
      description:
        "Grille d'analyse structurée des notes pour les sociétés de microfinance",
      // Add specific logic for SMT grille analyse notes
    };
  }

  private generateModBilan(n: any[]): any {
    return {
      title: "Modèle de Bilan SMT",
      description: "Modèle de bilan pour les sociétés de microfinance",
      // Add specific logic for SMT mod bilan
    };
  }

  private generateNote1Smt(n: any[]): any {
    return {
      title: "Sommaire du Matériel SMT",
      description: "Sommaire du matériel, mobilier et cautions pour SMT",
      // Add specific logic for SMT note 1
    };
  }

  private generateNote2Smt(n: any[]): any {
    return {
      title: "États des Stocks SMT",
      description: "États des stocks pour les sociétés de microfinance",
      // Add specific logic for SMT note 2
    };
  }

  private generateNote3Smt(n: any[]): any {
    return {
      title: "Créances et Dettes SMT",
      description: "État des créances et dettes non échues pour SMT",
      // Add specific logic for SMT note 3
    };
  }

  private generateNote4Smt(n: any[]): any {
    return {
      title: "Journal Trésorerie SMT",
      description: "Journal des trésoreries pour les sociétés de microfinance",
      // Add specific logic for SMT note 4
    };
  }

  private generateNote5Smt(n: any[]): any {
    return {
      title: "Créances Impayées SMT",
      description: "Journal des sommes des créances impayées pour SMT",
      // Add specific logic for SMT note 5
    };
  }

  private generateNote6Smt(n: any[]): any {
    return {
      title: "Dettes à Payer SMT",
      description: "Journal des sommes des dettes à payer pour SMT",
      // Add specific logic for SMT note 6
    };
  }
}
