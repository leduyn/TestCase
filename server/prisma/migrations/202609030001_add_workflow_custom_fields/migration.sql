-- AlterEnum
ALTER TYPE "TaskHistoryChangeType" ADD VALUE IF NOT EXISTS 'FIELD_UPDATED';

-- CreateTable
CREATE TABLE "custom_field_definitions" (
    "id" TEXT NOT NULL,
    "process_id" TEXT NOT NULL,
    "step_id" TEXT,
    "field_key" TEXT NOT NULL,
    "field_label" TEXT NOT NULL,
    "field_type" TEXT NOT NULL,
    "field_config" JSONB NOT NULL DEFAULT '{}',
    "is_required" BOOLEAN NOT NULL DEFAULT false,
    "default_value" JSONB,
    "placeholder" TEXT,
    "help_text" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "is_visible" BOOLEAN NOT NULL DEFAULT true,
    "visibility_condition" JSONB,
    "validation_rules" JSONB,
    "created_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_by" TEXT,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "custom_field_definitions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "task_custom_field_values" (
    "id" TEXT NOT NULL,
    "task_id" TEXT NOT NULL,
    "field_definition_id" TEXT NOT NULL,
    "value" JSONB,
    "step_id" TEXT,
    "filled_by_id" TEXT,
    "filled_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_by" TEXT,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "task_custom_field_values_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "custom_field_definitions_process_id_field_key_key" ON "custom_field_definitions"("process_id", "field_key");

-- CreateIndex
CREATE UNIQUE INDEX "task_custom_field_values_task_id_field_definition_id_key" ON "task_custom_field_values"("task_id", "field_definition_id");

-- AddForeignKey
ALTER TABLE "custom_field_definitions" ADD CONSTRAINT "custom_field_definitions_process_id_fkey" FOREIGN KEY ("process_id") REFERENCES "processes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "custom_field_definitions" ADD CONSTRAINT "custom_field_definitions_step_id_fkey" FOREIGN KEY ("step_id") REFERENCES "process_steps"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "custom_field_definitions" ADD CONSTRAINT "custom_field_definitions_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "custom_field_definitions" ADD CONSTRAINT "custom_field_definitions_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_custom_field_values" ADD CONSTRAINT "task_custom_field_values_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_custom_field_values" ADD CONSTRAINT "task_custom_field_values_field_definition_id_fkey" FOREIGN KEY ("field_definition_id") REFERENCES "custom_field_definitions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_custom_field_values" ADD CONSTRAINT "task_custom_field_values_step_id_fkey" FOREIGN KEY ("step_id") REFERENCES "process_steps"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_custom_field_values" ADD CONSTRAINT "task_custom_field_values_filled_by_id_fkey" FOREIGN KEY ("filled_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_custom_field_values" ADD CONSTRAINT "task_custom_field_values_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
