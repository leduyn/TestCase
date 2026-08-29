import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  // Gán created_by_id = executed_by_id cho các execution chưa có người tạo
  const r2 = await prisma.$executeRawUnsafe(
    `UPDATE test_executions SET created_by_id = executed_by_id WHERE created_by_id IS NULL AND executed_by_id IS NOT NULL`
  );
  console.log('Đã backfill created_by_id:', r2);

  console.log('Hoàn tất backfill.');
}

main()
  .catch((e) => {
    console.error('Lỗi backfill:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
