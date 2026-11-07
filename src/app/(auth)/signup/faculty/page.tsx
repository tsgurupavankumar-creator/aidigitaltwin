import { FacultySignupForm } from '@/components/auth/FacultySignupForm';
import { AuthLayout } from '@/components/auth/AuthLayout';

export default function FacultySignupPage() {
  return (
    <AuthLayout accent="plum">
      <FacultySignupForm />
    </AuthLayout>
  );
}
