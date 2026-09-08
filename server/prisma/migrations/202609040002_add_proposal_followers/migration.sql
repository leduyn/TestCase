-- AlterEnum
ALTER TYPE "ProposalHistoryType" ADD VALUE IF NOT EXISTS 'FOLLOWER_ADDED';
ALTER TYPE "ProposalHistoryType" ADD VALUE IF NOT EXISTS 'FOLLOWER_REMOVED';

-- AlterEnum
ALTER TYPE "ProposalNotificationType" ADD VALUE IF NOT EXISTS 'FOLLOWER_ADDED';

-- CreateTable
CREATE TABLE IF NOT EXISTS "proposal_followers" (
    "id" TEXT NOT NULL,
    "proposal_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "added_by_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "proposal_followers_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "proposal_followers_proposal_id_user_id_key" ON "proposal_followers"("proposal_id", "user_id");

-- AddForeignKey
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'proposal_followers_proposal_id_fkey'
    ) THEN
        ALTER TABLE "proposal_followers" ADD CONSTRAINT "proposal_followers_proposal_id_fkey" FOREIGN KEY ("proposal_id") REFERENCES "proposals"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

-- AddForeignKey
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'proposal_followers_user_id_fkey'
    ) THEN
        ALTER TABLE "proposal_followers" ADD CONSTRAINT "proposal_followers_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

-- AddForeignKey
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'proposal_followers_added_by_id_fkey'
    ) THEN
        ALTER TABLE "proposal_followers" ADD CONSTRAINT "proposal_followers_added_by_id_fkey" FOREIGN KEY ("added_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $$;
