import { Prisma, type PrismaClient } from '@prisma/client';
import { db } from '../db/client';
import { syncApplicationGroupStatus } from './groups';
import {
  applicationStatusForReport,
  requireApplicationTransition,
  type ApplicationStatus,
  type ReportStatus,
} from './policy';

export type ScreeningWebhookEvent = {
  externalEventId: string;
  organizationId: string;
  applicationId: string;
  provider: string;
  providerReference: string;
  status: ReportStatus;
  creditScore?: number;
  background?: 'clear' | 'review';
  eviction?: 'clear' | 'review';
};

export type ScreeningWebhookResult = {
  reportStatus: ReportStatus;
  applicationStatus: ApplicationStatus;
};

export type ScreeningWebhookStore = {
  applyReport(event: ScreeningWebhookEvent): Promise<ScreeningWebhookResult>;
};

export function screeningWebhookTransition(
  currentReportStatus: string,
  currentApplicationStatus: ApplicationStatus,
  incomingReportStatus: ReportStatus,
): ScreeningWebhookResult {
  if (!['pending', 'complete', 'failed'].includes(currentReportStatus)) {
    throw new Error('Stored screening report status is invalid');
  }

  const reportStatus =
    currentReportStatus === 'pending' ? incomingReportStatus : currentReportStatus as ReportStatus;
  let applicationStatus = applicationStatusForReport(currentApplicationStatus, reportStatus);

  // A late pending event must not move an application back out of review.
  if (currentApplicationStatus === 'REVIEW' && reportStatus === 'pending') {
    applicationStatus = 'REVIEW';
  }

  if (applicationStatus === 'REVIEW' && currentApplicationStatus === 'SUBMITTED') {
    requireApplicationTransition('SUBMITTED', 'SCREENING');
    requireApplicationTransition('SCREENING', 'REVIEW');
  } else {
    requireApplicationTransition(currentApplicationStatus, applicationStatus);
  }

  return { reportStatus, applicationStatus };
}

function normalizeEvent(event: ScreeningWebhookEvent): ScreeningWebhookEvent {
  if (
    !event.externalEventId?.trim() ||
    !event.organizationId?.trim() ||
    !event.applicationId?.trim() ||
    !event.provider?.trim() ||
    !event.providerReference?.trim() ||
    !['pending', 'complete', 'failed'].includes(event.status)
  ) {
    throw new Error('Verified screening webhook fields are required');
  }
  if (event.creditScore !== undefined && (!Number.isInteger(event.creditScore) || event.creditScore < 300 || event.creditScore > 850)) {
    throw new Error('Screening credit score is invalid');
  }
  if (event.background !== undefined && !['clear', 'review'].includes(event.background)) {
    throw new Error('Screening background result is invalid');
  }
  if (event.eviction !== undefined && !['clear', 'review'].includes(event.eviction)) {
    throw new Error('Screening eviction result is invalid');
  }
  return event;
}

export function createScreeningWebhookHandler(store: ScreeningWebhookStore) {
  return async (input: ScreeningWebhookEvent): Promise<ScreeningWebhookResult> => {
    return store.applyReport(normalizeEvent(input));
  };
}

function retainedSummary(value: Prisma.JsonValue | null): Prisma.InputJsonObject {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const record = value as Prisma.JsonObject;
  return {
    ...(typeof record.creditScore === 'number' ? { creditScore: record.creditScore } : {}),
    ...(record.background === 'clear' || record.background === 'review'
      ? { background: record.background }
      : {}),
    ...(record.eviction === 'clear' || record.eviction === 'review'
      ? { eviction: record.eviction }
      : {}),
  };
}

function updatedSummary(
  previous: Prisma.JsonValue | null,
  event: ScreeningWebhookEvent,
): Prisma.InputJsonObject {
  return {
    ...retainedSummary(previous),
    ...(event.creditScore === undefined ? {} : { creditScore: event.creditScore }),
    ...(event.background === undefined ? {} : { background: event.background }),
    ...(event.eviction === undefined ? {} : { eviction: event.eviction }),
  };
}

function createPrismaStore(client: PrismaClient): ScreeningWebhookStore {
  return {
    async applyReport(event) {
      return client.$transaction(async (transaction) => {
        const report = await transaction.screeningReport.findFirst({
          where: {
            organizationId: event.organizationId,
            applicationId: event.applicationId,
            provider: event.provider,
            providerReference: event.providerReference,
          },
        });
        if (!report) throw new Error('Screening report not found');

        const application = await transaction.application.findFirst({
          where: { id: event.applicationId, organizationId: event.organizationId },
          select: { status: true },
        });
        if (!application) throw new Error('Application not found');

        const transition = screeningWebhookTransition(
          report.status,
          application.status,
          event.status,
        );
        const summary = updatedSummary(report.summary, event);
        const completedAt =
          transition.reportStatus === 'pending'
            ? null
            : report.completedAt ?? new Date();

        await transaction.screeningReport.update({
          where: { id: report.id },
          data: {
            status: transition.reportStatus,
            summary,
            completedAt,
          },
        });
        if (transition.applicationStatus !== application.status) {
          await transaction.application.update({
            where: { id: event.applicationId },
            data: { status: transition.applicationStatus },
          });
          await syncApplicationGroupStatus(transaction, event.applicationId);
        }

        return transition;
      });
    },
  };
}

export const handleScreeningWebhook = createScreeningWebhookHandler(createPrismaStore(db));
