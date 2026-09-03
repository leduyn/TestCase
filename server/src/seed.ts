import dotenv from 'dotenv';
dotenv.config();

import { ensureDefaultAdmin } from './services/adminSeed';
import { ensureWorkflowSeed } from './services/workflowSeed';
import prisma from './config/database';

async function main() {
  console.log('🌱 Đang chạy Seed Database...');
  await ensureDefaultAdmin();
  await ensureWorkflowSeed();
  console.log('✅ Hoàn thành toàn bộ Seed Database.');
}

main()
  .catch((e) => {
    console.error('❌ Lỗi Seed Database:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
