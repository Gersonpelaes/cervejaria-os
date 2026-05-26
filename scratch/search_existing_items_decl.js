import fs from 'fs';

const appPath = 'c:/Users/gerso/OneDrive/Área de Trabalho/PDV RESTAURANTE 2025/src/App.jsx';
const lines = fs.readFileSync(appPath, 'utf8').split('\n');

lines.forEach((line, idx) => {
  if (line.includes('existingItems =') || line.includes('existingTotal =')) {
    console.log(`Line ${idx + 1}: ${line.trim()}`);
    // Print 15 lines
    for (let i = Math.max(0, idx - 5); i < Math.min(lines.length, idx + 15); i++) {
      console.log(`  ${i + 1}: ${lines[i]}`);
    }
  }
});
