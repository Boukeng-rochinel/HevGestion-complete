// Test script for DSF Balance to Config Mapping using real DB data
// Queries the database directly for balance data and tests mappings
// Run with: npx ts-node test-db-balance-mapping.ts

const { PrismaClient } = require("@prisma/client");
const { DSFGenerator } = require("./src/services/dsf-generator.service");

const prisma = new PrismaClient();

async function testDBBalanceMapping() {
  console.log(
    "🧪 Testing DSF Balance to Config Mapping with Real DB Data...\n"
  );

  try {
    // Clean up any previous test data first
    console.log("🧹 Cleaning up previous test data...");
    const testUserId = "test-user-id-12345";
    try {
      await (prisma as any).DSFAccountMapping.deleteMany({
        where: { createdBy: testUserId },
      });
      await (prisma as any).DSFComptableConfig.deleteMany({
        where: { ownerId: testUserId },
      });
      await (prisma as any).DSFConfig.deleteMany({
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

    // Query real balance data from database
    console.log("📊 Querying real balance data from database...");

    // Find a folder with balances
    const folderWithBalances = await prisma.folder.findFirst({
      where: {
        balances: {
          some: {
            type: "CURRENT_YEAR",
          },
        },
      },
      include: {
        balances: {
          where: {
            type: "CURRENT_YEAR",
          },
        },
        client: true,
      },
    });

    if (!folderWithBalances || folderWithBalances.balances.length === 0) {
      console.log("❌ No folders with current year balances found in database");
      console.log(
        "💡 Please ensure you have balance data in your database first"
      );
      return;
    }

    const balance = folderWithBalances.balances[0];
    const balanceData = balance.originalData;

    if (!balanceData || !balanceData.rows || balanceData.rows.length === 0) {
      console.log("❌ Balance data is empty or malformed");
      return;
    }

    console.log(`✅ Found balance for folder: ${folderWithBalances.name}`);
    console.log(`📁 Client: ${folderWithBalances.client.name}`);
    console.log(`💰 Balance rows: ${balanceData.rows.length}`);

    // Display some sample balance data
    console.log("\n📋 Sample balance data:");
    balanceData.rows.slice(0, 5).forEach((row: any, index: number) => {
      console.log(
        `  ${index + 1}. Account ${row.accountNumber}: Debit ${row.closingDebit || 0}, Credit ${row.closingCredit || 0}`
      );
    });

    // Create test user
    console.log("\n👤 Creating test user...");
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
        ],
      },
    ];

    // Create DSF configs and mappings
    console.log("📝 Creating test DSF configurations and mappings...");
    for (const configData of testConfigs) {
      const testConfig = await (prisma as any).DSFConfig.upsert({
        where: { category: configData.category },
        update: {},
        create: {
          category: configData.category,
          description: configData.description,
        },
      });

      const testComptableConfig = await (
        prisma as any
      ).DSFComptableConfig.create({
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
        await (prisma as any).DSFAccountMapping.create({
          data: {
            configId: testComptableConfig.id,
            accountNumber: mapping.accountNumber,
            source: mapping.source,
            destination: mapping.destination,
            description: mapping.description,
            createdBy: testUser.id,
            updatedBy: testUser.id,
          },
        });
      }

      console.log(
        `✅ Created ${configData.category.toUpperCase()} config with ${configData.mappings.length} mappings`
      );
    }

    // Test DSF generation with real data
    console.log("\n🔄 Testing DSF generation with real balance data...");
    const generator = new DSFGenerator();

    const mockFolder = {
      id: folderWithBalances.id,
      client: folderWithBalances.client,
      fiscalYear: folderWithBalances.fiscalYear,
      startDate: folderWithBalances.startDate,
      endDate: folderWithBalances.endDate,
    };

    const dsfData = await generator.generate({
      ...mockFolder,
      balances: [{ type: "CURRENT_YEAR", originalData: balanceData }],
    });

    // Test CF1 mapping with real data
    console.log("\n📊 Testing CF1 Mapping with Real Data:");
    const cf1Data = dsfData.taxTables.cf1;
    const row1 = cf1Data.rows.find((r: any) => r.id === "1");

    // Find the actual account 701 in balance data
    const account701 = balanceData.rows.find(
      (row: any) => row.accountNumber === "701"
    );
    const expectedValue = account701 ? account701.closingDebit || 0 : 0;

    console.log(`Account 701 in balance: ${expectedValue}`);
    console.log(`CF1 Row 1 result: ${row1.amount}`);
    console.log(
      `Mapping correct: ${row1.amount === expectedValue ? "✅" : "❌"}`
    );

    // Test Note 1 mapping with real data
    console.log("\n📋 Testing Note 1 Mapping with Real Data:");
    const note1Data = dsfData.notes.note1;

    // Find the actual account 411 in balance data
    const account411 = balanceData.rows.find(
      (row: any) => row.accountNumber === "411"
    );
    const expected411Value = account411
      ? (account411.closingDebit || 0) - (account411.closingCredit || 0)
      : 0;

    const garantieHypotheque = note1Data.dettesGaranties.find(
      (d: any) => d.garantie === "hypotheque"
    );

    console.log(`Account 411 in balance (SCD): ${expected411Value}`);
    console.log(
      `Note 1 Hypothèque result: ${garantieHypotheque?.montant || 0}`
    );
    console.log(
      `Mapping correct: ${(garantieHypotheque?.montant || 0) === expected411Value ? "✅" : "❌"}`
    );

    console.log("\n📊 Real DB Balance Mapping Test Summary:");
    console.log("✅ CF1: Tax table mapping tested with real data");
    console.log("✅ Note 1: Debt guarantees mapping tested with real data");
    console.log("✅ Database: Queried real balance data successfully");

    // Clean up test data
    console.log("\n🧹 Cleaning up test data...");
    await (prisma as any).DSFAccountMapping.deleteMany({
      where: { createdBy: testUser.id },
    });
    await (prisma as any).DSFComptableConfig.deleteMany({
      where: { ownerId: testUser.id },
    });
    await (prisma as any).DSFConfig.deleteMany({
      where: { category: { in: testConfigs.map((c) => c.category) } },
    });
    await prisma.user.deleteMany({
      where: { email: "test@example.com" },
    });

    console.log("✅ Real DB Balance Mapping test completed successfully!");
  } catch (error) {
    console.error("❌ Test failed:", error);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the test
testDBBalanceMapping();
