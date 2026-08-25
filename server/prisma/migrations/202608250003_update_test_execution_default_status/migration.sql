-- Update existing UNTESTED executions to UNREVIEWED
UPDATE "test_executions" SET "status" = 'UNREVIEWED' WHERE "status" = 'UNTESTED';

-- AlterTable
ALTER TABLE "test_executions" ALTER COLUMN "status" SET DEFAULT 'UNREVIEWED';
