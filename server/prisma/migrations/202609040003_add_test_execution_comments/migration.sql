-- CreateTable
CREATE TABLE IF NOT EXISTS "test_execution_comments" (
    "id" TEXT NOT NULL,
    "execution_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "attachments" JSONB DEFAULT '[]',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "test_execution_comments_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'test_execution_comments_execution_id_fkey'
    ) THEN
        ALTER TABLE "test_execution_comments" ADD CONSTRAINT "test_execution_comments_execution_id_fkey" FOREIGN KEY ("execution_id") REFERENCES "test_executions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

-- AddForeignKey
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'test_execution_comments_user_id_fkey'
    ) THEN
        ALTER TABLE "test_execution_comments" ADD CONSTRAINT "test_execution_comments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;
