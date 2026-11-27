import type { Metadata } from 'next';
import { Button } from '@/components/ui/Button';
import { recoveryUser } from '@/lib/auth/recovery';
import { RecoveryCard } from '../RecoveryCard';
import { ResetPasswordForm } from '../ResetPasswordForm';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = {
  title: 'Reset your password',
  referrer: 'no-referrer',
  robots: { index: false, follow: false },
};

export default async function ResetPasswordPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const user = await recoveryUser(token);
  if (!user)
    return (
      <RecoveryCard
        title="Link expired"
        description="This reset link has expired or was already used."
      >
        <Button href="/recover" variant="primary" block>
          Request a new reset link
        </Button>
      </RecoveryCard>
    );
  return (
    <RecoveryCard
      title="Choose a new password"
      description="Changing it signs you out on all devices."
    >
      <ResetPasswordForm token={token} />
    </RecoveryCard>
  );
}
