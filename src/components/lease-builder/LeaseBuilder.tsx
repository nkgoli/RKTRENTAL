'use client';

import Link from 'next/link';
import { useCallback, useEffect, useRef, useState, useTransition, type RefObject } from 'react';
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
import type { TemplateDefinition } from '@/lib/lease-create/templates';
import { useBuilderShell } from './useBuilderShell';
import { SigningPanel } from '@/components/lease-signing/SigningPanel';
import { SendAgreementButton } from '@/components/lease-signing/SendAgreementButton';
import { DeleteDraftButton } from '@/components/lease-create/DeleteDraftButton';
import { Glyph } from './icons';
import { SummaryRail } from './SummaryRail';
import { blanksIn, cx, draftTerms, listText } from './summary';

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
  noticeApplicantId?: string;
  backHref: string;
  /** Property of the lease's unit; read from backHref when omitted. */
  propertyId?: string;
  /** Where Save and exit goes. */
  exitHref: string;
};

const SUBTITLES: Record<number, string> = {
  [STEP.term]: 'When the lease starts and ends.',
  [STEP.rent]: 'Rent, deposit and move-in charges.',
  [STEP.tenants]: 'Who signs this lease.',
  [STEP.options]: 'Renewal notice, occupants and property features.',
  [STEP.clauses]: 'The terms of the agreement.',
  [STEP.rules]: 'House rules tenants agree to.',
  [STEP.disclosures]: 'Disclosures included with the lease.',
  [STEP.attachments]: 'Files that go out with the lease.',
  [STEP.lessor]: 'Who the agreement names as lessor.',
  [STEP.review]: 'Check the details, then send.',
};

const STEP_GROUPS = [
  { label: 'Basics', steps: [STEP.term, STEP.rent, STEP.tenants] },
  { label: 'Agreement', steps: [STEP.options, STEP.clauses, STEP.rules, STEP.disclosures] },
  { label: 'Finish', steps: [STEP.attachments, STEP.lessor, STEP.review] },
];

const idle: WizardActionState = {};

/** After sending: what happened, who signs next, and the live signing status below. */
function CreatedPanel({
  sent,
  signers,
  headingRef,
}: {
  sent: WizardActionState;
  signers: string[];
  headingRef: RefObject<HTMLHeadingElement | null>;
}) {
  const leaseId = sent.leaseId!;
  const notSent = sent.esignStatus === 'NOT_SENT';
  return (
    <div className={styles.created}>
      <div className={cx(styles.createdHero, notSent && styles.createdWarn)}>
        <span className={styles.createdMark} aria-hidden="true">
          <Glyph name={notSent ? 'alert' : 'check'} />
        </span>
        <h2 id="step-title" className={styles.createdTitle} tabIndex={-1} ref={headingRef}>
          {notSent ? 'Lease activated, not sent' : 'Lease sent for e-signature'}
        </h2>
        {notSent ? (
          <p className={styles.createdText}>{sent.message}</p>
        ) : (
          <>
            {signers.length > 0 && (
              <p className={styles.createdText}>{listText(signers)} sign next.</p>
            )}
            <p className={styles.createdNote}>No email or text was sent.</p>
          </>
        )}
        <div className={styles.createdActions}>
          <a className={cx(styles.btn, styles.btnPrimary)} href={`/leases/${leaseId}`}>
            View lease
          </a>
          {!notSent && (
            <a className={cx(styles.btn, styles.btnOutline)} href={`/sign/leases/${leaseId}`}>
              Open signing page
            </a>
          )}
        </div>
      </div>
      <div className={styles.createdDetail}>
        {notSent ? (
          <SendAgreementButton leaseId={leaseId} />
        ) : (
          <SigningPanel leaseId={leaseId} documentsHref={`/leases/${leaseId}?tab=documents`} />
        )}
      </div>
    </div>
  );
}

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
  const [summaryOpen, setSummaryOpen] = useState(false);
  const created = Boolean(sent.ok && sent.leaseId);
  const top = useRef<HTMLDivElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const errorSummary = useRef<HTMLDivElement>(null);
  const footer = useRef<HTMLElement>(null);
  const [stuck, setStuck] = useState(false);

  // The action bar sits 1px past the scroll edge while it is pinned, so a partial intersection
  // means it floats over the step and earns its shadow.
  useEffect(() => {
    const element = footer.current;
    if (!element || typeof IntersectionObserver === 'undefined') return;
    const observer = new IntersectionObserver(([entry]) => setStuck(entry.intersectionRatio < 1), {
      threshold: [1],
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, [step, created]);

  // A new step, or the sent confirmation, takes focus so its title is announced.
  useEffect(() => {
    if (!hydrated) return;
    heading.current?.focus({ preventScroll: true });
    top.current?.scrollIntoView({ block: 'start' });
    top.current
      ?.querySelector('[aria-current="step"]')
      ?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }, [step, hydrated, created]);

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

  const esignStatus = sent.esignStatus;
  const unresolvedTerms = draftTerms(draft).filter(
    (item) => item.included && blanksIn(item.body).length > 0,
  );
  const saveState = created
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
            : 'Not saved yet';
  const saveTone = created
    ? esignStatus === 'NOT_SENT'
      ? 'warn'
      : 'ok'
    : deleting || pending
      ? 'busy'
      : dirty
        ? 'warn'
        : leaseId
          ? 'ok'
          : 'idle';
  const signers = [
    ...draft.tenantIds.flatMap((id) => tenants.filter((tenant) => tenant.id === id)),
    ...(props.lessorSigner ? [props.lessorSigner] : []),
  ].map((party) => party.name);
  const wide = step === STEP.review || created;
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
      noticeApplicantId={props.noticeApplicantId}
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
    <LessorStep
      key="lessor"
      draft={draft}
      update={update}
      errors={errors}
      lessorSigner={props.lessorSigner}
    />,
    <ReviewStep
      key="review"
      lessorSigner={props.lessorSigner}
      draft={draft}
      errors={errors}
      unitLabel={props.placeLabel}
      tenants={tenants}
      attachments={attachments}
      isRenewal={Boolean(props.renewId)}
      onJump={jump}
    />,
  ][step];

  return (
    <div className={styles.page} role="region" aria-label="Create lease" inert={!hydrated}>
      <header className={styles.topbar}>
        <Link className={styles.back} href={props.backHref} aria-label="Back to property leases">
          <Glyph name="back" />
        </Link>
        <p className={styles.kind}>{props.renewId ? 'Renewal' : 'New lease'}</p>
        <h1 className={styles.place}>{props.placeLabel}</h1>
        <span className={styles.saveState} data-tone={saveTone} role="status">
          {saveState}
        </span>
        <span className={styles.barActions}>
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
          {!created && (
            <button
              type="button"
              className={cx(styles.btn, styles.btnOutline, styles.exit)}
              onClick={saveAndExit}
              disabled={busy}
            >
              Save and exit
            </button>
          )}
        </span>
      </header>

      <div className={cx(styles.layout, wide && styles.layoutWide)} ref={top}>
        <nav className={styles.rail} aria-label="Lease steps">
          <div className={styles.progress}>
            <span className={styles.progressText}>
              Step {step + 1} of {STEP_COUNT}
            </span>
            <span className={styles.progressTrack} aria-hidden="true">
              <span style={{ transform: `scaleX(${(step + 1) / STEP_COUNT})` }} />
            </span>
          </div>
          <ol className={styles.steps} tabIndex={0} aria-label="All 10 lease creation steps">
            {STEP_GROUPS.map((group) => (
              <li key={group.label} className={styles.stepGroup}>
                <span className={styles.groupLabel}>{group.label}</span>
                <ol className={styles.groupSteps}>
                  {group.steps.map((index) => {
                    const label = WIZARD_STEPS[index];
                    const done = created || (index < furthest && index !== step);
                    const current = !created && index === step;
                    const clickable = !created && !current && index <= furthest;
                    const className = cx(
                      styles.step,
                      done && styles.done,
                      current && styles.current,
                      clickable && styles.visited,
                    );
                    const content = (
                      <>
                        <span className={styles.marker}>
                          {done ? <Glyph name="check" /> : index + 1}
                        </span>
                        <span className={styles.stepLabel}>{label}</span>
                        {done && <span className={styles.srOnly}>, completed</span>}
                      </>
                    );
                    return (
                      <li key={label} className={styles.stepItem}>
                        {clickable ? (
                          <button
                            type="button"
                            className={className}
                            onClick={() => jump(index)}
                            disabled={busy}
                          >
                            {content}
                          </button>
                        ) : (
                          <span className={className} aria-current={current ? 'step' : undefined}>
                            {content}
                          </span>
                        )}
                      </li>
                    );
                  })}
                </ol>
              </li>
            ))}
          </ol>
        </nav>

        {!wide && (
          <SummaryRail
            draft={draft}
            placeLabel={props.placeLabel}
            tenants={tenants}
            fileCount={attachments.length}
            open={summaryOpen}
            onToggle={() => setSummaryOpen((open) => !open)}
          />
        )}

        <section className={styles.card} aria-labelledby="step-title">
          {created ? (
            <CreatedPanel sent={sent} signers={signers} headingRef={heading} />
          ) : (
            <>
              <header className={styles.cardHead}>
                <h2 id="step-title" className={styles.stepTitle} tabIndex={-1} ref={heading}>
                  {WIZARD_STEPS[step]}
                </h2>
                <p className={styles.sub}>{SUBTITLES[step]}</p>
              </header>
              <div className={styles.cardBody}>
                {message && (
                  <div className={styles.alert} role="alert" tabIndex={-1} ref={errorSummary}>
                    <Glyph name="alert" className={styles.alertIcon} />
                    <div>
                      <strong>{message}</strong>
                      {Object.keys(errors).length > 0 && (
                        <ul>
                          {Object.entries(errors).map(([field, error]) => (
                            <li key={field}>{error}</li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </div>
                )}
                <fieldset className={styles.stepFields} disabled={busy}>
                  {body}
                </fieldset>
              </div>
              <footer className={cx(styles.footer, stuck && styles.footerStuck)} ref={footer}>
                <button
                  type="button"
                  className={cx(styles.btn, styles.btnGhost)}
                  disabled={step === 0 || busy}
                  onClick={() => jump(step - 1)}
                >
                  <Glyph name="back" />
                  Back
                </button>
                {step < STEP_COUNT - 1 ? (
                  <button
                    type="button"
                    className={cx(styles.btn, styles.btnPrimary)}
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
                        <Glyph name="next" />
                      </>
                    )}
                  </button>
                ) : (
                  <button
                    type="button"
                    className={cx(styles.btn, styles.btnPrimary)}
                    disabled={busy || unresolvedTerms.length > 0}
                    onClick={send}
                  >
                    {pending ? 'Sending…' : 'Send for e-signature'}
                  </button>
                )}
              </footer>
            </>
          )}
        </section>
      </div>
    </div>
  );
}
