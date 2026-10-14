# Screening module integration notes

## Application decisions

`recordDecision({ organizationId, applicationId, decision, reason, actorId })` writes the final status and audit fields together. It only updates an application in `REVIEW` for the given organization:

```prisma
decisionReason String?
decidedBy      String?
decidedAt      DateTime?
```

`decidedBy` is the authenticated actor's ID and `decidedAt` is the time of the decision.

## Screening provider webhooks

The provider route verifies the signature and claims the event before calling the exported handler. Matching repeated deliveries can safely run the handler again, allowing a retry after an interrupted first attempt. The handler keeps report and application transitions idempotent.

```ts
await handleScreeningWebhook({
  externalEventId: verifiedEvent.id,
  organizationId: verifiedEvent.organizationId,
  applicationId: verifiedEvent.applicationId,
  provider: verifiedEvent.provider,
  providerReference: verifiedEvent.reportId,
  status: verifiedEvent.status,
  creditScore: verifiedEvent.creditScore,
  background: verifiedEvent.background,
  eviction: verifiedEvent.eviction,
});
```

The caller must pass a verified event and only approved report summary fields. The handler scopes the report and application to the same organization, applies report and application status transitions in one transaction, keeps final decisions unchanged, and ignores late status changes after a report is complete or failed.
