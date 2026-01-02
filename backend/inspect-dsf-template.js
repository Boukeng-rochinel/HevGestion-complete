const XLSX = require("xlsx");
const path = require("path");

// Path to the DSF template
const templatePath = path.join(
  __dirname,
  "upload",
  "templates",
  "dsf_complet.xlsx"
);

try {
  console.log("Inspecting DSF template:", templatePath);

  // Read the workbook
  const workbook = XLSX.readFile(templatePath);

  console.log("\n=== DSF TEMPLATE STRUCTURE ===");
  console.log("Number of sheets:", workbook.SheetNames.length);
  console.log("Sheet names:", workbook.SheetNames);

  // Inspect each sheet
  workbook.SheetNames.forEach((sheetName) => {
    const sheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(sheet, { header: 1 });

    console.log(`\n--- Sheet: ${sheetName} ---`);
    console.log(`Rows: ${data.length}`);

    if (data.length > 0) {
      console.log("First few rows:");
      for (let i = 0; i < Math.min(5, data.length); i++) {
        if (data[i] && data[i].length > 0) {
          console.log(`  Row ${i + 1}:`, data[i].slice(0, 5)); // First 5 columns
        }
      }
    }
  });
} catch (error) {
  console.error("Error reading DSF template:", error);
}
