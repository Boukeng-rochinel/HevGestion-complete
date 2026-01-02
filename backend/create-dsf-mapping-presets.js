// create-dsf-mapping-presets.js
const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

const mappingPresets = [
  {
    noteType: "note1",
    sheetNamePatterns: ["Note 1", "Note1", "NOTE 1"],
    description: "Standard OHADA Note 1 - Actif mapping",
    fields: [
      {
        fieldId: "total_actif",
        fieldName: "Total Actif",
        cellReference: "E6",
        dataType: "number",
        isRequired: true,
      },
      {
        fieldId: "immobilisations_incorporelles",
        fieldName: "Immobilisations incorporelles",
        headerPattern: "Immobilisations.*incorporelles",
        dataType: "number",
        isRequired: false,
      },
      {
        fieldId: "immobilisations_corporelles",
        fieldName: "Immobilisations corporelles",
        headerPattern: "Immobilisations.*corporelles",
        dataType: "number",
        isRequired: false,
      },
    ],
  },
  {
    noteType: "note2",
    sheetNamePatterns: ["Note 2", "Note2", "NOTE 2"],
    description: "Standard OHADA Note 2 - Passif mapping",
    fields: [
      {
        fieldId: "total_passif",
        fieldName: "Total Passif",
        cellReference: "F6",
        dataType: "number",
        isRequired: true,
      },
      {
        fieldId: "capitaux_propres",
        fieldName: "Capitaux propres",
        headerPattern: "Capitaux.*propres",
        dataType: "number",
        isRequired: false,
      },
    ],
  },
  {
    noteType: "note21",
    sheetNamePatterns: ["Note 21", "Note21", "NOTE 21"],
    description: "Note 21 - Chiffre d'affaires mapping",
    fields: [
      {
        fieldId: "chiffre_affaires_n",
        fieldName: "Chiffre d'affaires N",
        cellReference: "C5",
        dataType: "number",
        isRequired: true,
      },
      {
        fieldId: "chiffre_affaires_n1",
        fieldName: "Chiffre d'affaires N-1",
        cellReference: "D5",
        dataType: "number",
        isRequired: false,
      },
    ],
  },
];

async function createPresets() {
  console.log("Creating DSF mapping presets...");

  for (const preset of mappingPresets) {
    try {
      // Create the mapping config
      const config = await prisma.dSFMappingConfig.create({
        data: {
          noteType: preset.noteType,
          sheetNamePatterns: preset.sheetNamePatterns,
          isSystem: true,
          fields: {
            create: preset.fields,
          },
        },
      });

      // Create the preset
      await prisma.dSFMappingPreset.create({
        data: {
          name: `${preset.noteType} - ${preset.description}`,
          description: preset.description,
          configId: config.id,
          category: "OHADA",
          isPublic: true,
        },
      });

      console.log(`✅ Created preset for ${preset.noteType}`);
    } catch (error) {
      console.error(
        `❌ Error creating preset for ${preset.noteType}:`,
        error.message
      );
    }
  }

  console.log("DSF mapping presets creation completed!");
}

createPresets()
  .catch((e) => {
    console.error("Error creating presets:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
