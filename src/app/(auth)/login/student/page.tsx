import { StudentLoginForm } from '@/components/auth/StudentLoginForm';
import { AuthLayout } from '@/components/auth/AuthLayout';

export default function StudentLoginPage() {
  return (
    <AuthLayout accent="terracotta">
      <StudentLoginForm />
    </AuthLayout>
  );
}
