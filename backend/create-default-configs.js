const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function createDefaultDSFConfigs() {
  try {
    const defaultConfigs = [
      {
        category: 'note1',
        systemConfig: {
          codeDsf: 'IMMO_CORP_001',
          libelle: 'Immobilisations corporelles - Bâtiments',
          operations: ['+20SC', '+21SC'],
          destinationCell: 'B5',
        }
      },
      {
        category: 'note3',
        systemConfig: {
          codeDsf: 'IMMO_FIN_001',
          libelle: 'Immobilisations financières - Titres',
          operations: ['+50SC', '+51SC'],
          destinationCell: 'B12',
        }
      },
      {
        category: 'note4',
        systemConfig: {
          codeDsf: 'STOCKS_001',
          libelle: 'Stocks de marchandises',
          operations: ['+31SD', '+32SD', '-39SC'],
          destinationCell: 'C5',
        }
      },
      {
        category: 'note5',
        systemConfig: {
          codeDsf: 'CREANCES_001',
          libelle: 'Créances clients',
          operations: ['+40SD', '+41SD'],
          destinationCell: 'D5',
        }
      },
      {
        category: 'note7',
        systemConfig: {
          codeDsf: 'DISPO_001',
          libelle: 'Disponibilités - Comptes bancaires',
          operations: ['+50SD', '+51SD', '+52SD'],
          destinationCell: 'E5',
        }
      }
    ];

    console.log('Creating default DSF configs...');

    for (const configData of defaultConfigs) {
      const existing = await prisma.dSFConfig.findUnique({
        where: { category: configData.category }
      });

      if (!existing) {
        await prisma.dSFConfig.create({
          data: {
            category: configData.category,
            systemConfig: {
              create: configData.systemConfig
            }
          }
        });
        console.log(`✅ Created config for category: ${configData.category}`);
      } else {
        console.log(`⚠️  Config already exists for category: ${configData.category}`);
      }
    }

    console.log('🎉 Default DSF configs creation completed');
  } catch (error) {
    console.error('❌ Error creating default configs:', error);
  } finally {
    await prisma.$disconnect();
  }
}

createDefaultDSFConfigs();