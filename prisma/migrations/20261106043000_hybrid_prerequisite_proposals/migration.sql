-- ADDITIVE ONLY: keeps existing syllabi, topics, practice and mastery intact.
CREATE TABLE "prerequisite_proposals" (
 "id" TEXT NOT NULL,
 "syllabusId" TEXT NOT NULL,
 "courseId" TEXT NOT NULL,
 "targetTopicId" TEXT NOT NULL,
 "requiredTopicId" TEXT NOT NULL,
 "status" TEXT NOT NULL DEFAULT 'PENDING',
 "source" TEXT NOT NULL DEFAULT 'GROQ',
 "explanation" TEXT NOT NULL,
 "confidence" DOUBLE PRECISION,
 "reviewedBy" TEXT,
 "reviewedAt" TIMESTAMP(3),
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 "updatedAt" TIMESTAMP(3) NOT NULL,
 CONSTRAINT "prerequisite_proposals_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "prerequisite_proposals_syllabusId_targetTopicId_requiredTopicId_key" ON "prerequisite_proposals"("syllabusId", "targetTopicId", "requiredTopicId");
CREATE INDEX "prerequisite_proposals_courseId_status_idx" ON "prerequisite_proposals"("courseId", "status");
ALTER TABLE "prerequisite_proposals" ADD CONSTRAINT "prerequisite_proposals_syllabusId_fkey" FOREIGN KEY ("syllabusId") REFERENCES "course_syllabi"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "prerequisite_proposals" ADD CONSTRAINT "prerequisite_proposals_targetTopicId_fkey" FOREIGN KEY ("targetTopicId") REFERENCES "syllabus_topics"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "prerequisite_proposals" ADD CONSTRAINT "prerequisite_proposals_requiredTopicId_fkey" FOREIGN KEY ("requiredTopicId") REFERENCES "syllabus_topics"("id") ON DELETE CASCADE ON UPDATE CASCADE;
