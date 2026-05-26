import fs from 'fs';
import path from 'path';

const appPath = 'c:/Users/gerso/OneDrive/Área de Trabalho/PDV RESTAURANTE 2025/src/App.jsx';
const content = fs.readFileSync(appPath, 'utf8');
const lines = content.split('\n');

function searchPattern(pattern) {
  console.log(`=== Matches for: ${pattern} ===`);
  lines.forEach((line, idx) => {
    if (line.toLowerCase().includes(pattern.toLowerCase())) {
      console.log(`${idx + 1}: ${line.trim()}`);
    }
  });
}

searchPattern('printerResult');
searchPattern('/api/orders');
searchPattern('print-bill');
searchPattern('print-receipt');
searchPattern('checkout');
searchPattern('fechamento');
