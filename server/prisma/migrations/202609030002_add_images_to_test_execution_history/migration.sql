-- AlterTable
ALTER TABLE "test_execution_histories" ADD COLUMN IF NOT EXISTS "images" JSONB DEFAULT '[]';
