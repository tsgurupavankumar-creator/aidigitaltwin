-- AlterTable
ALTER TABLE "questions" ADD COLUMN     "syllabusTopicId" TEXT,
ALTER COLUMN "conceptId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "quizzes" ADD COLUMN     "ownerStudentId" TEXT,
ADD COLUMN     "syllabusId" TEXT;

-- AlterTable
ALTER TABLE "study_plans" ADD COLUMN     "syllabusId" TEXT;

-- AlterTable
ALTER TABLE "study_tasks" ADD COLUMN     "orderIndex" INTEGER,
ADD COLUMN     "reason" TEXT,
ADD COLUMN     "syllabusTopicId" TEXT,
ADD COLUMN     "title" TEXT,
ALTER COLUMN "conceptId" DROP NOT NULL;

-- CreateTable
CREATE TABLE "course_syllabi" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "originalFileName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "fileSizeBytes" INTEGER NOT NULL,
    "extractedText" TEXT,
    "parseStatus" TEXT NOT NULL DEFAULT 'PENDING',
    "parseError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "course_syllabi_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "syllabus_modules" (
    "id" TEXT NOT NULL,
    "syllabusId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "orderIndex" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "syllabus_modules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "syllabus_topics" (
    "id" TEXT NOT NULL,
    "moduleId" TEXT NOT NULL,
    "conceptId" TEXT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "orderIndex" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "syllabus_topics_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "course_syllabi_studentId_courseId_createdAt_idx" ON "course_syllabi"("studentId", "courseId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "course_syllabi_studentId_courseId_version_key" ON "course_syllabi"("studentId", "courseId", "version");

-- CreateIndex
CREATE INDEX "syllabus_modules_syllabusId_idx" ON "syllabus_modules"("syllabusId");

-- CreateIndex
CREATE UNIQUE INDEX "syllabus_modules_syllabusId_orderIndex_key" ON "syllabus_modules"("syllabusId", "orderIndex");

-- CreateIndex
CREATE INDEX "syllabus_topics_moduleId_idx" ON "syllabus_topics"("moduleId");

-- CreateIndex
CREATE INDEX "syllabus_topics_conceptId_idx" ON "syllabus_topics"("conceptId");

-- CreateIndex
CREATE UNIQUE INDEX "syllabus_topics_moduleId_orderIndex_key" ON "syllabus_topics"("moduleId", "orderIndex");

-- CreateIndex
CREATE INDEX "questions_syllabusTopicId_idx" ON "questions"("syllabusTopicId");

-- CreateIndex
CREATE INDEX "quizzes_ownerStudentId_createdAt_idx" ON "quizzes"("ownerStudentId", "createdAt");

-- CreateIndex
CREATE INDEX "quizzes_syllabusId_idx" ON "quizzes"("syllabusId");

-- CreateIndex
CREATE INDEX "study_tasks_syllabusTopicId_orderIndex_idx" ON "study_tasks"("syllabusTopicId", "orderIndex");

-- AddForeignKey
ALTER TABLE "course_syllabi" ADD CONSTRAINT "course_syllabi_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "course_syllabi" ADD CONSTRAINT "course_syllabi_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "courses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "syllabus_modules" ADD CONSTRAINT "syllabus_modules_syllabusId_fkey" FOREIGN KEY ("syllabusId") REFERENCES "course_syllabi"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "syllabus_topics" ADD CONSTRAINT "syllabus_topics_moduleId_fkey" FOREIGN KEY ("moduleId") REFERENCES "syllabus_modules"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "syllabus_topics" ADD CONSTRAINT "syllabus_topics_conceptId_fkey" FOREIGN KEY ("conceptId") REFERENCES "concepts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quizzes" ADD CONSTRAINT "quizzes_ownerStudentId_fkey" FOREIGN KEY ("ownerStudentId") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quizzes" ADD CONSTRAINT "quizzes_syllabusId_fkey" FOREIGN KEY ("syllabusId") REFERENCES "course_syllabi"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "questions" ADD CONSTRAINT "questions_syllabusTopicId_fkey" FOREIGN KEY ("syllabusTopicId") REFERENCES "syllabus_topics"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "study_plans" ADD CONSTRAINT "study_plans_syllabusId_fkey" FOREIGN KEY ("syllabusId") REFERENCES "course_syllabi"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "study_tasks" ADD CONSTRAINT "study_tasks_syllabusTopicId_fkey" FOREIGN KEY ("syllabusTopicId") REFERENCES "syllabus_topics"("id") ON DELETE SET NULL ON UPDATE CASCADE;

