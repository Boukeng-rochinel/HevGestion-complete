// Test file for Note1Generator service
const { Note1Generator } = require("./src/services/note1-generator.service");

async function testNote1Generator() {
  const generator = new Note1Generator();

  // Mock folder data
  const mockFolder = {
    client: {
      name: "Test Company SARL",
      taxNumber: "123456789",
    },
    startDate: new Date("2024-01-01"),
    endDate: new Date("2024-12-31"),
  };

  // Mock balance data
  const mockBalanceData = {
    rows: [
      {
        accountNumber: "161",
        closingDebit: 100000,
        closingCredit: 0,
      },
      {
        accountNumber: "162",
        closingDebit: 50000,
        closingCredit: 0,
      },
    ],
  };

  // Mock DSF config
  const mockDSFConfig = {
    category: "note1",
    accountMappings: [
      {
        accountNumber: "161",
        source: "SD",
        destination:
          "dettesFinancieres.Emprunts obligataires convertibles.montantBrut",
        libelle: "Emprunts obligataires convertibles",
      },
      {
        accountNumber: "162",
        source: "SD",
        destination:
          "dettesFinancieres.Autres emprunts obligataires.montantBrut",
        libelle: "Autres emprunts obligataires",
      },
    ],
  };

  try {
    console.log("Testing Note1Generator...");

    const note1Data = await generator.generateNote1(
      mockFolder,
      mockBalanceData,
      mockDSFConfig
    );

    console.log("Generated Note1 data:");
    console.log(JSON.stringify(note1Data, null, 2));

    console.log("✅ Note1 generation test completed successfully!");
  } catch (error) {
    console.error("❌ Error during Note1 generation test:", error);
  }
}

// Run the test
testNote1Generator();
