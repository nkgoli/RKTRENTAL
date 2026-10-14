# Screening module integration notes

## Application decisions

`recordDecision({ applicationId, decision, reason, actorId })` is the audit seam used by the applications server action. The action stores the final decision in `Application.status`; the current adapter emits a structured audit event until durable audit fields are added.

The follow-up schema change should add these nullable fields to `Application`:

```prisma
decisionReason String?
decidedBy      String?
decidedAt      DateTime?
```

The follow-up can persist the same input alongside the status update, with `decidedBy` set to the authenticated actor's ID and `decidedAt` set when the decision is recorded.

## Screening provider webhooks

The provider route should verify the signature, validate and normalize the provider payload, and claim the event in its idempotency store before calling the exported handler. Call `handleScreeningWebhook` only for a newly claimed event; repeated event IDs should return the route's duplicate response without applying the update again.

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
