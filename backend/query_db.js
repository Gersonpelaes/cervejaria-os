import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  console.log("=== USERS ===");
  const users = await prisma.user.findMany();
  console.log(users);

  console.log("=== CASH REGISTERS ===");
  const cash = await prisma.cashRegister.findMany();
  console.log(cash);

  console.log("=== PAYMENTS ===");
  const payments = await prisma.payment.findMany();
  console.log(payments);

  console.log("=== ORDERS ===");
  const orders = await prisma.order.findMany({
    include: { items: true, payments: true }
  });
  console.log(orders);
}

main()
  .catch(e => console.error(e))
  .finally(async () => {
    await prisma.$disconnect();
  });
