import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const users = await prisma.user.findMany();
  console.log("=== USERS ===");
  console.log(JSON.stringify(users, null, 2));

  const cash = await prisma.cashRegister.findMany();
  console.log("=== CASH REGISTERS ===");
  console.log(JSON.stringify(cash, null, 2));

  const paymentMethods = await prisma.paymentMethod.findMany();
  console.log("=== PAYMENT METHODS ===");
  console.log(JSON.stringify(paymentMethods, null, 2));

  // Count payments grouped by method
  const paymentsGrouped = await prisma.payment.groupBy({
    by: ['method'],
    _sum: {
      amount: true,
      feeAmount: true
    }
  });
  console.log("=== PAYMENTS GROUPED ===");
  console.log(JSON.stringify(paymentsGrouped, null, 2));
}

main()
  .catch(e => console.error(e))
  .finally(async () => {
    await prisma.$disconnect();
  });
