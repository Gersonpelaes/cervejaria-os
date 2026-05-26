import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const registers = await prisma.cashRegister.findMany();
  for (const reg of registers) {
    console.log(`\n=================== REGISTER: ${reg.id} ===================`);
    console.log(`Opened: ${reg.openedAt}, Closed: ${reg.closedAt}`);
    console.log(`Initial Balance: ${reg.initialBalance}, Closing Balance: ${reg.closingBalance}, System Balance: ${reg.systemBalance}`);
    console.log(`Status: ${reg.status}`);

    // Fetch payments within this register's active period
    const start = new Date(reg.openedAt);
    const end = reg.closedAt ? new Date(reg.closedAt) : new Date();

    const payments = await prisma.payment.findMany({
      where: {
        createdAt: {
          gte: start,
          lte: end
        }
      }
    });

    console.log(`Payments during this period (${payments.length}):`);
    const summary = {};
    payments.forEach(p => {
      if (!summary[p.method]) summary[p.method] = 0;
      summary[p.method] += p.amount;
      console.log(`  - Method: ${p.method}, Amount: ${p.amount}, CreatedAt: ${p.createdAt}`);
    });
    console.log(`Summary:`, summary);
  }
}

main()
  .catch(e => console.error(e))
  .finally(async () => {
    await prisma.$disconnect();
  });
