// Script to create DSF Mapping Configs for import process
// Run with: node create-dsf-mapping-configs.js

const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function createDSFMappingConfigs() {
  console.log("🛠️ Creating DSF Mapping Configs for import process...\n");

  try {
    // Define mapping configs for different note types
    const mappingConfigs = [
      {
        noteType: "note1",
        sheetNamePatterns: ["Note 1", "Note 1 ", "NOTE 1", "note 1"],
        fields: [
          {
            fieldId: "note1-dettes-financieres",
            fieldName: "Dettes Financières",
            libellePatterns: [
              "Emprunts obligataires",
              "dettes financières",
              "emprunts et dettes",
            ],
            accountPatterns: ["16", "17"],
          },
          {
            fieldId: "note1-dettes-location-acquisition",
            fieldName: "Dettes de Location-Acquisition",
            libellePatterns: [
              "crédit-bail",
              "location-vente",
              "location-acquisition",
            ],
            accountPatterns: ["18", "19"],
          },
          {
            fieldId: "note1-dettes-passif-circulant",
            fieldName: "Dettes du Passif Circulant",
            libellePatterns: [
              "fournisseurs",
              "clients",
              "personnel",
              "sécurité sociale",
              "état",
            ],
            accountPatterns: ["40", "41", "42", "43", "44"],
          },
        ],
      },
      {
        noteType: "note2",
        sheetNamePatterns: ["NOTE 2", "Note 2", "note 2"],
        fields: [
          {
            fieldId: "note2-capitaux-propres",
            fieldName: "Capitaux Propres",
            libellePatterns: ["capital social", "réserves", "résultat"],
            accountPatterns: ["10", "11", "12", "13", "14"],
          },
        ],
      },
      {
        noteType: "note3a",
        sheetNamePatterns: ["NOTE 3A", "Note 3A", "note 3a"],
        fields: [
          {
            fieldId: "note3a-immobilisations-brutes",
            fieldName: "Immobilisations Brutes",
            libellePatterns: ["immobilisations", "brut"],
            accountPatterns: [
              "20",
              "21",
              "22",
              "23",
              "24",
              "25",
              "26",
              "27",
              "28",
            ],
          },
        ],
      },
      // Add more configs as needed for other notes
    ];

    for (const configData of mappingConfigs) {
      console.log(`Creating config for ${configData.noteType}...`);

      // Create or update the mapping config
      const config = await prisma.dSFMappingConfig.upsert({
        where: { noteType: configData.noteType },
        update: {
          sheetNamePatterns: configData.sheetNamePatterns,
        },
        create: {
          noteType: configData.noteType,
          sheetNamePatterns: configData.sheetNamePatterns,
        },
      });

      console.log(`✅ Created/updated config for ${configData.noteType}`);

      // Create field mappings
      for (const fieldData of configData.fields) {
        // Check if it already exists
        const existing = await prisma.dSFFieldMapping.findFirst({
          where: {
            configId: config.id,
            fieldId: fieldData.fieldId,
          },
        });

        if (existing) {
          // Update existing
          await prisma.dSFFieldMapping.update({
            where: { id: existing.id },
            data: {
              fieldName: fieldData.fieldName,
              libellePatterns: fieldData.libellePatterns,
              accountPatterns: fieldData.accountPatterns,
            },
          });
        } else {
          // Create new
          await prisma.dSFFieldMapping.create({
            data: {
              configId: config.id,
              fieldId: fieldData.fieldId,
              fieldName: fieldData.fieldName,
              libellePatterns: fieldData.libellePatterns,
              accountPatterns: fieldData.accountPatterns,
            },
          });
        }
      }

      console.log(
        `✅ Created ${configData.fields.length} field mappings for ${configData.noteType}`
      );
    }

    console.log("\n🎉 DSF Mapping Configs created successfully!");
    console.log(
      "The DSF import process should now properly detect and process sheets."
    );
  } catch (error) {
    console.error("❌ Error creating DSF Mapping Configs:", error);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the script
createDSFMappingConfigs();
