import dotenv from 'dotenv';
dotenv.config();

import { ensureDefaultAdmin } from '../src/services/adminSeed';
import { ensureWorkflowSeed } from '../src/services/workflowSeed';
import prisma from '../src/config/database';

async function main() {
  console.log('🌱 [Prisma Seed] Đang chạy Seed Database...');
  await ensureDefaultAdmin();
  await ensureWorkflowSeed();
  console.log('🎉 [Prisma Seed] Hoàn thành toàn bộ Seed Database.');
}

main()
  .catch((e) => {
    console.error('❌ [Prisma Seed] Thất bại:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });