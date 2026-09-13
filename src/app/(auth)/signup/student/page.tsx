import { StudentSignupForm } from '@/components/auth/StudentSignupForm';
import { AuthLayout } from '@/components/auth/AuthLayout';

export default function StudentSignupPage() {
  return (
    <AuthLayout accent="terracotta">
      <StudentSignupForm />
    </AuthLayout>
  );
}
