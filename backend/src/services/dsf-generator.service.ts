// src/services/dsf-generator.service.ts
import { DSF, Folder, Balance, Client } from "@prisma/client";
import * as XLSX from "xlsx";
import * as path from "path";
import { config } from "../config";

interface DSFData {
  balanceSheet: any;
  incomeStatement: any;
  taxTables: any;
  notes: any;
  signaletics: any;
}

interface CoherenceResult {
  isCoherent: boolean;
  issues: any;
}

type FolderWithRelations = Folder & {
  client: Client;
  balances: (Balance & { fixedAssets?: any[]; equilibrium?: any })[];
};

export class DSFGenerator {
  async generate(folder: FolderWithRelations): Promise<DSFData> {
    const nBalance = folder.balances.find((b) => b.type === "CURRENT_YEAR");
    const n1Balance = folder.balances.find((b) => b.type === "PREVIOUS_YEAR");

    if (!nBalance) {
      throw new Error("Current year balance is required");
    }

    const nData = nBalance.originalData as any;
    const n1Data = n1Balance?.originalData as any;

    return {
      balanceSheet: this.generateBalanceSheet(nData, n1Data),
      incomeStatement: this.generateIncomeStatement(nData, n1Data),
      taxTables: this.generateTaxTables(nData, n1Data, folder),
      notes: this.generateAllNotes(nData, n1Data, nBalance, folder),
      signaletics: this.generateSignaletics(folder),
    };
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

  private generateAllNotes(
    nData: any,
    n1Data: any,
    nBalance: Balance,
    folder: FolderWithRelations
  ): any {
    const n = nData.rows || [];
    const n1 = n1Data?.rows || [];

    return {
      note1: this.generateNote1(folder),
      note2: this.generateNote2(),
      note3A: this.generateNote3A(n),
      note3B: this.generateNote3B(n, n1),
      note3C: this.generateNote3C(n),
      c1Note3C: this.generateC1Note3C(n),
      note3D: this.generateNote3D(n),
      note3E: this.generateNote3E(n),
      note3F: this.generateNote3F(n),
      note4: this.generateNote4(n, n1),
      note5: this.generateNote5(n),
      note6: this.generateNote6(n, n1),
      note7: this.generateNote7(n, n1),
      note8: this.generateNote8(n, n1),
      note9: this.generateNote9(n),
      note10: this.generateNote10(n),
      note11: this.generateNote11(n),
      note12: this.generateNote12(n),
      note13: this.generateNote13(folder),
      note14: this.generateNote14(n),
      note15A: this.generateNote15A(n),
      note15B: this.generateNote15B(n),
      note16A: this.generateNote16A(n),
      note16B: this.generateNote16B(n),
      note16BBis: this.generateNote16BBis(n),
      note16C: this.generateNote16C(n),
      note17: this.generateNote17(n),
      c1Note17: this.generateC1Note17(n),
      note18: this.generateNote18(n),
      note19: this.generateNote19(n),
      note20: this.generateNote20(n),
      note21: this.generateNote21(n, n1),
      note22: this.generateNote22(n, n1),
      note23: this.generateNote23(n, n1),
      note24: this.generateNote24(n, n1),
      note25: this.generateNote25(n),
      c1Note25: this.generateC1Note25(n),
      c2Note25: this.generateC2Note25(n),
      note26: this.generateNote26(n, n1),
      note27A: this.generateNote27A(n, n1),
      c1Note27A: this.generateC1Note27A(n),
      note27B: this.generateNote27B(n),
      note28: this.generateNote28(n),
      c1Note28: this.generateC1Note28(n),
      c2Note28: this.generateC2Note28(n),
      note29: this.generateNote29(n, n1),
      note30: this.generateNote30(n, n1),
      note31: this.generateNote31(n),
      note32: this.generateNote32(n),
      note33: this.generateNote33(n),
      note34: this.generateNote34(n),
      note35: this.generateNote35(),
      cf1: this.generateCF1(n),
    };
  }

  private generateNote1(folder: FolderWithRelations): any {
    return {
      title: "DETTES GARANTIES PAR DES SURETES REELLES",
      raisonSociale: folder.client.name,
      formeJuridique: folder.client.legalForm,
      activitePrincipale: "À compléter",
      effectif: 0,
      dettesGaranties: [],
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

  private generateNote3A(n: any[]): any {
    return {
      title: "IMMOBILISATIONS BRUTES",
      immobilisationsIncorporelles: this.sumAccounts(n, ["21"]),
      immobilisationsCorporelles: this.sumAccounts(n, ["22", "23", "24", "25"]),
      immobilisationsFinancieres: this.sumAccounts(n, ["26", "27"]),
      total: this.sumAccounts(n, ["21", "22", "23", "24", "25", "26", "27"]),
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

  private generateNote4(n: any[], n1: any[]): any {
    return {
      title: "IMMOBILISATIONS FINANCIERES",
      titresDeParticipation: this.sumAccounts(n, ["261", "262"]),
      autresTitres: this.sumAccounts(n, ["26", "27"]),
      pretsEtCreances: this.sumAccounts(n, ["274", "275", "276"]),
      total: this.sumAccounts(n, ["26", "27"]),
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

  private generateNote7(n: any[], n1: any[]): any {
    return {
      title: "CLIENTS",
      clientsOrdinaires: {
        n: this.sumAccounts(n, ["411"]),
        n1: this.sumAccounts(n1, ["411"]),
      },
      clientsDouteux: {
        n: this.sumAccounts(n, ["416"]),
        n1: this.sumAccounts(n1, ["416"]),
      },
      creancesSurCessions: {
        n: this.sumAccounts(n, ["4651", "4652"]),
        n1: this.sumAccounts(n1, ["4651", "4652"]),
      },
      provisionsClients: {
        n: this.sumAccounts(n, ["491"]),
        n1: this.sumAccounts(n1, ["491"]),
      },
      total: {
        n: this.calculateNet(n, ["411", "416"], ["491"]),
        n1: this.calculateNet(n1, ["411", "416"], ["491"]),
      },
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

  private generateCF1(n: any[]): any {
    const resultatComptable = this.getAccountBalance(n, "13");
    const reintegrations = 0;
    const deductions = 0;
    const resultatFiscal = resultatComptable + reintegrations - deductions;

    return {
      title:
        "TABLEAU DE PASSAGE DU RESULTAT COMPTABLE AVANT IMPOT AU RESULTAT FISCAL",
      resultatComptableAvantImpot: resultatComptable,
      reintegrations: {
        chargesNonDeductibles: 0,
        amendesEtPenalites: 0,
        chargesExcessives: 0,
        autresReintegrations: 0,
        totalReintegrations: reintegrations,
      },
      deductions: {
        provisionsExonerees: 0,
        plusValuesReinvesties: 0,
        deficitsReportes: 0,
        autresDeductions: 0,
        totalDeductions: deductions,
      },
      resultatFiscal,
      impotCalcule: Math.max(
        resultatFiscal * 0.3,
        this.sumAccounts(n, ["70", "71"]) * 0.011
      ),
    };
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
}
