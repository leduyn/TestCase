-- ============================================================
-- Migration: Phase 2 indexes for frequently queried fields
-- Date: 2026-09-11
-- Description: Add @@index for TestSuite/TestCase/TestExecution/
--   Task/Proposal/User and related tables to speed up
--   getSuites, getUserExecutionStats, cron overdue scans.
-- Prod note: deploy.sh runs `prisma migrate deploy` (blocking
--   CREATE INDEX). For large tables (>100k rows), prefer running
--   each statement manually with CONCURRENTLY off-peak first,
--   e.g. CREATE INDEX CONCURRENTLY IF NOT EXISTS ... ,
--   then let this migration no-op via IF NOT EXISTS.
-- ============================================================

-- TestSuite
CREATE INDEX IF NOT EXISTS "test_suites_created_at_idx" ON "test_suites"("created_at");
CREATE INDEX IF NOT EXISTS "test_suites_document_id_idx" ON "test_suites"("document_id");

-- TestCase
CREATE INDEX IF NOT EXISTS "test_cases_test_suite_id_idx" ON "test_cases"("test_suite_id");
CREATE INDEX IF NOT EXISTS "test_cases_review_status_idx" ON "test_cases"("review_status");
CREATE INDEX IF NOT EXISTS "test_cases_test_suite_id_review_status_idx" ON "test_cases"("test_suite_id", "review_status");

-- TestExecution
CREATE INDEX IF NOT EXISTS "test_executions_test_case_id_idx" ON "test_executions"("test_case_id");
CREATE INDEX IF NOT EXISTS "test_executions_test_case_id_executed_at_idx" ON "test_executions"("test_case_id", "executed_at");
CREATE INDEX IF NOT EXISTS "test_executions_executed_by_id_idx" ON "test_executions"("executed_by_id");
CREATE INDEX IF NOT EXISTS "test_executions_created_by_id_idx" ON "test_executions"("created_by_id");
CREATE INDEX IF NOT EXISTS "test_executions_status_idx" ON "test_executions"("status");
CREATE INDEX IF NOT EXISTS "test_executions_executed_at_idx" ON "test_executions"("executed_at");

-- Watchers / History / Images / Comments
CREATE INDEX IF NOT EXISTS "test_execution_watchers_user_id_idx" ON "test_execution_watchers"("user_id");
CREATE INDEX IF NOT EXISTS "test_execution_histories_execution_id_idx" ON "test_execution_histories"("execution_id");
CREATE INDEX IF NOT EXISTS "test_execution_histories_test_case_id_idx" ON "test_execution_histories"("test_case_id");
CREATE INDEX IF NOT EXISTS "test_execution_images_execution_id_idx" ON "test_execution_images"("execution_id");
CREATE INDEX IF NOT EXISTS "test_execution_comments_execution_id_idx" ON "test_execution_comments"("execution_id");

-- Task (cron overdue scan: status + deadline)
CREATE INDEX IF NOT EXISTS "tasks_status_idx" ON "tasks"("status");
CREATE INDEX IF NOT EXISTS "tasks_deadline_idx" ON "tasks"("deadline");
CREATE INDEX IF NOT EXISTS "tasks_status_deadline_idx" ON "tasks"("status", "deadline");
CREATE INDEX IF NOT EXISTS "tasks_process_id_idx" ON "tasks"("process_id");
CREATE INDEX IF NOT EXISTS "tasks_current_step_id_idx" ON "tasks"("current_step_id");
CREATE INDEX IF NOT EXISTS "task_histories_task_id_idx" ON "task_histories"("task_id");
CREATE INDEX IF NOT EXISTS "todos_task_id_idx" ON "todos"("task_id");
CREATE INDEX IF NOT EXISTS "task_comments_task_id_idx" ON "task_comments"("task_id");

-- Proposal (deadline scan + filters)
CREATE INDEX IF NOT EXISTS "proposals_status_idx" ON "proposals"("status");
CREATE INDEX IF NOT EXISTS "proposals_deadline_idx" ON "proposals"("deadline");
CREATE INDEX IF NOT EXISTS "proposals_status_deadline_idx" ON "proposals"("status", "deadline");
CREATE INDEX IF NOT EXISTS "proposals_creator_id_idx" ON "proposals"("creator_id");
CREATE INDEX IF NOT EXISTS "proposals_proposal_type_id_idx" ON "proposals"("proposal_type_id");
CREATE INDEX IF NOT EXISTS "proposal_approvals_proposal_id_idx" ON "proposal_approvals"("proposal_id");
CREATE INDEX IF NOT EXISTS "proposal_approvals_approver_id_idx" ON "proposal_approvals"("approver_id");
CREATE INDEX IF NOT EXISTS "proposal_approvals_proposal_id_action_idx" ON "proposal_approvals"("proposal_id", "action");
CREATE INDEX IF NOT EXISTS "proposal_histories_proposal_id_idx" ON "proposal_histories"("proposal_id");
CREATE INDEX IF NOT EXISTS "proposal_comments_proposal_id_idx" ON "proposal_comments"("proposal_id");
CREATE INDEX IF NOT EXISTS "proposal_notifications_recipient_id_is_read_idx" ON "proposal_notifications"("recipient_id", "is_read");
CREATE INDEX IF NOT EXISTS "proposal_notifications_proposal_id_idx" ON "proposal_notifications"("proposal_id");

-- User (stats filter by role/status)
CREATE INDEX IF NOT EXISTS "users_role_idx" ON "users"("role");
CREATE INDEX IF NOT EXISTS "users_status_idx" ON "users"("status");
CREATE INDEX IF NOT EXISTS "users_role_status_idx" ON "users"("role", "status");
