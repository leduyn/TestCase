CREATE TABLE "test_execution_images" (
    "id" TEXT NOT NULL,
    "execution_id" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "storage_path" TEXT NOT NULL,
    "storage_type" TEXT NOT NULL,
    "mime_type" TEXT NOT NULL,
    "file_size" INTEGER NOT NULL,
    "public_url" TEXT,
    "uploaded_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "test_execution_images_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "test_execution_images"
ADD CONSTRAINT "test_execution_images_execution_id_fkey"
FOREIGN KEY ("execution_id")
REFERENCES "test_executions"("id")
ON DELETE CASCADE
ON UPDATE CASCADE;
