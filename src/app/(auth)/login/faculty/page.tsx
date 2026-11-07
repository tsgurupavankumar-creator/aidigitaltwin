import { FacultyLoginForm } from '@/components/auth/FacultyLoginForm';
import { AuthLayout } from '@/components/auth/AuthLayout';

export default function FacultyLoginPage() {
  return (
    <AuthLayout accent="plum">
      <FacultyLoginForm />
    </AuthLayout>
  );
}
