import fs from 'fs';

const appPath = 'c:/Users/gerso/OneDrive/Área de Trabalho/PDV RESTAURANTE 2025/src/App.jsx';
const lines = fs.readFileSync(appPath, 'utf8').split('\n');

lines.forEach((line, idx) => {
  if (line.includes('[printerConfig')) {
    console.log(`Line ${idx + 1}: ${line}`);
    // Print 10 lines
    for (let i = idx; i < Math.min(lines.length, idx + 10); i++) {
      console.log(`  ${i + 1}: ${lines[i]}`);
    }
  }
});
