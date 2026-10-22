'use client';

import Link from 'next/link';
import { useCallback, useEffect, useRef, useState, useTransition } from 'react';
import {
  STEP,
  STEP_COUNT,
  WIZARD_STEPS,
  type TenantOption,
  type WizardDraft,
} from '@/lib/lease-create/types';
import { validateStep, withResolvedEnd } from '@/lib/lease-create/validation';
import {
  saveWizardStepAction,
  sendWizardLeaseAction,
  type WizardActionState,
} from '@/app/(manager)/leases/new/actions';
import {
  AttachmentsStep,
  LessorStep,
  OptionsStep,
  RentStep,
  ReviewStep,
  TenantsStep,
  TermStep,
  type AttachmentFile,
  type ApplicantOption,
} from './steps';
import styles from './lease-builder.module.css';
import { TemplateTermsStep } from './TemplateTermsStep';
import {
  contextFromDraft,
  resolveTerms,
  type TemplateDefinition,
} from '@/lib/lease-create/templates';
import { useBuilderShell } from './useBuilderShell';
import { SigningPanel } from '@/components/lease-signing/SigningPanel';
import { SendAgreementButton } from '@/components/lease-signing/SendAgreementButton';
import { DeleteDraftButton } from '@/components/lease-create/DeleteDraftButton';

export type LeaseBuilderProps = {
  lessorSigner?: { name: string; email: string } | null;
  /** Property and unit shown in the top bar. */
  placeLabel: string;
  tenants: TenantOption[];
  applicants?: ApplicantOption[];
  leaseId: string | null;
  renewId: string | null;
  draft: WizardDraft;
  templates: TemplateDefinition[];
  step: number;
  furthestStep: number;
  attachments: AttachmentFile[];
  sourceLabel?: string;
  /** Extra guidance for the Tenants step, e.g. an applicant who is not a tenant yet. */
  notice?: string;
  backHref: string;
  /** Property of the lease's unit; read from backHref when omitted. */
  propertyId?: string;
  /** Where Save and exit goes. */
  exitHref: string;
};

const SUBTITLES: Record<number, string> = {
  [STEP.term]:
    'Set move-in day and the lease term. The next step aligns rent to your chosen due day.',
  [STEP.rent]:
    'Choose the rent due day and review every move-in and recurring charge before sending.',
  [STEP.tenants]: 'Choose every tenant who will sign the lease and identify the primary contact.',
  [STEP.options]: 'Renewal notice, occupants and other options for this lease.',
  [STEP.clauses]: 'Pick the clauses that belong in the agreement.',
  [STEP.rules]: 'Set the house rules tenants agree to.',
  [STEP.disclosures]: 'Include the disclosures this lease needs.',
  [STEP.attachments]:
    'Add documents to the lease packet. Assign a type to each file so tenants know what they are reviewing.',
  [STEP.lessor]: 'Who the lessor is on the agreement.',
  [STEP.review]: 'Check everything, then send the lease for e-signature.',
};

const idle: WizardActionState = {};

export function LeaseBuilder(props: LeaseBuilderProps) {
  const { tenants } = props;
  const [draft, setDraft] = useState<WizardDraft>(props.draft);
  const draftRef = useRef<WizardDraft>(props.draft);
  const hydrated = useBuilderShell();
  const [dirty, setDirty] = useState(false);
  const [step, setStep] = useState(props.step);
  const [furthest, setFurthest] = useState(Math.max(props.furthestStep, props.step));
  const [leaseId, setLeaseId] = useState(props.leaseId);
  const [attachments, setAttachments] = useState<AttachmentFile[]>(props.attachments);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState('');
  const [sent, setSent] = useState<WizardActionState>(idle);
  const [pending, startTransition] = useTransition();
  // A confirmed delete holds every write: a save after it would fail, and a send must not race it.
  const [deleting, setDeleting] = useState(false);
  const deletingRef = useRef(false);
  const onDeletePending = useCallback((value: boolean) => {
    deletingRef.current = value;
    setDeleting(value);
  }, []);
  const busy = pending || deleting;
  const top = useRef<HTMLDivElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const errorSummary = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!hydrated) return;
    heading.current?.focus({ preventScroll: true });
    top.current?.scrollIntoView({ block: 'start' });
    top.current
      ?.querySelector('[aria-current="step"]')
      ?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }, [step, hydrated]);

  useEffect(() => {
    if (message) errorSummary.current?.focus();
  }, [message, errors]);

  const update = (patch: Partial<WizardDraft>) => {
    draftRef.current = withResolvedEnd({ ...draftRef.current, ...patch });
    setDraft(draftRef.current);
    setDirty(true);
    setErrors({});
    setMessage('');
  };

  const validationOptions = { tenants, isRenewal: Boolean(props.renewId) };

  /** Saves the current step as the lease draft and reports whether it went through. */
  async function save(from: number, to: number, strict: boolean): Promise<boolean> {
    if (deletingRef.current) return false;
    try {
      const result = await saveWizardStepAction({
        leaseId: leaseId ?? undefined,
        renewId: props.renewId ?? undefined,
        step: from,
        nextStep: to,
        draft: draftRef.current,
        strict,
      });
      if (!result.ok) {
        setErrors(result.errors ?? {});
        setMessage(result.message ?? 'Please fix the highlighted fields.');
        return false;
      }
      setLeaseId(result.leaseId ?? leaseId);
      setFurthest((f) => Math.max(f, result.furthestStep ?? to));
      setDirty(false);
      return true;
    } catch {
      setMessage('Your changes could not be saved. They are still here; try again.');
      return false;
    }
  }

  function go(to: number) {
    setErrors({});
    setMessage('');
    setStep(to);
    top.current?.scrollIntoView({ block: 'start' });
  }

  function next() {
    const local = validateStep(step, draftRef.current, validationOptions);
    if (Object.keys(local).length) {
      setErrors(local);
      setMessage(
        step === STEP.tenants
          ? 'Select at least one tenant and choose the primary tenant.'
          : 'Please fix the highlighted fields.',
      );
      return;
    }
    startTransition(async () => {
      if (await save(step, step + 1, true)) go(step + 1);
    });
  }

  /** Back and finished-step clicks keep what was typed, without blocking on validation. */
  function jump(to: number) {
    if (to === step) return;
    if (!leaseId) return go(to);
    startTransition(async () => {
      if (await save(step, to, false)) go(to);
    });
  }

  function saveAndExit() {
    startTransition(async () => {
      // Leave the wizard with a document navigation after persistence succeeds.
      // A client-router push can interrupt the action's pending router update and
      // strand the wizard in Saving, even though the draft was already persisted.
      if (await save(step, step, false)) window.location.assign(props.exitHref);
    });
  }

  const propertyId =
    props.propertyId ?? /^\/properties\/([^/?#]+)\//.exec(props.backHref)?.[1] ?? '';
  function applicationsHref(applicantId?: string) {
    const query = new URLSearchParams();
    if (propertyId) query.set('propertyId', decodeURIComponent(propertyId));
    if (draft.unitId) query.set('unitId', draft.unitId);
    if (applicantId) query.set('applicant', applicantId);
    return `/applications${query.size ? `?${query}` : ''}${applicantId ? '#selected-applicant' : ''}`;
  }

  /** Applications is a separate page, so persist the draft before leaving the wizard. */
  function reviewApplicants(href: string) {
    if (busy) return;
    startTransition(async () => {
      if (await save(step, step, false)) window.location.assign(href);
    });
  }

  function send() {
    const local = validateStep(STEP.review, draftRef.current, validationOptions);
    if (Object.keys(local).length) {
      setErrors(local);
      setMessage('Please fix the highlighted fields.');
      return;
    }
    startTransition(async () => {
      if (!leaseId || deletingRef.current) return;
      try {
        const result = await sendWizardLeaseAction({
          leaseId,
          renewId: props.renewId ?? undefined,
          draft: draftRef.current,
        });
        setSent(result);
        if (!result.ok) {
          setErrors(result.errors ?? {});
          setMessage(result.message ?? 'The lease could not be sent.');
        }
      } catch {
        setMessage(
          'We could not confirm that the lease was sent. Check its status before trying again.',
        );
      }
    });
  }

  const created = Boolean(sent.ok && sent.leaseId);
  const esignStatus = sent.esignStatus;
  const unresolvedTerms = draft.template
    ? resolveTerms(
        draft.template,
        contextFromDraft(draft),
        draft.termOverrides,
        draft.renewalTerms,
      ).filter((item) => item.included && /\{\{[a-z_]+\}\}/.test(item.body))
    : [];
  const body = [
    <TermStep key="term" draft={draft} update={update} errors={errors} />,
    <RentStep key="rent" draft={draft} update={update} errors={errors} />,
    <TenantsStep
      key="tenants"
      draft={draft}
      update={update}
      errors={errors}
      tenants={tenants}
      applicants={props.applicants}
      applicationsHref={applicationsHref}
      onReviewApplicants={reviewApplicants}
      sourceLabel={props.sourceLabel}
      notice={props.notice}
    />,
    <OptionsStep key="options" draft={draft} update={update} errors={errors} />,
    <TemplateTermsStep
      key="clauses"
      section="CLAUSE"
      draft={draft}
      update={update}
      templates={props.templates}
      isRenewal={Boolean(props.renewId)}
    />,
    <TemplateTermsStep
      key="rules"
      section="RULE"
      onChangeTemplate={() => jump(STEP.clauses)}
      draft={draft}
      update={update}
      templates={props.templates}
      isRenewal={Boolean(props.renewId)}
    />,
    <TemplateTermsStep
      key="disclosures"
      section="DISCLOSURE"
      onChangeTemplate={() => jump(STEP.clauses)}
      draft={draft}
      update={update}
      templates={props.templates}
      isRenewal={Boolean(props.renewId)}
    />,
    <AttachmentsStep
      key="attachments"
      leaseId={leaseId}
      files={attachments}
      onUploaded={(file) =>
        setAttachments((list) => [...list.filter((f) => f.id !== file.id), file])
      }
      onRemoved={(id) => setAttachments((list) => list.filter((f) => f.id !== id))}
      onKindChanged={(id, kind) =>
        setAttachments((list) => list.map((f) => (f.id === id ? { ...f, kind } : f)))
      }
    />,
    <LessorStep key="lessor" draft={draft} update={update} errors={errors} />,
    <ReviewStep
      key="review"
      lessorSigner={props.lessorSigner}
      draft={draft}
      errors={errors}
      unitLabel={props.placeLabel}
      tenants={tenants}
      attachments={attachments}
    />,
  ][step];

  return (
    <div className={styles.page} role="region" aria-label="Create lease" inert={!hydrated}>
      <header className={styles.topbar}>
        <Link className={styles.back} href={props.backHref} aria-label="Back to property leases">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M19 12H5M12 19l-7-7 7-7" />
          </svg>
        </Link>
        <div className={styles.place}>
          <span className={styles.topCaption}>
            {props.renewId ? 'Renew a lease' : 'Create a lease'}
          </span>
          {props.placeLabel}
          {props.renewId && <small>Renewal</small>}
          <span className={styles.topProgress} aria-live="polite">
            Step {step + 1} of {STEP_COUNT} · {WIZARD_STEPS[step]}
          </span>
        </div>
        <span className={styles.saveStatus} role="status">
          {created
            ? esignStatus === 'NOT_SENT'
              ? 'Active lease · not sent'
              : 'Ready for signatures'
            : deleting
              ? 'Deleting draft…'
              : pending
                ? 'Saving…'
                : dirty
                  ? 'Unsaved changes'
                  : leaseId
                    ? 'Draft saved'
                    : 'Not saved yet'}
        </span>
        {leaseId && !created && (
          <DeleteDraftButton
            leaseId={leaseId}
            placeLabel={props.placeLabel}
            tenantName={tenants.find((tenant) => tenant.id === draft.primaryTenantId)?.name}
            renewal={Boolean(props.renewId)}
            fileCount={attachments.length}
            className={styles.deleteDraft}
            disabled={busy}
            onPendingChange={onDeletePending}
          />
        )}
        <button
          type="button"
          className={styles.exit}
          onClick={saveAndExit}
          disabled={busy || created}
        >
          Save and exit
        </button>
      </header>

      <div className={styles.layout} ref={top}>
        <nav aria-label="Lease steps">
          <p className={styles.progressNote}>
            Step {step + 1} of {STEP_COUNT} · {WIZARD_STEPS[step]}
          </p>
          <p className={styles.progressHint}>
            Next saves your progress. Return to any visited step.
          </p>
          <ol className={styles.steps} tabIndex={0} aria-label="All 10 lease creation steps">
            {WIZARD_STEPS.map((label, index) => {
              const done = index < furthest && index !== step;
              const current = index === step;
              const clickable = !created && !current && index <= furthest;
              const marker = done ? (
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M5 12.5l4.5 4.5L19 7.5" />
                </svg>
              ) : (
                index + 1
              );
              const className = [styles.step, done && styles.done, current && styles.current]
                .filter(Boolean)
                .join(' ');
              return (
                <li key={label} className={styles.stepItem}>
                  {clickable ? (
                    <button
                      type="button"
                      className={className}
                      onClick={() => jump(index)}
                      disabled={busy}
                    >
                      <span className={styles.marker}>{marker}</span>
                      <span className={styles.stepLabel}>{label}</span>
                    </button>
                  ) : (
                    <span className={className} aria-current={current ? 'step' : undefined}>
                      <span className={styles.marker}>{marker}</span>
                      <span className={styles.stepLabel}>{label}</span>
                    </span>
                  )}
                </li>
              );
            })}
          </ol>
          <p className={styles.phoneHint}>Scroll to see all 10 steps.</p>
        </nav>

        <section className={styles.card} aria-labelledby="step-title">
          <div className={styles.cardBody}>
            <div className={styles.cardHead}>
              <div>
                <p className={styles.kicker}>
                  Step {String(step + 1).padStart(2, '0')} of {STEP_COUNT}
                </p>
                <h2 id="step-title" tabIndex={-1} ref={heading}>
                  {WIZARD_STEPS[step]}
                </h2>
                <p className={styles.sub}>{SUBTITLES[step]}</p>
              </div>
              <span className={styles.panelIcon} aria-hidden="true">
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.7"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  focusable="false"
                >
                  <path d="M14 3H5v18h14V8zM14 3v5h5M9 13h6M9 17h4" />
                </svg>
              </span>
            </div>

            {message && !created && (
              <div className={styles.alert} role="alert" tabIndex={-1} ref={errorSummary}>
                <strong>{message}</strong>
                {Object.keys(errors).length > 0 && (
                  <ul>
                    {Object.entries(errors).map(([field, error]) => (
                      <li key={field}>{error}</li>
                    ))}
                  </ul>
                )}
                {step === STEP.review && Object.keys(errors).length > 0 && (
                  <p>
                    Use the lease steps to return to the fields above. Your draft stays saved as you
                    go back.
                  </p>
                )}
              </div>
            )}

            {created ? (
              <div>
                <div
                  className={`${styles.alert} ${esignStatus === 'NOT_SENT' ? '' : styles.success}`}
                  role="status"
                >
                  {sent.message}
                </div>
                <div className={styles.created}>
                  <a className={styles.link} href={`/leases/${sent.leaseId}`}>
                    View lease detail
                  </a>
                </div>
                {esignStatus === 'NOT_SENT' ? (
                  <SendAgreementButton leaseId={sent.leaseId!} />
                ) : (
                  <SigningPanel
                    leaseId={sent.leaseId!}
                    documentsHref={`/leases/${sent.leaseId}?tab=documents`}
                  />
                )}
              </div>
            ) : (
              <>
                <fieldset
                  className={styles.stepFields}
                  disabled={busy}
                  aria-label={WIZARD_STEPS[step]}
                >
                  {body}
                  {step === STEP.review && unresolvedTerms.length > 0 && (
                    <div className={styles.alert} role="alert">
                      <strong>Complete the agreement before sending</strong>
                      <ul>
                        {unresolvedTerms.map((item) => (
                          <li key={item.id}>
                            {item.title}: fill the remaining blanks in{' '}
                            {item.section === 'CLAUSE'
                              ? 'Clauses'
                              : item.section === 'RULE'
                                ? 'Rules'
                                : 'Disclosures'}
                            .
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </fieldset>
                <div className={styles.footer}>
                  <button
                    type="button"
                    className={styles.btn}
                    disabled={step === 0 || busy}
                    onClick={() => jump(step - 1)}
                  >
                    Back
                  </button>
                  {step < STEP_COUNT - 1 ? (
                    <button
                      type="button"
                      className={`${styles.btn} ${styles.primary}`}
                      disabled={busy}
                      onClick={next}
                      data-next-step={step + 1}
                      aria-busy={pending || undefined}
                    >
                      {pending ? (
                        <>
                          <span className={styles.spinner} aria-hidden="true" />
                          Saving…
                        </>
                      ) : (
                        <>
                          Next
                          <svg
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="1.7"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            aria-hidden="true"
                            focusable="false"
                          >
                            <path d="M5 12h14M14 7l5 5-5 5" />
                          </svg>
                        </>
                      )}
                    </button>
                  ) : (
                    <button
                      type="button"
                      className={`${styles.btn} ${styles.primary}`}
                      disabled={busy || unresolvedTerms.length > 0}
                      onClick={send}
                    >
                      {pending ? 'Sending…' : 'Send for e-signature'}
                    </button>
                  )}
                </div>
                {step < STEP_COUNT - 1 && (
                  <p className={styles.nextHint}>Next: {WIZARD_STEPS[step + 1]}</p>
                )}
              </>
            )}
          </div>
          <p className={styles.disclaimer}>
            Lease templates and terms are provided for convenience and may not fit every
            circumstance. Review applicable law and verify the agreement with your professional
            advisors before sending.
          </p>
        </section>
      </div>
    </div>
  );
}
