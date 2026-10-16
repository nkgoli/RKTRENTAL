'use client';

import { useState } from 'react';
import type { WizardDraft } from '@/lib/lease-create/types';
import { contextFromDraft, resolveTerms, type TemplateDefinition, type TemplateSection, type TermOverride } from '@/lib/lease-create/templates';
import { saveTemplateFromDraftAction } from '@/app/(manager)/leases/new/actions';
import styles from './lease-builder.module.css';

const sectionNames: Record<TemplateSection, string> = { CLAUSE: 'Clauses', RULE: 'Rules', DISCLOSURE: 'Disclosures' };

export function TemplateTermsStep({ section, draft, update, templates, isRenewal }: {
  section: TemplateSection;
  draft: WizardDraft;
  update: (patch: Partial<WizardDraft>) => void;
  templates: TemplateDefinition[];
  isRenewal: boolean;
}) {
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [allExpanded, setAllExpanded] = useState(false);
  const selected = draft.template ?? templates[0];
  const choices = selected && !templates.some((t) => t.id === selected.id && t.version === selected.version)
    ? [selected, ...templates] : templates;
  const terms = selected ? resolveTerms(selected, contextFromDraft(draft), draft.termOverrides, draft.renewalTerms) : [];
  const updateItem = (id: string, patch: TermOverride) => update({ termOverrides: {
    ...draft.termOverrides, [id]: { ...draft.termOverrides[id], ...patch },
  } });
  const add = () => {
    const id = `custom-${crypto.randomUUID()}`;
    setExpanded((value) => ({ ...value, [id]: true }));
    updateItem(id, { section, included: true, title: `New ${section.toLowerCase()}`, body: '' });
  };
  const saveAsTemplate = async () => {
    if (!selected) return;
    setSaving(true);
    const name = `${selected.name} copy`;
    const result = await saveTemplateFromDraftAction({ name, draft });
    setSaving(false);
    if ('error' in result) { setMessage(result.error ?? 'Could not save template.'); return; }
    setMessage(`Saved ${result.template.name} · v${result.template.version}`);
    update({ template: result.template, termOverrides: {} });
  };
  // Items whose condition is not met stay out of the way unless the manager has toggled them.
  const sectionTerms = terms.filter((t) => t.section === section);
  const applicable = sectionTerms.filter((t) => t.included || draft.termOverrides[t.id]?.included !== undefined);
  const notApplicable = sectionTerms.filter((t) => !applicable.includes(t));
  const renderText = (body: string) => body.split(/(\{\{[a-z_]+\}\})/g).map((part, index) =>
    /^\{\{[a-z_]+\}\}$/.test(part) ? <mark key={index} className={styles.termBlank} title={part.slice(2, -2)}>________ ({part.slice(2, -2).replaceAll('_', ' ')})</mark> : part);
  const renderItem = (item: (typeof terms)[number]) => <article key={item.id} className={styles.templateItem}>
    <div className={styles.templateItemTop}>
      <label><input type="checkbox" checked={item.included} onChange={(e) => updateItem(item.id, { included: e.target.checked })} /> Include</label>
      {item.required && <span className={styles.termBadge}>Required by template</span>}
      {item.edited && <span className={styles.termBadge}>Edited</span>}
      {item.changed && <span className={styles.termBadge}>Changed</span>}
    </div>
    <button type="button" className={styles.termToggle} aria-expanded={expanded[item.id] ?? allExpanded} onClick={() => setExpanded((value) => ({ ...value, [item.id]: !(value[item.id] ?? allExpanded) }))}>
      <strong>{sectionTerms.findIndex((term) => term.id === item.id) + 1}. {item.title}</strong>
      <span>{expanded[item.id] ?? allExpanded ? 'Collapse' : 'Expand'}</span>
    </button>
    <p className={styles.termPreview}>{renderText(item.body)}</p>
    {(expanded[item.id] ?? allExpanded) && <div className={styles.termExpanded}>
      <p className={styles.termFull}>{renderText(item.body)}</p>
      {[...new Set([...item.body.matchAll(/\{\{([a-z_]+)\}\}/g)].map((match) => match[1]))].map((key) => <label key={key}>
        Fill {key.replaceAll('_', ' ')}<input aria-label={`Fill ${key.replaceAll('_', ' ')}`} value={draft.placeholderValues[key] ?? ''} onChange={(e) => update({ placeholderValues: { ...draft.placeholderValues, [key]: e.target.value } })} />
      </label>)}
      <label>Title<input aria-label={`${item.title} title`} value={item.title} onChange={(e) => updateItem(item.id, { title: e.target.value })} /></label>
      <label>Wording<textarea aria-label={`${item.title} wording`} value={item.body} onChange={(e) => updateItem(item.id, { body: e.target.value })} /></label>
    </div>}
    <p className={styles.termReason}>{item.reason}</p>
  </article>;
  return <div className={styles.fields}>
    {isRenewal && <div className={styles.alert} role="status">
      Carried over from the prior lease. Items marked Changed have been re-evaluated for this renewal.
      <button type="button" className={styles.btn} onClick={() => {
        const latest = templates.find((t) => t.id === selected?.id) ?? templates[0];
        update({ template: latest, termOverrides: {} });
      }}>Re-apply template</button>
    </div>}
    <div className={styles.templateBar}>
      <label>Lease template
        <select aria-label="Lease template" value={selected ? `${selected.id}:${selected.version}` : ''} onChange={(e) => {
          const next = choices.find((t) => `${t.id}:${t.version}` === e.target.value);
          if (next) update({ template: next, termOverrides: {} });
        }}>
          {choices.map((t) => <option key={`${t.id}:${t.version}`} value={`${t.id}:${t.version}`}>{t.name} · v{t.version}{t === selected && t.version !== templates.find((current) => current.id === t.id)?.version ? ' (carried over)' : ''}</option>)}
        </select>
      </label>
      <button type="button" className={styles.btn} onClick={() => update({ termOverrides: {} })}>Reset to template</button>
      <button type="button" className={styles.btn} onClick={saveAsTemplate} disabled={saving}>Save as new template</button>
    </div>
    {message && <p role="status">{message}</p>}
    <div className={styles.templateHeading}><h3>{sectionNames[section]} in this lease</h3><p>Conditions are checked using the property and the choices in earlier steps. You can edit or uncheck each item.</p>
      <button type="button" className={styles.btn} onClick={() => { setAllExpanded(!allExpanded); setExpanded({}); }}>{allExpanded ? 'Collapse all' : 'Expand all'}</button></div>
    {applicable.map(renderItem)}
    {notApplicable.length > 0 && <details>
      <summary>Not applicable to this lease ({notApplicable.length})</summary>
      {notApplicable.map(renderItem)}
    </details>}
    <button type="button" className={styles.btn} onClick={add}>+ Add {section.toLowerCase()}</button>
    <p className={styles.termReason}>The wording sent for signature is kept on the lease even if this template changes later.</p>
  </div>;
}
