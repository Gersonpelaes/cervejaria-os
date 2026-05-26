import fs from 'fs';

const appPath = 'c:/Users/gerso/OneDrive/Área de Trabalho/PDV RESTAURANTE 2025/src/App.jsx';
const lines = fs.readFileSync(appPath, 'utf8').split('\n');

lines.forEach((line, idx) => {
  if (line.includes('Editar Produto') || line.includes('Novo Produto') || line.includes('maxFlavors')) {
    console.log(`Line ${idx + 1}: ${line}`);
    if (line.includes('Editar Produto') || line.includes('Novo Produto')) {
      for (let i = Math.max(0, idx - 10); i < Math.min(lines.length, idx + 80); i++) {
        console.log(`  ${i + 1}: ${lines[i]}`);
      }
    }
  }
});
