-- CreateEnum
CREATE TYPE "TestCaseReviewStatus" AS ENUM ('UNREVIEWED', 'REVIEWED');

-- AlterEnum
BEGIN;
CREATE TYPE "TestExecutionStatus_new" AS ENUM ('UNTESTED', 'PASSED', 'FAILED', 'BLOCKED', 'RETEST');
ALTER TABLE "test_executions" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "test_executions" ALTER COLUMN "status" TYPE "TestExecutionStatus_new" USING ("status"::text::"TestExecutionStatus_new");
ALTER TABLE "test_execution_histories" ALTER COLUMN "status" TYPE "TestExecutionStatus_new" USING ("status"::text::"TestExecutionStatus_new");
ALTER TYPE "TestExecutionStatus" RENAME TO "TestExecutionStatus_old";
ALTER TYPE "TestExecutionStatus_new" RENAME TO "TestExecutionStatus";
DROP TYPE "TestExecutionStatus_old";
ALTER TABLE "test_executions" ALTER COLUMN "status" SET DEFAULT 'UNTESTED';
COMMIT;

-- AlterTable
ALTER TABLE "test_cases" ADD COLUMN     "review_status" "TestCaseReviewStatus" NOT NULL DEFAULT 'UNREVIEWED',
ADD COLUMN     "reviewed_at" TIMESTAMP(3),
ADD COLUMN     "reviewed_by_id" TEXT;

-- AlterTable
ALTER TABLE "test_executions" ADD COLUMN     "before_executed_id" TEXT,
ADD COLUMN     "created_by_id" TEXT,
ALTER COLUMN "status" SET DEFAULT 'UNTESTED';

-- CreateTable
CREATE TABLE "test_execution_watchers" (
    "id" TEXT NOT NULL,
    "execution_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "test_execution_watchers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "test_execution_histories" (
    "id" TEXT NOT NULL,
    "execution_id" TEXT NOT NULL,
    "test_case_id" TEXT NOT NULL,
    "executed_by_id" TEXT,
    "before_executed_id" TEXT,
    "created_by_id" TEXT,
    "server" TEXT,
    "os" TEXT,
    "status" "TestExecutionStatus" NOT NULL DEFAULT 'UNTESTED',
    "actual_result" TEXT,
    "evaluation" TEXT,
    "notes" TEXT,
    "executed_at" TIMESTAMP(3) NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "test_execution_histories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "execution_status_handlers" (
    "id" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "execution_status_handlers_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "test_execution_watchers_execution_id_user_id_key" ON "test_execution_watchers"("execution_id", "user_id");

-- CreateIndex
CREATE UNIQUE INDEX "execution_status_handlers_status_user_id_key" ON "execution_status_handlers"("status", "user_id");

-- AddForeignKey
ALTER TABLE "test_cases" ADD CONSTRAINT "test_cases_reviewed_by_id_fkey" FOREIGN KEY ("reviewed_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "test_executions" ADD CONSTRAINT "test_executions_before_executed_id_fkey" FOREIGN KEY ("before_executed_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "test_executions" ADD CONSTRAINT "test_executions_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "test_execution_watchers" ADD CONSTRAINT "test_execution_watchers_execution_id_fkey" FOREIGN KEY ("execution_id") REFERENCES "test_executions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "test_execution_watchers" ADD CONSTRAINT "test_execution_watchers_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "test_execution_histories" ADD CONSTRAINT "test_execution_histories_execution_id_fkey" FOREIGN KEY ("execution_id") REFERENCES "test_executions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "test_execution_histories" ADD CONSTRAINT "test_execution_histories_executed_by_id_fkey" FOREIGN KEY ("executed_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "test_execution_histories" ADD CONSTRAINT "test_execution_histories_before_executed_id_fkey" FOREIGN KEY ("before_executed_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "test_execution_histories" ADD CONSTRAINT "test_execution_histories_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "execution_status_handlers" ADD CONSTRAINT "execution_status_handlers_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

