import {
  ActionType, AccountStatus, AgentType, AlertSeverity, AlertType, AttendanceStatus,
  PrismaClient, Priority, QuestionType, RiskLevel, SubmissionStatus, Trend, UserRole,
} from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();
const dateAt = (day: number) => new Date(Date.UTC(2026, 7, day));

async function clearDevelopmentData() {
  await prisma.quizResponse.deleteMany();
  await prisma.question.deleteMany();
  await prisma.quizAttempt.deleteMany();
  await prisma.submission.deleteMany();
  await prisma.assignment.deleteMany();
  await prisma.quiz.deleteMany();
  await prisma.attendance.deleteMany();
  await prisma.lecture.deleteMany();
  await prisma.conceptMastery.deleteMany();
  await prisma.conceptEdge.deleteMany();
  await prisma.concept.deleteMany();
  await prisma.topic.deleteMany();
  await prisma.enrollment.deleteMany();
  await prisma.engagementLog.deleteMany();
  await prisma.studyTask.deleteMany();
  await prisma.studyPlan.deleteMany();
  await prisma.recommendation.deleteMany();
  await prisma.alert.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.riskAssessment.deleteMany();
  await prisma.digitalTwin.deleteMany();
  await prisma.classInsight.deleteMany();
  await prisma.intervention.deleteMany();
  await prisma.agentLog.deleteMany();
  await prisma.session.deleteMany();
  await prisma.refreshToken.deleteMany();
  await prisma.emailVerification.deleteMany();
  await prisma.passwordReset.deleteMany();
  await prisma.auditLog.deleteMany();
  await prisma.student.deleteMany();
  await prisma.faculty.deleteMany();
  await prisma.user.deleteMany();
}

async function main() {
  await clearDevelopmentData();
  const facultyHash = await bcrypt.hash('Faculty@123', 10);
  const facultySpecs = [
    ['FAC001', 'Dr. Ramesh Kumar', 'ramesh.kumar@university.edu'],
    ['FAC002', 'Prof. Anitha Reddy', 'anitha.reddy@university.edu'],
  ];
  const faculties = [] as { id: string; userId: string }[];
  for (const [facultyId, fullName, email] of facultySpecs) {
    const user = await prisma.user.create({
      data: { email, passwordHash: facultyHash, role: UserRole.FACULTY, faculty: { create: { facultyId, fullName, department: 'Computer Science', designation: 'Professor' } } },
      include: { faculty: true },
    });
    faculties.push({ id: user.faculty!.id, userId: user.id });
    console.log(`Created faculty ${facultyId}`);
  }
  const studentSpecs = [
    ['24BCE0480', 'Mandalapu Umesh Kumar', '2005-06-15', 'umesh.kumar@university.edu'],
    ['24BCE2038', 'T. S. Guru Pavan Kumar', '2005-08-22', 'guru.pavan@university.edu'],
    ['24BCE2032', 'Veerepalli Veda Karthikeya', '2005-03-10', 'veda.karthikeya@university.edu'],
  ];
  const students = [] as { id: string; userId: string; fullName: string }[];
  for (const [rollNumber, fullName, dob, email] of studentSpecs) {
    const studentHash = await bcrypt.hash(dob, 10);
    const user = await prisma.user.create({
      data: { email, passwordHash: studentHash, role: UserRole.STUDENT, student: { create: { rollNumber, fullName, dob: new Date(`${dob}T00:00:00.000Z`), department: 'Computer Science', year: 2, semester: 4, section: 'A' } } },
      include: { student: true },
    });
    students.push({ id: user.student!.id, userId: user.id, fullName });
    console.log(`Created student ${rollNumber}`);
  }
  const courses = [] as { id: string; code: string }[];
  for (const [code, name, facultyId] of [['CS301', 'Database Management Systems', faculties[0].id], ['CS302', 'Operating Systems', faculties[1].id]]) {
    const course = await prisma.course.create({ data: { code, name, credits: 4, semester: 4, department: 'Computer Science', facultyId } });
    courses.push({ id: course.id, code });
    console.log(`Created course ${code}`);
  }
  const conceptNames = [
    ['Normalization', 'Transactions', 'SQL', 'Indexing', 'ER Model', 'Relational Algebra', 'Concurrency Control', 'Recovery'],
    ['Deadlocks', 'Memory Management', 'Scheduling', 'File Systems', 'Process Sync'],
  ];
  const allConcepts: { id: string; courseId: string; name: string }[][] = [];
  for (let courseIndex = 0; courseIndex < courses.length; courseIndex += 1) {
    const topic = await prisma.topic.create({ data: { courseId: courses[courseIndex].id, name: courseIndex ? 'Operating Systems Core' : 'Database Foundations', orderIndex: 0 } });
    const concepts = [] as { id: string; courseId: string; name: string }[];
    for (let orderIndex = 0; orderIndex < conceptNames[courseIndex].length; orderIndex += 1) {
      const name = conceptNames[courseIndex][orderIndex];
      concepts.push(await prisma.concept.create({ data: { courseId: courses[courseIndex].id, parentTopicId: topic.id, name, difficulty: (orderIndex % 5) + 1, orderIndex } }));
    }
    allConcepts.push(concepts);
  }
  for (const [from, to] of [[4, 5], [0, 1], [2, 3]]) await prisma.conceptEdge.create({ data: { prerequisiteId: allConcepts[0][from].id, dependentId: allConcepts[0][to].id } });
  for (const [from, to] of [[1, 0], [2, 4]]) await prisma.conceptEdge.create({ data: { prerequisiteId: allConcepts[1][from].id, dependentId: allConcepts[1][to].id } });

  for (let courseIndex = 0; courseIndex < courses.length; courseIndex += 1) {
    const course = courses[courseIndex];
    const lectures = [] as { id: string }[];
    for (let index = 0; index < 10; index += 1) lectures.push(await prisma.lecture.create({ data: { courseId: course.id, date: dateAt(index + 1), time: '10:00', room: courseIndex ? 'C-204' : 'B-204' } }));
    for (let index = 0; index < 5; index += 1) {
      const assignment = await prisma.assignment.create({ data: { courseId: course.id, title: `${course.code} Assignment ${index + 1}`, description: `Applied ${course.code} exercise ${index + 1}`, maxMarks: 25, dueDate: dateAt(index + 8) } });
      await prisma.question.create({ data: { assignmentId: assignment.id, conceptId: allConcepts[courseIndex][index % allConcepts[courseIndex].length].id, type: QuestionType.SHORT_ANSWER, difficulty: 3, correctAnswer: 'See instructor rubric' } });
    }
    for (let quizIndex = 0; quizIndex < 3; quizIndex += 1) {
      const quiz = await prisma.quiz.create({ data: { courseId: course.id, title: `${course.code} Quiz ${quizIndex + 1}`, description: 'Formative assessment', durationMins: 30, isAIGenerated: quizIndex === 2 } });
      for (let questionIndex = 0; questionIndex < 5; questionIndex += 1) await prisma.question.create({ data: { quizId: quiz.id, conceptId: allConcepts[courseIndex][questionIndex % allConcepts[courseIndex].length].id, type: QuestionType.MCQ, difficulty: (questionIndex % 5) + 1, options: ['A', 'B', 'C', 'D'], correctAnswer: 'A' } });
    }
    for (const student of students) {
      await prisma.enrollment.create({ data: { studentId: student.id, courseId: course.id } });
      for (const lecture of lectures.slice(0, 5)) await prisma.attendance.create({ data: { studentId: student.id, lectureId: lecture.id, status: AttendanceStatus.PRESENT } });
    }
    console.log(`Created 10 lectures, 5 assignments, 3 quizzes, and weekly attendance for ${course.code}`);
  }
  const quizzes = await prisma.quiz.findMany({ orderBy: { createdAt: 'asc' } });
  const assignments = await prisma.assignment.findMany({ orderBy: { createdAt: 'asc' } });
  for (let studentIndex = 0; studentIndex < students.length; studentIndex += 1) {
    const student = students[studentIndex];
    for (const concepts of allConcepts) for (let index = 0; index < concepts.length; index += 1) { const concept = concepts[index]; await prisma.conceptMastery.create({ data: { studentId: student.id, conceptId: concept.id, masteryScore: 55 + ((studentIndex + index) % 5) * 8, previousScore: 50 + index * 3, trend: index % 2 ? Trend.STABLE : Trend.UP, confidenceLevel: 0.7, assessmentCount: 3 } }); }
    await prisma.digitalTwin.create({ data: { studentId: student.id, academicHealth: 72 - studentIndex * 8, performanceScore: 70 - studentIndex * 7, attendanceScore: 90 - studentIndex * 8, engagementScore: 80 - studentIndex * 5, knowledgeScore: 68 - studentIndex * 6, learningVelocity: 0.65, behaviorScore: 75, skillsScore: 70 } });
    await prisma.riskAssessment.create({ data: { studentId: student.id, riskLevel: studentIndex === 2 ? RiskLevel.HIGH : studentIndex === 1 ? RiskLevel.MEDIUM : RiskLevel.LOW, riskScore: 20 + studentIndex * 30, predictedGPA: 8.4 - studentIndex * 0.7, confidenceScore: 0.84, factors: { attendance: 90 - studentIndex * 8 }, explanation: { summary: 'Seeded risk assessment.' } } });
    for (let day = 0; day < 7; day += 1) await prisma.engagementLog.create({ data: { studentId: student.id, date: dateAt(day + 1), dailyStudyTime: 45 + day * 5, logins: 2 + (day % 3), focusScore: 0.7 + day * 0.02 } });
    const studentQuizzes = quizzes.filter((_, quizIndex) => quizIndex % 2 === studentIndex % 2 || quizIndex === 0).slice(0, 3);
    for (let index = 0; index < studentQuizzes.length; index += 1) { const quiz = studentQuizzes[index]; await prisma.quizAttempt.create({ data: { studentId: student.id, quizId: quiz.id, score: 7 + index, percentage: 70 + index * 8 } }); }
    const studentAssignments = assignments.slice(studentIndex, studentIndex + 5);
    for (let index = 0; index < studentAssignments.length; index += 1) { const assignment = studentAssignments[index]; await prisma.submission.create({ data: { studentId: student.id, assignmentId: assignment.id, status: index % 3 === 0 ? SubmissionStatus.GRADED : index % 3 === 1 ? SubmissionStatus.SUBMITTED : SubmissionStatus.LATE, marksObtained: index % 3 === 0 ? 20 : null, aiFeedback: 'Seeded submission feedback.' } }); }
    await prisma.alert.create({ data: { studentId: student.id, type: AlertType.RECOMMENDATION, severity: studentIndex === 2 ? AlertSeverity.WARNING : AlertSeverity.INFO, message: 'Review your weekly learning recommendations.' } });
    await prisma.recommendation.create({ data: { studentId: student.id, agentType: AgentType.RECOMMENDATION, title: 'Practice core concepts', actionType: ActionType.PRACTICE, confidence: 0.88 } });
    const plan = await prisma.studyPlan.create({ data: { studentId: student.id, title: 'Weekly mastery plan' } });
    await prisma.studyTask.create({ data: { studyPlanId: plan.id, conceptId: allConcepts[0][studentIndex].id, priority: Priority.HIGH, estimatedMins: 45 } });
    console.log(`Created mastery, risk, twin, engagement, and intervention data for ${student.fullName}`);
  }
  console.log('Seed complete: 3 students, 2 faculty, 2 courses, 13 concepts, 20 lectures, 10 assignments, 6 quizzes, and AI analytics created.');
}

main().catch((error) => { console.error(error); process.exitCode = 1; }).finally(() => prisma.$disconnect());