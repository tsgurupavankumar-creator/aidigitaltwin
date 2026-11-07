-- v28 additive migration. REVIEW BEFORE applying to an isolated test database.
CREATE TYPE "TopicLevel" AS ENUM ('BEGINNER','INTERMEDIATE','ADVANCED');
ALTER TABLE "course_syllabi" ADD COLUMN "active" BOOLEAN NOT NULL DEFAULT true, ADD COLUMN "archivedAt" TIMESTAMP(3);
ALTER TABLE "syllabus_modules" ADD COLUMN "estimatedMinutes" INTEGER, ADD COLUMN "actualMinutes" INTEGER NOT NULL DEFAULT 0, ADD COLUMN "parseConfidence" DOUBLE PRECISION;
ALTER TABLE "syllabus_topics" ADD COLUMN "depth" INTEGER NOT NULL DEFAULT 0, ADD COLUMN "parentTopicId" TEXT, ADD COLUMN "prerequisiteIds" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[], ADD COLUMN "parseConfidence" DOUBLE PRECISION, ADD COLUMN "levelTarget" "TopicLevel" NOT NULL DEFAULT 'INTERMEDIATE', ADD COLUMN "estimatedMinutes" INTEGER, ADD COLUMN "actualMinutes" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "questions" ADD COLUMN "targetLevel" "TopicLevel", ADD COLUMN "questionHash" TEXT, ADD COLUMN "dedupKey" TEXT;
ALTER TABLE "quizzes" ADD COLUMN "targetDifficulty" "TopicLevel", ADD COLUMN "sessionKind" TEXT;
ALTER TABLE "quiz_attempts" ADD COLUMN "submissionKey" TEXT;
CREATE TABLE "topic_mastery" (
  "id" TEXT NOT NULL, "studentId" TEXT NOT NULL, "syllabusTopicId" TEXT NOT NULL, "difficulty" "TopicLevel" NOT NULL, "masteryScore" DOUBLE PRECISION NOT NULL DEFAULT 0, "attemptCount" INTEGER NOT NULL DEFAULT 0, "correctCount" INTEGER NOT NULL DEFAULT 0, "totalTimeSec" INTEGER NOT NULL DEFAULT 0, "lastAttemptAt" TIMESTAMP(3), "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL, CONSTRAINT "topic_mastery_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "course_syllabi_studentId_courseId_active_idx" ON "course_syllabi"("studentId","courseId","active");
CREATE INDEX "syllabus_topics_parentTopicId_idx" ON "syllabus_topics"("parentTopicId");
CREATE INDEX "syllabus_topics_moduleId_depth_idx" ON "syllabus_topics"("moduleId","depth");
CREATE INDEX "questions_syllabusTopicId_targetLevel_idx" ON "questions"("syllabusTopicId","targetLevel");
CREATE INDEX "questions_questionHash_idx" ON "questions"("questionHash");
CREATE UNIQUE INDEX "questions_dedupKey_key" ON "questions"("dedupKey");
CREATE UNIQUE INDEX "quiz_attempts_submissionKey_key" ON "quiz_attempts"("submissionKey");
CREATE INDEX "quizzes_sessionKind_targetDifficulty_idx" ON "quizzes"("sessionKind","targetDifficulty");
CREATE UNIQUE INDEX "topic_mastery_studentId_syllabusTopicId_difficulty_key" ON "topic_mastery"("studentId","syllabusTopicId","difficulty");
CREATE INDEX "topic_mastery_studentId_masteryScore_idx" ON "topic_mastery"("studentId","masteryScore");
CREATE INDEX "topic_mastery_syllabusTopicId_difficulty_idx" ON "topic_mastery"("syllabusTopicId","difficulty");
ALTER TABLE "syllabus_topics" ADD CONSTRAINT "syllabus_topics_parentTopicId_fkey" FOREIGN KEY ("parentTopicId") REFERENCES "syllabus_topics"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "topic_mastery" ADD CONSTRAINT "topic_mastery_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "topic_mastery" ADD CONSTRAINT "topic_mastery_syllabusTopicId_fkey" FOREIGN KEY ("syllabusTopicId") REFERENCES "syllabus_topics"("id") ON DELETE CASCADE ON UPDATE CASCADE;
