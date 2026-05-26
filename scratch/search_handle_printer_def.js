import fs from 'fs';

const appPath = 'c:/Users/gerso/OneDrive/Área de Trabalho/PDV RESTAURANTE 2025/src/App.jsx';
const lines = fs.readFileSync(appPath, 'utf8').split('\n');

lines.forEach((line, idx) => {
  if (line.includes('const handlePrinterResponse') || line.includes('function handlePrinterResponse')) {
    console.log(`Line ${idx + 1}: ${line}`);
    // Print 30 lines
    for (let i = idx; i < Math.min(lines.length, idx + 30); i++) {
      console.log(`  ${i + 1}: ${lines[i]}`);
    }
  }
});
