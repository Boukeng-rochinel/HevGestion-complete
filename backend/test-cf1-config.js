// Test script for CF1 DSF Config integration
// Run with: node test-cf1-config.js

const { PrismaClient } = require("@prisma/client");
const { DSFGenerator } = require("./src/services/dsf-generator.service");

const prisma = new PrismaClient();

async function testCF1Config() {
  console.log("🧪 Testing CF1 DSF Config integration...\n");

  try {
    // Create mock data
    const mockNData = {
      rows: [
        { accountNumber: "101", closingDebit: 100000, closingCredit: 0 },
        { accountNumber: "201", closingDebit: 5000, closingCredit: 0 },
        { accountNumber: "281", closingDebit: 0, closingCredit: 1000 },
        { accountNumber: "601", closingDebit: 0, closingCredit: 20000 },
        { accountNumber: "602", closingDebit: 0, closingCredit: 15000 },
        { accountNumber: "701", closingDebit: 50000, closingCredit: 0 },
        { accountNumber: "702", closingDebit: 30000, closingCredit: 0 },
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
    const testUser = await prisma.user.upsert({
      where: { email: "test@example.com" },
      update: {},
      create: {
        email: "test@example.com",
        firstName: "Test",
        lastName: "User",
        password: "hashedpassword",
        role: "COMPTABLE",
      },
    });

    // Create test DSF config for CF1
    console.log("📝 Creating test CF1 configuration...");
    const testConfig = await prisma.dSFConfig.upsert({
      where: { category: "cf1" },
      update: {},
      create: {
        category: "cf1",
        description: "CF1 - Passage Resultat Comptable Fiscal",
      },
    });

    // Create test comptable config
    const testComptableConfig = await prisma.dSFComptableConfig.create({
      data: {
        configId: testConfig.id,
        ownerId: testUser.id,
        ownerType: "ACCOUNTANT",
        codeDsf: "CF1",
        libelle: "Tableau de Passage Resultat Comptable Fiscal",
        operations: ["READ", "WRITE"],
        destinationCell: "A1",
        scope: "EXERCISE",
        isActive: true,
      },
    });

    // Create account mappings to test balance -> CF1 mapping
    console.log("🔗 Creating account mappings...");
    const mappings = [
      {
        configId: testComptableConfig.id,
        accountNumber: "201",
        source: "SCD", // Closing Debit - Credit
        destination: "2", // CF1 Row 2: Amortissement non déductible
        description: "Charges immobilisées - amortissements",
      },
      {
        configId: testComptableConfig.id,
        accountNumber: "601",
        source: "SCD",
        destination: "6", // CF1 Row 6: Frais de siège
        description: "Achats de marchandises",
      },
      {
        configId: testComptableConfig.id,
        accountNumber: "602",
        source: "SCD",
        destination: "7", // CF1 Row 7: Impôt non déductibles
        description: "Achats de matières premières",
      },
      {
        configId: testComptableConfig.id,
        accountNumber: "701",
        source: "SD", // Closing Debit
        destination: "1", // CF1 Row 1: Bénéfice net comptable
        description: "Ventes de marchandises",
      },
    ];

    for (const mapping of mappings) {
      await prisma.dSFConfigMapping.create({ data: mapping });
    }

    console.log("✅ Test configuration and mappings created");
    console.log(`📊 Created ${mappings.length} account mappings`);

    // Test CF1 generation
    console.log("\n🔄 Testing CF1 generation with config...");
    const generator = new DSFGenerator();

    const cf1Data = await generator.generateCF1(mockNData.rows, mockFolder);

    console.log("📋 Generated CF1 data:");
    console.log("🏢 Entity:", cf1Data.headerInfo.entityName);
    console.log("📅 Fiscal Year:", cf1Data.headerInfo.fiscalYear);
    console.log("🆔 Tax Number:", cf1Data.headerInfo.idNumber);

    console.log("\n📊 CF1 Rows:");
    cf1Data.rows.forEach((row, index) => {
      if (row.amount !== 0) {
        console.log(
          `  Line ${row.line} (${row.id}): ${row.label} = ${row.amount}`
        );
      }
    });

    // Verify mappings were applied
    console.log("\n🔍 Verifying balance-to-CF1 mappings:");
    const mappedRow1 = cf1Data.rows.find((r) => r.id === "1"); // Bénéfice net comptable
    const mappedRow2 = cf1Data.rows.find((r) => r.id === "2"); // Amortissement non déductible
    const mappedRow6 = cf1Data.rows.find((r) => r.id === "6"); // Frais de siège
    const mappedRow7 = cf1Data.rows.find((r) => r.id === "7"); // Impôt non déductibles

    console.log("📊 Balance Data:");
    console.log("  Account 201 (SCD): 5000 - 0 = 5000");
    console.log("  Account 601 (SCD): 0 - 20000 = -20000");
    console.log("  Account 602 (SCD): 0 - 15000 = -15000");
    console.log("  Account 701 (SD): 50000");

    console.log("\n🔗 Mapping Results:");
    console.log(`  Row 1 (Bénéfice net) ← Account 701: Expected 50000, Got ${mappedRow1.amount} ${mappedRow1.amount === 50000 ? '✅' : '❌'}`);
    console.log(`  Row 2 (Amortissement) ← Account 201: Expected 5000, Got ${mappedRow2.amount} ${mappedRow2.amount === 5000 ? '✅' : '❌'}`);
    console.log(`  Row 6 (Frais de siège) ← Account 601: Expected -20000, Got ${mappedRow6.amount} ${mappedRow6.amount === -20000 ? '✅' : '❌'}`);
    console.log(`  Row 7 (Impôt non déductibles) ← Account 602: Expected -15000, Got ${mappedRow7.amount} ${mappedRow7.amount === -15000 ? '✅' : '❌'}`);

    // Check calculations
    console.log("\n🧮 Verifying calculations:");
    const reintegrationsSum = cf1Data.rows
      .slice(1, 13)
      .reduce((sum, row) => sum + row.amount, 0);
    const deductionsSum = cf1Data.rows
      .slice(15, 24)
      .reduce((sum, row) => sum + row.amount, 0);
    const beneficeFiscal = cf1Data.rows[13].amount - deductionsSum;
    const perteFiscal = deductionsSum - cf1Data.rows[13].amount;

    console.log(`  Reintegrations total (line 15): ${reintegrationsSum}`);
    console.log(`  Deductions total (line 27): ${deductionsSum}`);
    console.log(`  Fiscal benefit (line 28): ${beneficeFiscal}`);
    console.log(`  Fiscal loss (line 29): ${perteFiscal}`);

    // Verify totals match
    const calculatedLine15 = cf1Data.rows[12].amount;
    const calculatedLine27 = cf1Data.rows[23].amount;
    const calculatedLine28 = cf1Data.rows[24].amount;
    const calculatedLine29 = cf1Data.rows[25].amount;

    console.log("\n✅ Verification:");
    console.log(
      `  Line 15 calculation: ${calculatedLine15 === reintegrationsSum ? "PASS" : "FAIL"}`
    );
    console.log(
      `  Line 27 calculation: ${calculatedLine27 === deductionsSum ? "PASS" : "FAIL"}`
    );
    console.log(
      `  Line 28 calculation: ${calculatedLine28 === beneficeFiscal ? "PASS" : "FAIL"}`
    );
    console.log(
      `  Line 29 calculation: ${calculatedLine29 === perteFiscal ? "PASS" : "FAIL"}`
    );

    // Clean up test data
    console.log("\n🧹 Cleaning up test data...");
    await prisma.dSFComptableConfig.deleteMany({
      where: { ownerId: testUser.id },
    });
    await prisma.dSFConfig.deleteMany({
      where: { category: "cf1" },
    });
    await prisma.user.deleteMany({
      where: { email: "test@example.com" },
    });

    console.log("✅ Test completed successfully!");
  } catch (error) {
    console.error("❌ Test failed:", error);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the test
testCF1Config();
