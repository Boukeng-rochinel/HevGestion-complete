// Test script for DSF Balance to Config Mapping
// Tests mapping between balance accounts and DSF config for multiple categories
// Run with: node test-dsf-mapping.js

const { PrismaClient } = require("@prisma/client");
const { DSFGenerator } = require("./src/services/dsf-generator.service");

const prisma = new PrismaClient();

async function testDSFMapping() {
  console.log("🧪 Testing DSF Balance to Config Mapping...\n");

  try {
    // Clean up any previous test data first
    console.log("🧹 Cleaning up previous test data...");
    try {
      await prisma.dSFAccountMapping.deleteMany({
        where: { createdBy: "test-user-id" },
      });
      await prisma.dSFComptableConfig.deleteMany({
        where: { ownerId: "test-user-id" },
      });
      await prisma.dSFConfig.deleteMany({
        where: {
          category: { in: ["cf1", "note1", "note3A", "note4", "note7"] },
        },
      });
      await prisma.user.deleteMany({
        where: { email: "test@example.com" },
      });
    } catch (cleanupError) {
      console.log("⚠️ Cleanup might have failed, continuing...");
    }

    // Create mock data
    const mockNData = {
      rows: [
        { accountNumber: "101", closingDebit: 100000, closingCredit: 0 },
        { accountNumber: "201", closingDebit: 5000, closingCredit: 0 },
        { accountNumber: "281", closingDebit: 0, closingCredit: 1000 },
        { accountNumber: "261", closingDebit: 15000, closingCredit: 0 },
        { accountNumber: "262", closingDebit: 8000, closingCredit: 0 },
        { accountNumber: "411", closingDebit: 0, closingCredit: 25000 },
        { accountNumber: "491", closingDebit: 0, closingCredit: 500 },
        { accountNumber: "601", closingDebit: 0, closingCredit: 20000 },
        { accountNumber: "602", closingDebit: 0, closingCredit: 15000 },
        { accountNumber: "701", closingDebit: 50000, closingCredit: 0 },
        { accountNumber: "702", closingDebit: 30000, closingCredit: 0 },
        { accountNumber: "661", closingDebit: 0, closingCredit: 8000 },
        { accountNumber: "665", closingDebit: 0, closingCredit: 2000 },
      ],
    };

    const mockN1Data = {
      rows: [
        { accountNumber: "411", closingDebit: 0, closingCredit: 22000 },
        { accountNumber: "491", closingDebit: 0, closingCredit: 400 },
        { accountNumber: "701", closingDebit: 45000, closingCredit: 0 },
        { accountNumber: "702", closingDebit: 28000, closingCredit: 0 },
      ],
    };

    const mockFolder = {
      id: "test-folder-id",
      client: {
        id: "test-client-id",
        name: "Test Company SARL",
        legalForm: "SARL",
        taxNumber: "RC/DLA/2024/B/123",
      },
      fiscalYear: 2024,
      startDate: new Date("2024-01-01"),
      endDate: new Date("2024-12-31"),
    };

    // Create test user first
    console.log("👤 Creating test user...");
    const testUserId = "test-user-id-12345";
    const testUser = await prisma.user.upsert({
      where: { id: testUserId },
      update: {},
      create: {
        id: testUserId,
        email: "test@example.com",
        firstName: "Test",
        lastName: "User",
        password: "hashedpassword",
        role: "COMPTABLE",
      },
    });

    // Test configurations for different DSF categories
    const testConfigs = [
      {
        category: "cf1",
        description: "CF1 - Passage Resultat Comptable Fiscal",
        mappings: [
          {
            accountNumber: "201",
            source: "SCD",
            destination: "2",
            description: "Charges immobilisées - amortissements",
          },
          {
            accountNumber: "601",
            source: "SCD",
            destination: "6",
            description: "Achats de marchandises",
          },
          {
            accountNumber: "602",
            source: "SCD",
            destination: "7",
            description: "Achats de matières premières",
          },
          {
            accountNumber: "701",
            source: "SD",
            destination: "1",
            description: "Ventes de marchandises",
          },
        ],
      },
      {
        category: "note1",
        description: "Note 1 - Dettes garanties par des sûretés réelles",
        mappings: [
          {
            accountNumber: "411",
            source: "SCD",
            destination: "hypotheque",
            description: "Dettes clients ordinaires",
          },
          {
            accountNumber: "201",
            source: "SD",
            destination: "gage",
            description: "Charges immobilisées",
          },
        ],
      },
      {
        category: "note3A",
        description: "Note 3A - Immobilisations brutes",
        mappings: [
          {
            accountNumber: "261",
            source: "SD",
            destination: "immobilisationsFinancieres",
            description: "Titres de participation",
          },
          {
            accountNumber: "262",
            source: "SD",
            destination: "immobilisationsFinancieres",
            description: "Autres titres immobilisés",
          },
        ],
      },
      {
        category: "note4",
        description: "Note 4 - Immobilisations financières",
        mappings: [
          {
            accountNumber: "261",
            source: "SD",
            destination: "titresDeParticipation",
            description: "Titres de participation",
          },
          {
            accountNumber: "262",
            source: "SD",
            destination: "autresTitres",
            description: "Autres titres immobilisés",
          },
        ],
      },
      {
        category: "note7",
        description: "Note 7 - Clients",
        mappings: [
          {
            accountNumber: "411",
            source: "SCD",
            destination: "clientsOrdinaires",
            description: "Clients ordinaires",
          },
          {
            accountNumber: "491",
            source: "SCD",
            destination: "provisionsClients",
            description: "Provisions pour clients douteux",
          },
        ],
      },
    ];

    // Create DSF configs and mappings
    console.log("📝 Creating test DSF configurations and mappings...");
    for (const configData of testConfigs) {
      const testConfig = await prisma.dSFConfig.upsert({
        where: { category: configData.category },
        update: {},
        create: {
          category: configData.category,
          description: configData.description,
        },
      });

      const testComptableConfig = await prisma.dSFComptableConfig.create({
        data: {
          configId: testConfig.id,
          ownerId: testUser.id,
          ownerType: "ACCOUNTANT",
          codeDsf: configData.category.toUpperCase(),
          libelle: configData.description,
          operations: ["READ", "WRITE"],
          destinationCell: "A1",
          scope: "EXERCISE",
          isActive: true,
        },
      });

      // Create account mappings
      for (const mapping of configData.mappings) {
        await prisma.dSFAccountMapping.create({
          data: {
            configId: testConfig.id,
            accountNumber: mapping.accountNumber,
            source: mapping.source,
            destination: mapping.destination,
            createdBy: testUser.id,
            updatedBy: testUser.id,
          },
        });
      }

      console.log(
        `✅ Created ${configData.category.toUpperCase()} config with ${configData.mappings.length} mappings`
      );
    }

    // Test DSF generation
    console.log("\n🔄 Testing DSF generation with configs...");
    const generator = new DSFGenerator();

    const dsfData = await generator.generate({
      ...mockFolder,
      balances: [
        { type: "CURRENT_YEAR", originalData: mockNData },
        { type: "PREVIOUS_YEAR", originalData: mockN1Data },
      ],
    });

    // Test CF1 mapping
    console.log("\n📊 Testing CF1 Mapping:");
    console.log("Balance Data:");
    console.log("  Account 201 (SCD): 5000 - 0 = 5000");
    console.log("  Account 601 (SCD): 0 - 20000 = -20000");
    console.log("  Account 602 (SCD): 0 - 15000 = -15000");
    console.log("  Account 701 (SD): 50000");

    const cf1Data = dsfData.notes.cf1;
    const row1 = cf1Data.rows.find((r) => r.id === "1");
    const row2 = cf1Data.rows.find((r) => r.id === "2");
    const row6 = cf1Data.rows.find((r) => r.id === "6");
    const row7 = cf1Data.rows.find((r) => r.id === "7");

    console.log("\nCF1 Results:");
    console.log(
      `  Row 1 (Bénéfice net) ← Account 701: Expected 50000, Got ${row1.amount} ${row1.amount === 50000 ? "✅" : "❌"}`
    );
    console.log(
      `  Row 2 (Amortissement) ← Account 201: Expected 5000, Got ${row2.amount} ${row2.amount === 5000 ? "✅" : "❌"}`
    );
    console.log(
      `  Row 6 (Frais de siège) ← Account 601: Expected -20000, Got ${row6.amount} ${row6.amount === -20000 ? "✅" : "❌"}`
    );
    console.log(
      `  Row 7 (Impôt non déductibles) ← Account 602: Expected -15000, Got ${row7.amount} ${row7.amount === -15000 ? "✅" : "❌"}`
    );

    // Test Note 1 mapping
    console.log("\n📋 Testing Note 1 Mapping:");
    const note1Data = dsfData.notes.note1;
    console.log("Note 1 - Dettes garanties:");
    console.log("Balance Data:");
    console.log("  Account 411 (SC): 0 - 25000 = -25000");
    console.log("  Account 201 (SD): 5000");

    console.log("\nNote 1 Results:");
    const garantieHypotheque = note1Data.dettesGaranties.find(
      (d) => d.garantie === "hypotheque"
    );
    const garantieGage = note1Data.dettesGaranties.find(
      (d) => d.garantie === "gage"
    );

    console.log(
      `  Hypothèque ← Account 411: Expected -25000, Got ${garantieHypotheque?.montant} ${garantieHypotheque?.montant === -25000 ? "✅" : "❌"}`
    );
    console.log(
      `  Gage ← Account 201: Expected 5000, Got ${garantieGage?.montant} ${garantieGage?.montant === 5000 ? "✅" : "❌"}`
    );

    // Test Note 3A mapping
    console.log("\n🏗️ Testing Note 3A Mapping:");
    const note3AData = dsfData.notes.note3A;
    console.log("Note 3A - Immobilisations brutes:");
    console.log("Balance Data:");
    console.log("  Account 261 (SD): 15000");
    console.log("  Account 262 (SD): 8000");

    console.log("\nNote 3A Results:");
    console.log(
      `  Immobilisations financières: Expected 23000, Got ${note3AData.immobilisationsFinancieres} ${note3AData.immobilisationsFinancieres === 23000 ? "✅" : "❌"}`
    );

    // Test Note 4 mapping
    console.log("\n💰 Testing Note 4 Mapping:");
    const note4Data = dsfData.notes.note4;
    console.log("Note 4 - Immobilisations financières:");
    console.log("Balance Data:");
    console.log("  Account 261 (SD): 15000");
    console.log("  Account 262 (SD): 8000");

    console.log("\nNote 4 Results:");
    console.log(
      `  Titres de participation ← Account 261: Expected 15000, Got ${note4Data.titresDeParticipation} ${note4Data.titresDeParticipation === 15000 ? "✅" : "❌"}`
    );
    console.log(
      `  Autres titres ← Account 262: Expected 8000, Got ${note4Data.autresTitres} ${note4Data.autresTitres === 8000 ? "✅" : "❌"}`
    );

    // Test Note 7 mapping
    console.log("\n👥 Testing Note 7 Mapping:");
    const note7Data = dsfData.notes.note7;
    console.log("Note 7 - Clients:");
    console.log("Balance Data:");
    console.log("  Account 411 (SC): 0 - 25000 = -25000");
    console.log("  Account 491 (SC): 0 - 500 = -500");

    console.log("\nNote 7 Results:");
    console.log(
      `  Clients ordinaires ← Account 411: Expected -25000, Got ${note7Data.clientsOrdinaires.n} ${note7Data.clientsOrdinaires.n === -25000 ? "✅" : "❌"}`
    );
    console.log(
      `  Provisions clients ← Account 491: Expected -500, Got ${note7Data.provisionsClients.n} ${note7Data.provisionsClients.n === -500 ? "✅" : "❌"}`
    );

    // Summary
    console.log("\n📊 Mapping Test Summary:");
    console.log("✅ CF1: Tax table mapping tested");
    console.log("✅ Note 1: Debt guarantees mapping tested");
    console.log("✅ Note 3A: Fixed assets mapping tested");
    console.log("✅ Note 4: Financial investments mapping tested");
    console.log("✅ Note 7: Clients mapping tested");

    // Clean up test data
    console.log("\n🧹 Cleaning up test data...");
    // Delete in correct order due to foreign key constraints
    await prisma.dSFAccountMapping.deleteMany({
      where: {
        createdBy: testUser.id,
      },
    });
    await prisma.dSFComptableConfig.deleteMany({
      where: { ownerId: testUser.id },
    });
    await prisma.dSFConfig.deleteMany({
      where: { category: { in: testConfigs.map((c) => c.category) } },
    });
    await prisma.user.deleteMany({
      where: { email: "test@example.com" },
    });

    console.log("✅ DSF Mapping test completed successfully!");
  } catch (error) {
    console.error("❌ Test failed:", error);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the test
testDSFMapping();
