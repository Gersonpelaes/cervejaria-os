import fs from 'fs';

const appPath = 'c:/Users/gerso/OneDrive/Área de Trabalho/PDV RESTAURANTE 2025/src/App.jsx';
const lines = fs.readFileSync(appPath, 'utf8').split('\n');

for (let i = 0; i < 30; i++) {
  console.log(`${i+1}: ${lines[i]}`);
}
