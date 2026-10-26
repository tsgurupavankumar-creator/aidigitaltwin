import { RoleChooser } from '@/components/auth/RoleChooser';
import { AuthLayout } from '@/components/auth/AuthLayout';

export default function LoginPage() {
  return (
    <AuthLayout>
      <RoleChooser />
    </AuthLayout>
  );
}
