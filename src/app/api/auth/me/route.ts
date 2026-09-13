import { NextResponse } from 'next/server';
import { getAuthSession } from '@/lib/auth/session';
import { normalizeRole } from '@/lib/auth/roles';
import { prisma } from '@/lib/prisma';

export async function GET() {
  const token = await getAuthSession();
  if (!token?.id) {
    return NextResponse.json({ authenticated: false, user: null }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { id: token.id },
    include: {
      student: { include: { digitalTwin: true } },
      faculty: true,
    },
  });

  if (!user || user.status !== 'ACTIVE') {
    return NextResponse.json({ authenticated: false, user: null }, { status: 401 });
  }

  // ✅ Flatten the response so `user.name`, `user.rollNumber` etc work
  const role = normalizeRole(user.role);
  if (!role) {
    return NextResponse.json({ authenticated: false, user: null }, { status: 401 });
  }

  const flatUser = {
    id: user.id,
    email: user.email,
    role,
    name: user.student?.fullName || user.faculty?.fullName || 'User',
    studentId: user.student?.id,
    rollNumber: user.student?.rollNumber,
    facultyId: user.faculty?.facultyId,
    department: user.student?.department || user.faculty?.department || '',
    class: user.student?.section,
    // Keep the nested objects too if needed elsewhere
    student: user.student,
    faculty: user.faculty,
  };

  return NextResponse.json({
    authenticated: true,
    user: flatUser,
  });
}