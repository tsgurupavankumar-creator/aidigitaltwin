import { RoleChooser } from '@/components/auth/RoleChooser';
import { AuthLayout } from '@/components/auth/AuthLayout';

export default function ChooseRolePage() {
  return (
    <AuthLayout>
      <RoleChooser />
    </AuthLayout>
  );
}
