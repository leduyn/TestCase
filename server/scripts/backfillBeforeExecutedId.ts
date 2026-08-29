import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const testCases = await prisma.testCase.findMany({
    select: { id: true },
  });

  let updated = 0;
  for (const tc of testCases) {
    const executions = await prisma.testExecution.findMany({
      where: { testCaseId: tc.id },
      orderBy: { executedAt: 'asc' },
      select: { id: true, executedById: true, beforeExecutedId: true },
    });

    for (let i = 1; i < executions.length; i++) {
      const prev = executions[i - 1];
      const cur = executions[i];
      if (!cur.beforeExecutedId && prev.executedById) {
        await prisma.testExecution.update({
          where: { id: cur.id },
          data: { beforeExecutedId: prev.executedById },
        });
        updated++;
      }
    }
  }

  console.log(`Đã backfill beforeExecutedId cho ${updated} execution(s).`);
}

main()
  .catch((e) => {
    console.error('Lỗi backfill:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
