import { RecoveryCard } from './RecoveryCard';
import { RequestRecoveryForm } from './RequestRecoveryForm';

export default function RecoverPage() {
  return (
    <RecoveryCard
      title="Reset your password"
      description="Enter the email address for your account and we’ll send you a reset link."
    >
      <RequestRecoveryForm />
    </RecoveryCard>
  );
}
