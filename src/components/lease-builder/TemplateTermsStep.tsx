'use client';

import { useState } from 'react';
import type { WizardDraft } from '@/lib/lease-create/types';
import {
  contextFromDraft,
  resolveTerms,
  type ResolvedTerm,
  type TemplateDefinition,
  type TemplateSection,
  type TermOverride,
} from '@/lib/lease-create/templates';
import { saveTemplateFromDraftAction } from '@/app/(manager)/leases/new/actions';
import { RowMenu } from '@/components/ui/RowMenu';
import { Glyph } from './icons';
import { blanksIn, cx, fieldName } from './summary';
import styles from './lease-builder.module.css';

const sectionNames: Record<TemplateSection, string> = {
  CLAUSE: 'Clauses',
  RULE: 'Rules',
  DISCLOSURE: 'Disclosures',
};
const nouns: Record<TemplateSection, string> = {
  CLAUSE: 'clause',
  RULE: 'rule',
  DISCLOSURE: 'disclosure',
};
/** Reasons that only restate the default; conditional and manual reasons are worth showing. */
const QUIET_REASONS = new Set(['Included by the template', 'Condition is not met']);
const sentence = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

/** One-line preview with unfilled placeholders as small named chips. */
function Preview({ body }: { body: string }) {
  return (
    <>
      {body.split(/(\{\{[a-z_]+\}\})/g).map((part, index) =>
        /^\{\{[a-z_]+\}\}$/.test(part) ? (
          <span key={index} className={styles.blankChip}>
            {fieldName(part.slice(2, -2))}
          </span>
        ) : (
          part
        ),
      )}
    </>
  );
}

export function TemplateTermsStep({
  section,
  draft,
  update,
  templates,
  isRenewal,
  onChangeTemplate,
}: {
  section: TemplateSection;
  draft: WizardDraft;
  update: (patch: Partial<WizardDraft>) => void;
  templates: TemplateDefinition[];
  isRenewal: boolean;
  onChangeTemplate?: () => void;
}) {
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [allExpanded, setAllExpanded] = useState(false);
  const [query, setQuery] = useState('');
  /** Items that needed input when the filter was turned on; they stay listed while filled in. */
  const [needsInput, setNeedsInput] = useState<string[] | null>(null);
  const selected = draft.template ?? templates[0];
  const choices =
    selected && !templates.some((t) => t.id === selected.id && t.version === selected.version)
      ? [selected, ...templates]
      : templates;
  const context = contextFromDraft(draft);
  const terms = selected
    ? resolveTerms(selected, context, draft.termOverrides, draft.renewalTerms)
    : [];
  const updateItem = (id: string, patch: TermOverride) =>
    update({
      termOverrides: {
        ...draft.termOverrides,
        [id]: { ...draft.termOverrides[id], ...patch },
      },
    });
  const add = () => {
    const id = `custom-${crypto.randomUUID()}`;
    setExpanded((value) => ({ ...value, [id]: true }));
    setNeedsInput(null);
    setQuery('');
    updateItem(id, { section, included: true, title: `New ${nouns[section]}`, body: '' });
  };
  const saveAsTemplate = async () => {
    if (!selected) return;
    setSaving(true);
    const name = `${selected.name} copy`;
    try {
      const result = await saveTemplateFromDraftAction({ name, draft });
      if ('error' in result) {
        setMessage(result.error ?? 'Could not save template.');
        return;
      }
      setMessage(`Saved ${result.template.name} · v${result.template.version}`);
      update({ template: result.template, termOverrides: {} });
    } catch {
      setMessage('The template could not be saved. Your draft edits are still here. Try again.');
    } finally {
      setSaving(false);
    }
  };
  // Items whose condition is not met stay out of the way unless the manager has toggled them.
  const sectionTerms = terms.filter((t) => t.section === section);
  const applicable = sectionTerms.filter(
    (t) => t.included || draft.termOverrides[t.id]?.included !== undefined,
  );
  const notApplicable = sectionTerms.filter((t) => !applicable.includes(t));
  const blanksOf = (item: ResolvedTerm) => (item.included ? blanksIn(item.body) : []);
  const pending = applicable.filter((item) => blanksOf(item).length > 0);
  const includedCount = sectionTerms.filter((item) => item.included).length;
  const q = query.trim().toLowerCase();
  const isOpen = (id: string) => expanded[id] ?? allExpanded;
  // An item open for editing stays listed even if an edit stops it matching the search.
  const matches = (item: ResolvedTerm) =>
    !q || expanded[item.id] === true || `${item.title} ${item.body}`.toLowerCase().includes(q);
  const shown = applicable.filter(
    (item) => (!needsInput || needsInput.includes(item.id)) && matches(item),
  );
  const shownElsewhere = needsInput ? [] : notApplicable.filter(matches);
  /** Placeholders the manager fills by hand: not supplied by earlier steps, or already typed. */
  const fillKeys = (item: ResolvedTerm) =>
    blanksIn(
      draft.termOverrides[item.id]?.body ??
        selected?.items.find((source) => source.id === item.id)?.body ??
        item.body,
    ).filter((key) => key in draft.placeholderValues || !context.values?.[key]);

  const renderItem = (item: ResolvedTerm) => {
    const open = isOpen(item.id);
    const blanks = blanksOf(item);
    const custom = item.id.startsWith('custom-');
    const number = applicable.indexOf(item) + 1;
    const tags = [
      item.required && 'Required',
      item.changed && 'Changed',
      custom ? 'Custom' : item.edited && 'Edited',
    ].filter((tag): tag is string => Boolean(tag));
    return (
      <article
        key={item.id}
        className={cx(styles.term, !item.included && styles.termOff, open && styles.termOpen)}
      >
        <div className={styles.termHead}>
          <input
            type="checkbox"
            role="switch"
            className={styles.switch}
            aria-label={`Include ${item.title}`}
            checked={item.included}
            onChange={(e) => updateItem(item.id, { included: e.target.checked })}
          />
          <button
            type="button"
            className={styles.termToggle}
            aria-controls={`term-${item.id}`}
            aria-expanded={open}
            onClick={() => setExpanded((value) => ({ ...value, [item.id]: !open }))}
          >
            <span className={styles.termNumber}>{number > 0 ? number : '–'}</span>
            <span className={styles.termMain}>
              <span className={styles.termTitleRow}>
                <strong className={styles.termTitle}>{item.title || `Untitled ${nouns[section]}`}</strong>
                {!open &&
                  tags.map((tag) => (
                    <span key={tag} className={styles.tag}>
                      {tag}
                    </span>
                  ))}
              </span>
              {!open && item.body && (
                <span className={styles.termPreview} aria-hidden="true">
                  <Preview body={item.body} />
                </span>
              )}
            </span>
            {blanks.length > 0 && (
              <span className={styles.blankBadge}>
                {blanks.length} {blanks.length === 1 ? 'blank' : 'blanks'}
              </span>
            )}
            <Glyph name="chevron" className={styles.chevron} />
          </button>
        </div>
        {open && (
          <div className={styles.termBody} id={`term-${item.id}`}>
            {fillKeys(item).length > 0 && (
              <div className={styles.fills}>
                {fillKeys(item).map((key) => (
                  <label key={key} className={styles.field}>
                    <span className={styles.label}>{sentence(fieldName(key))}</span>
                    <input
                      className={cx(styles.input, !draft.placeholderValues[key] && styles.inputTodo)}
                      aria-label={`Fill ${fieldName(key)}`}
                      value={draft.placeholderValues[key] ?? ''}
                      onChange={(e) =>
                        update({
                          placeholderValues: { ...draft.placeholderValues, [key]: e.target.value },
                        })
                      }
                    />
                  </label>
                ))}
              </div>
            )}
            <label className={styles.field}>
              <span className={styles.label}>Title</span>
              <input
                className={styles.input}
                aria-label={`${item.title} title`}
                value={item.title}
                onChange={(e) => updateItem(item.id, { title: e.target.value })}
              />
            </label>
            <label className={styles.field}>
              <span className={styles.label}>Wording</span>
              <textarea
                className={cx(styles.input, styles.textarea)}
                aria-label={`${item.title} wording`}
                rows={Math.min(12, Math.max(3, Math.ceil(item.body.length / 85)))}
                value={item.body}
                onChange={(e) => updateItem(item.id, { body: e.target.value })}
              />
            </label>
            <p className={styles.termMeta}>
              {[...tags, ...(custom || item.edited ? [] : ['Template'])].map((tag) => (
                <span key={tag} className={styles.tag}>
                  {tag}
                </span>
              ))}
              {!QUIET_REASONS.has(item.reason) && <span>{item.reason}</span>}
            </p>
          </div>
        )}
      </article>
    );
  };

  return (
    <fieldset className={styles.stepFields} disabled={saving}>
      <div className={styles.fields}>
        {isRenewal && (
          <p className={styles.note}>
            <span>Carried over from the prior lease.</span>
            <button
              type="button"
              className={styles.textButton}
              onClick={() => {
                const latest = templates.find((t) => t.id === selected?.id) ?? templates[0];
                update({ template: latest, termOverrides: {} });
              }}
            >
              Re-apply template
            </button>
          </p>
        )}
        <div className={styles.templateBar}>
          <Glyph name="doc" className={styles.templateIcon} />
          {section === 'CLAUSE' ? (
            <>
              <select
                className={cx(styles.input, styles.select, styles.templateSelect)}
                aria-label="Lease template"
                value={selected ? `${selected.id}:${selected.version}` : ''}
                onChange={(e) => {
                  const next = choices.find((t) => `${t.id}:${t.version}` === e.target.value);
                  if (next) update({ template: next, termOverrides: {} });
                }}
              >
                {choices.map((t) => (
                  <option key={`${t.id}:${t.version}`} value={`${t.id}:${t.version}`}>
                    {t.name} · v{t.version}
                    {t === selected &&
                    t.version !== templates.find((current) => current.id === t.id)?.version
                      ? ' (carried over)'
                      : ''}
                  </option>
                ))}
              </select>
              <RowMenu label="Template actions" className={styles.templateMenu}>
                <button type="button" onClick={() => update({ termOverrides: {} })}>
                  Reset to template
                </button>
                <button type="button" onClick={saveAsTemplate} disabled={saving}>
                  Save as new template
                </button>
              </RowMenu>
            </>
          ) : (
            <>
              <span className={styles.templateName}>
                {selected?.name ?? 'No template'}
                <span className={styles.templateVersion}>v{selected?.version ?? 1}</span>
              </span>
              <button
                type="button"
                className={styles.textButton}
                aria-label="Change template"
                onClick={onChangeTemplate}
              >
                Change
              </button>
            </>
          )}
        </div>
        {message && (
          <p role="status" className={styles.footNote}>
            {message}
          </p>
        )}

        <div className={styles.termTools}>
          <span className={styles.searchBox}>
            <Glyph name="search" className={styles.searchIcon} />
            <input
              className={styles.input}
              type="search"
              aria-label={`Search ${sectionNames[section].toLowerCase()}`}
              placeholder={`Search ${sectionNames[section].toLowerCase()}`}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </span>
          {(pending.length > 0 || needsInput) && (
            <button
              type="button"
              className={cx(styles.filterChip, needsInput && styles.filterChipOn)}
              aria-pressed={Boolean(needsInput)}
              onClick={() => setNeedsInput(needsInput ? null : pending.map((item) => item.id))}
            >
              Needs input
              <span className={styles.filterCount}>{pending.length}</span>
            </button>
          )}
          <button
            type="button"
            className={cx(styles.btn, styles.btnGhost, styles.btnSmall)}
            onClick={() => {
              setAllExpanded(!allExpanded);
              setExpanded({});
            }}
          >
            {allExpanded ? 'Collapse all' : 'Expand all'}
          </button>
        </div>
        <p className={styles.termCount}>
          {includedCount} included
          {notApplicable.length > 0 ? ` · ${notApplicable.length} not applicable` : ''}
        </p>

        <div className={styles.terms}>
          {shown.map(renderItem)}
          {!shown.length && (
            <p className={styles.emptyRow}>
              {applicable.length
                ? 'No matches'
                : `No ${sectionNames[section].toLowerCase()} in this lease yet`}
            </p>
          )}
        </div>
        {shownElsewhere.length > 0 && (
          <details className={styles.notApplicable}>
            <summary>
              Not applicable to this lease ({shownElsewhere.length})
              <Glyph name="chevron" className={styles.chevron} />
            </summary>
            <div className={styles.terms}>{shownElsewhere.map(renderItem)}</div>
          </details>
        )}
        <button type="button" className={cx(styles.btn, styles.btnDashed)} onClick={add}>
          + Add {nouns[section]}
        </button>
      </div>
    </fieldset>
  );
}
