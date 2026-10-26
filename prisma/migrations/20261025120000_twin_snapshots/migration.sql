-- CreateTable
CREATE TABLE "twin_snapshots" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "academicHealth" DOUBLE PRECISION NOT NULL,
    "performanceScore" DOUBLE PRECISION NOT NULL,
    "attendanceScore" DOUBLE PRECISION NOT NULL,
    "engagementScore" DOUBLE PRECISION NOT NULL,
    "knowledgeScore" DOUBLE PRECISION NOT NULL,
    "learningVelocity" DOUBLE PRECISION NOT NULL,
    "behaviorScore" DOUBLE PRECISION NOT NULL,
    "skillsScore" DOUBLE PRECISION NOT NULL,
    "riskScore" DOUBLE PRECISION,
    "riskLevel" "RiskLevel",
    "event" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "twin_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "twin_snapshots_studentId_createdAt_idx" ON "twin_snapshots"("studentId", "createdAt");

-- AddForeignKey
ALTER TABLE "twin_snapshots" ADD CONSTRAINT "twin_snapshots_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;
