import { RecoveryCard } from './RecoveryCard';
import { RequestRecoveryForm } from './RequestRecoveryForm';

export default function RecoverPage() {
  return (
    <RecoveryCard title="Reset your password" description="We’ll email you a link to reset it.">
      <RequestRecoveryForm />
    </RecoveryCard>
  );
}
