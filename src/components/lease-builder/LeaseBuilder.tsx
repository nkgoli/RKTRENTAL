'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useActionState, useEffect, useRef, useState, useTransition } from 'react';
import {
  STEP,
  STEP_COUNT,
  WIZARD_STEPS,
  type TenantOption,
  type WizardDraft,
} from '@/lib/lease-create/types';
import { validateStep, withResolvedEnd } from '@/lib/lease-create/validation';
import {
  completeSigningAction,
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
} from './steps';
import styles from './lease-builder.module.css';
import { TemplateTermsStep } from './TemplateTermsStep';
import type { TemplateDefinition } from '@/lib/lease-create/templates';
import { useBuilderShell } from './useBuilderShell';

export type LeaseBuilderProps = {
  /** Property and unit shown in the top bar. */
  placeLabel: string;
  tenants: TenantOption[];
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
  /** Where Save and exit goes. */
  exitHref: string;
};

const SUBTITLES: Record<number, string> = {
  [STEP.term]:
    'Set move-in day and the lease term. The next step aligns rent to your chosen due day.',
  [STEP.rent]:
    'Choose the rent due day and review every move-in and recurring charge before sending.',
  [STEP.tenants]: 'Choose who is on the lease and who signs as the primary tenant.',
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
  const router = useRouter();
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
  const [signState, signAction, signing] = useActionState(completeSigningAction, idle);
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
      setMessage('Please fix the highlighted fields.');
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
      if (await save(step, step, false)) router.push(props.exitHref);
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
      if (!leaseId) return;
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
  const esignStatus = signState.esignStatus ?? sent.esignStatus;
  const body = [
    <TermStep key="term" draft={draft} update={update} errors={errors} />,
    <RentStep key="rent" draft={draft} update={update} errors={errors} />,
    <TenantsStep
      key="tenants"
      draft={draft}
      update={update}
      errors={errors}
      tenants={tenants}
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
      draft={draft}
      update={update}
      templates={props.templates}
      isRenewal={Boolean(props.renewId)}
    />,
    <TemplateTermsStep
      key="disclosures"
      section="DISCLOSURE"
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
          {props.placeLabel}
          {props.renewId && <small>Renewal</small>}
        </div>
        <button
          type="button"
          className={styles.exit}
          onClick={saveAndExit}
          disabled={pending || created}
        >
          Save and exit
        </button>
      </header>

      <div className={styles.intro}>
        <div>
          <p className={styles.introKicker}>
            Leasing workspace / {props.renewId ? 'Renewal' : 'New lease'}
          </p>
          <h1>{props.renewId ? 'Renew lease' : 'Create lease'}</h1>
          <p>Build the agreement for {props.placeLabel}, one step at a time.</p>
        </div>
        <span className={styles.introDraft} role="status">
          <span aria-hidden="true" />
          {created
            ? 'Lease sent'
            : pending
              ? 'Saving…'
              : dirty
                ? 'Unsaved changes'
                : leaseId
                  ? 'Draft saved'
                  : 'Not saved yet'}
        </span>
      </div>

      <div className={styles.layout} ref={top}>
        <nav aria-label="Lease steps">
          <p className={styles.progressNote}>
            Step {step + 1} of {STEP_COUNT} · {WIZARD_STEPS[step]}
          </p>
          <p className={styles.progressHint}>
            Next saves your progress. Return to any visited step.
          </p>
          <ol className={styles.steps}>
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
                      disabled={pending}
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
                <div className={`${styles.alert} ${styles.success}`} role="status">
                  {signState.message ?? sent.message}
                </div>
                <p className={styles.sub}>
                  Lease status: <strong>{esignStatus ?? 'NOT_SENT'}</strong>
                  {esignStatus === 'SIGNED' &&
                    ' · Signed lease agreement.pdf is stored on the lease.'}
                </p>
                <div className={styles.created}>
                  <Link className={styles.link} href={`/leases/${sent.leaseId}`}>
                    View lease detail
                  </Link>
                  {esignStatus === 'SENT' && (
                    <form action={signAction}>
                      <input type="hidden" name="leaseId" value={sent.leaseId} />
                      <button type="submit" className={styles.btn} disabled={signing}>
                        {signing ? 'Signing…' : 'Complete mock signing'}
                      </button>
                    </form>
                  )}
                </div>
              </div>
            ) : (
              <>
                <fieldset
                  className={styles.stepFields}
                  disabled={pending}
                  aria-label={WIZARD_STEPS[step]}
                >
                  {body}
                </fieldset>
                <div className={styles.footer}>
                  <button
                    type="button"
                    className={styles.btn}
                    disabled={step === 0 || pending}
                    onClick={() => jump(step - 1)}
                  >
                    Back
                  </button>
                  {step < STEP_COUNT - 1 ? (
                    <button
                      type="button"
                      className={`${styles.btn} ${styles.primary}`}
                      disabled={pending}
                      onClick={next}
                    >
                      {pending ? 'Saving…' : 'Next'}
                    </button>
                  ) : (
                    <button
                      type="button"
                      className={`${styles.btn} ${styles.primary}`}
                      disabled={pending}
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
