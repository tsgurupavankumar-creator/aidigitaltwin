-- Only ADDS columns (all optional or with defaults), one unique index and one foreign key.
-- No existing column, row or table is changed or removed.

-- Fix 2: accounts created with a password someone else knows must set their own on first login
ALTER TABLE "users" ADD COLUMN "mustChangePassword" BOOLEAN NOT NULL DEFAULT false;

-- Fix 8: quiz controls
ALTER TABLE "quizzes" ADD COLUMN "maxAttempts" INTEGER,
ADD COLUMN "opensAt" TIMESTAMP(3),
ADD COLUMN "closesAt" TIMESTAMP(3),
ADD COLUMN "isClosed" BOOLEAN NOT NULL DEFAULT false;

-- Fix 7: real assignment submissions
ALTER TABLE "submissions" ADD COLUMN "content" TEXT,
ADD COLUMN "link" TEXT;

-- Fix 9: recommendations about a specific concept, with a reason
ALTER TABLE "recommendations" ADD COLUMN "conceptId" TEXT,
ADD COLUMN "reason" TEXT,
ADD COLUMN "appliedAt" TIMESTAMP(3);

-- Fix 10: a weekly study plan without duplicates
ALTER TABLE "study_tasks" ADD COLUMN "scheduledFor" TIMESTAMP(3),
ADD COLUMN "completedAt" TIMESTAMP(3),
ADD COLUMN "recommendationId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "study_tasks_studyPlanId_recommendationId_key" ON "study_tasks"("studyPlanId", "recommendationId");

-- AddForeignKey
ALTER TABLE "recommendations" ADD CONSTRAINT "recommendations_conceptId_fkey" FOREIGN KEY ("conceptId") REFERENCES "concepts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "study_tasks" ADD CONSTRAINT "study_tasks_recommendationId_fkey" FOREIGN KEY ("recommendationId") REFERENCES "recommendations"("id") ON DELETE SET NULL ON UPDATE CASCADE;
