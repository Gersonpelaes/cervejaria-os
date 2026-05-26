import fs from 'fs';

const appPath = 'c:/Users/gerso/OneDrive/Área de Trabalho/PDV RESTAURANTE 2025/src/App.jsx';
const lines = fs.readFileSync(appPath, 'utf8').split('\n');

lines.forEach((line, idx) => {
  if (line.includes('handlePrinterResponse')) {
    console.log(`Line ${idx + 1}: ${line}`);
    // Print 20 lines around the match
    for (let i = Math.max(0, idx - 5); i < Math.min(lines.length, idx + 35); i++) {
      console.log(`  ${i + 1}: ${lines[i]}`);
    }
  }
});
