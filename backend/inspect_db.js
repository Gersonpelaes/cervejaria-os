import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const registers = await prisma.cashRegister.findMany();
  console.log("=== CAIXAS ENCONTRADOS ===");
  registers.forEach(r => {
    console.log(`Caixa ID: ${r.id}, Status: ${r.status}`);
    console.log(`Dados Reconciliação:`, r.reconciliationData);
    console.log("------------------------------------------");
  });
  await prisma.$disconnect();
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
