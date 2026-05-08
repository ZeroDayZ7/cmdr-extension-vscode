const fs = require("fs");
const path = require("path");

const templatePath = path.join(__dirname, "../package.template.json");
const menusPath = path.join(__dirname, "../metadata/menus.json");
const outputPath = path.join(__dirname, "../package.json");

function buildManifest() {
  try {
    const template = JSON.parse(fs.readFileSync(templatePath, "utf8"));
    const menus = JSON.parse(fs.readFileSync(menusPath, "utf8"));

    template.contributes = menus;

    fs.writeFileSync(outputPath, JSON.stringify(template, null, 2), "utf8");

    console.log("✅ Success: package.json generated from metadata/menus.json");
  } catch (err) {
    console.error("❌ Error building package.json:", err.message);
    process.exit(1);
  }
}

buildManifest();
