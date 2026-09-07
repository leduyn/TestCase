-- CreateEnum
DO $$ BEGIN
    CREATE TYPE "NotificationType" AS ENUM ('TESTCASE_UPDATED', 'TESTCASE_REVIEWED', 'EXECUTION_COMMENT', 'EXECUTION_STATUS_CHANGED', 'EXECUTION_ASSIGNED', 'TASK_COMMENT', 'TASK_STATUS_CHANGED', 'TASK_STEP_CHANGED', 'TASK_ASSIGNED', 'TASK_OVERDUE', 'PROPOSAL_COMMENT', 'PROPOSAL_SUBMITTED', 'PROPOSAL_APPROVED', 'PROPOSAL_REJECTED', 'PROPOSAL_REMINDER', 'PROPOSAL_WORKFLOW_STARTED', 'PROPOSAL_FOLLOWER_ADDED');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- AlterTable
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "reset_password_expires" TIMESTAMP(3);
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "reset_password_token" TEXT;

-- CreateTable
CREATE TABLE IF NOT EXISTS "notifications" (
    "id" TEXT NOT NULL,
    "recipient_id" TEXT NOT NULL,
    "type" "NotificationType" NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "is_read" BOOLEAN NOT NULL DEFAULT false,
    "read_at" TIMESTAMP(3),
    "test_case_id" TEXT,
    "execution_id" TEXT,
    "task_id" TEXT,
    "proposal_id" TEXT,
    "metadata" JSONB DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "notifications_recipient_id_is_read_idx" ON "notifications"("recipient_id", "is_read");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "notifications_recipient_id_created_at_idx" ON "notifications"("recipient_id", "created_at");

-- AddForeignKey
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'notifications_recipient_id_fkey'
    ) THEN
        ALTER TABLE "notifications" ADD CONSTRAINT "notifications_recipient_id_fkey" FOREIGN KEY ("recipient_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

-- AddForeignKey
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'notifications_test_case_id_fkey'
    ) THEN
        ALTER TABLE "notifications" ADD CONSTRAINT "notifications_test_case_id_fkey" FOREIGN KEY ("test_case_id") REFERENCES "test_cases"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

-- AddForeignKey
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'notifications_execution_id_fkey'
    ) THEN
        ALTER TABLE "notifications" ADD CONSTRAINT "notifications_execution_id_fkey" FOREIGN KEY ("execution_id") REFERENCES "test_executions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

-- AddForeignKey
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'notifications_task_id_fkey'
    ) THEN
        ALTER TABLE "notifications" ADD CONSTRAINT "notifications_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

-- AddForeignKey
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'notifications_proposal_id_fkey'
    ) THEN
        ALTER TABLE "notifications" ADD CONSTRAINT "notifications_proposal_id_fkey" FOREIGN KEY ("proposal_id") REFERENCES "proposals"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;
