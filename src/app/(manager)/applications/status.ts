import type { ApplicationStatus } from '@/lib/screening/policy';
import type { BadgeTone } from '@/components/ui/Badge';

export const applicationStatusLabels: Record<ApplicationStatus, string> = {
  SUBMITTED: 'Awaiting consent',
  SCREENING: 'Screening',
  REVIEW: 'Ready',
  APPROVED: 'Approved',
  DECLINED: 'Declined',
};
export function applicationStatusTone(status: ApplicationStatus): BadgeTone {
  return {
    SUBMITTED: 'neutral',
    SCREENING: 'warning',
    REVIEW: 'success',
    APPROVED: 'success',
    DECLINED: 'danger',
  }[status] as BadgeTone;
}
