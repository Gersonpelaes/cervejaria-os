import fs from 'fs';

const appPath = 'c:/Users/gerso/OneDrive/Área de Trabalho/PDV RESTAURANTE 2025/src/App.jsx';
const lines = fs.readFileSync(appPath, 'utf8').split('\n');

console.log("=== Active Tab Render Checks ===");
lines.forEach((line, idx) => {
  if (line.includes("activeTab ===") || line.includes("activeTab === '")) {
    console.log(`${idx + 1}: ${line.trim()}`);
  }
});

console.log("\n=== Navigation Menu ===");
lines.forEach((line, idx) => {
  if (line.includes("nav-item") || line.includes("sidebar")) {
    // Print 10 lines
    console.log(`${idx + 1}: ${line.trim()}`);
  }
});
