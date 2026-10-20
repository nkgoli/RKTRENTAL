'use server';

import { Prisma, type ApplicationStatus } from '@prisma/client';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { requireManagerWriteRole } from '@/lib/auth/access';
import { db } from '@/lib/db/client';
import { screeningProvider } from '@/lib/providers';
import { applicationsRedirectUrl } from '@/lib/screening/redirect';
import { scopeFilterFrom } from '@/lib/workspace/scope';
import { syncApplicationGroupStatus } from '@/lib/screening/groups';
import { recordDecision as recordScreeningDecisionAudit } from '@/lib/screening/decision-audit';
import {
  applicationStatusForReport,
  hasCurrentConsent,
  requireApplicationTransition,
  requireCurrentConsent,
} from '@/lib/screening/policy';

async function requireManager() {
  return requireManagerWriteRole();
}

function scopeFrom(formData: FormData) {
  return scopeFilterFrom({
    propertyId: value(formData, 'propertyId'),
    unitId: value(formData, 'unitId'),
  });
}

function value(formData: FormData, key: string) {
  const item = formData.get(key);
  return typeof item === 'string' ? item.trim() : '';
}

export async function requestScreening(formData: FormData) {
  const session = await requireManager();
  const applicationId = value(formData, 'applicationId');
  if (!applicationId) throw new Error('Application is required');

  const application = await db.application.findFirst({
    where: { id: applicationId, organizationId: session.organizationId },
  });
  if (!application) throw new Error('Application not found');
  requireApplicationTransition(application.status, 'SCREENING');

  const connections = await db.providerConnection.findMany({
    where: {
      organizationId: session.organizationId,
      kind: 'SCREENING',
    },
    orderBy: { updatedAt: 'desc' },
  });
  const consents = await db.screeningConsent.findMany({
    where: {
      applicationId,
      organizationId: session.organizationId,
    },
  });
  const consent =
    consents.find(
      (item) =>
        hasCurrentConsent(item) &&
        connections.some(
          (connection) =>
            connection.provider === item.provider &&
            (process.env.NODE_ENV !== 'production' || connection.status === 'CONNECTED'),
        ),
    ) ?? consents.find((item) => item.provider === 'mock' && hasCurrentConsent(item));
  requireCurrentConsent(consent);
  const providerKey = consent.provider;
  if (
    process.env.NODE_ENV === 'production' &&
    !connections.some(
      (connection) => connection.provider === providerKey && connection.status === 'CONNECTED',
    )
  ) {
    throw new Error('Screening provider is not connected');
  }

  const provider = await screeningProvider(session.organizationId);
  const requested = await provider.request({
    applicationId,
    applicantName: application.applicantName,
    applicantEmail: application.applicantEmail,
    consent: {
      consentedAt: consent.consentedAt,
      version: consent.consentVersion,
      revokedAt: consent.revokedAt,
    },
  });

  let reportStatus = requested.status;
  let summary: Prisma.InputJsonObject = {};
  if (requested.status === 'complete') {
    const report = await provider.report(requested.id);
    reportStatus = report.status;
    summary = {
      ...(report.creditScore === undefined ? {} : { creditScore: report.creditScore }),
      ...(report.background ? { background: report.background } : {}),
      ...(report.eviction ? { eviction: report.eviction } : {}),
    };
  }

  const nextStatus = applicationStatusForReport(application.status, reportStatus);
  requireApplicationTransition(application.status, 'SCREENING');
  if (nextStatus !== 'SCREENING') requireApplicationTransition('SCREENING', nextStatus);
  const completedAt = reportStatus === 'complete' || reportStatus === 'failed' ? new Date() : null;

  await db.$transaction([
    db.screeningReport.upsert({
      where: {
        provider_providerReference: { provider: providerKey, providerReference: requested.id },
      },
      update: {
        applicationId,
        organizationId: session.organizationId,
        status: reportStatus,
        summary,
        completedAt,
      },
      create: {
        organizationId: session.organizationId,
        applicationId,
        provider: providerKey,
        providerReference: requested.id,
        status: reportStatus,
        summary,
        completedAt,
      },
    }),
    db.application.update({ where: { id: applicationId }, data: { status: nextStatus } }),
  ]);
  await syncApplicationGroupStatus(db, applicationId);

  revalidatePath('/applications');
  redirect(
    applicationsRedirectUrl(applicationId, 'screening', scopeFrom(formData)).replace(
      '/applications?',
      '/applications/result?',
    ),
  );
}

const decisionReasons = new Set([
  'criteria-met',
  'credit-below-criteria',
  'background-review',
  'eviction-review',
  'application-incomplete',
]);

export async function recordDecision(formData: FormData) {
  const session = await requireManager();
  const applicationId = value(formData, 'applicationId');
  const decision = value(formData, 'decision');
  const reason = value(formData, 'reason');
  if (!applicationId || !decision || !decisionReasons.has(reason)) {
    throw new Error('Application, decision and written screening reason are required');
  }
  if (decision !== 'APPROVED' && decision !== 'DECLINED')
    throw new Error('Invalid application decision');
  if ((decision === 'APPROVED') !== (reason === 'criteria-met')) {
    throw new Error('Choose a reason that matches the application decision');
  }

  const application = await db.application.findFirst({
    where: { id: applicationId, organizationId: session.organizationId },
    include: {
      consents: { orderBy: { consentedAt: 'desc' } },
      reports: { orderBy: { createdAt: 'desc' } },
    },
  });
  if (!application) throw new Error('Application not found');
  const connections = await db.providerConnection.findMany({
    where: {
      organizationId: session.organizationId,
      kind: 'SCREENING',
    },
  });
  const consent =
    application.consents.find(
      (item) =>
        hasCurrentConsent(item) &&
        connections.some((connection) => connection.provider === item.provider),
    ) ?? application.consents.find((item) => item.provider === 'mock' && hasCurrentConsent(item));
  requireCurrentConsent(consent);
  if (application.status !== 'REVIEW' || application.reports[0]?.status !== 'complete') {
    throw new Error('A completed screening report is required before a decision');
  }
  requireApplicationTransition(application.status, decision as ApplicationStatus);

  await recordScreeningDecisionAudit({
    applicationId,
    organizationId: session.organizationId,
    actorId: session.subjectId,
    decision: decision as 'APPROVED' | 'DECLINED',
    reason,
  });

  revalidatePath('/applications');
  redirect(
    applicationsRedirectUrl(applicationId, decision.toLowerCase(), scopeFrom(formData)).replace(
      '/applications?',
      '/applications/result?',
    ),
  );
}
