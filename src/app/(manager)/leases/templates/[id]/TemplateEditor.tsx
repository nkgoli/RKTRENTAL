'use client';

import { useRouter } from 'next/navigation';
import { PageHeader } from '@/components/shell/PageHeader';
import { useState } from 'react';
import { deleteLeaseTemplateAction, saveLeaseTemplateAction, setPropertyLeaseTemplateAction } from '../actions';
import { CONDITION_LABELS, INCLUDE_WHEN, STANDARD_FEES, type TemplateDefinition, type TemplateItem, type TemplateSection } from '@/lib/lease-create/templates';
import styles from './template-editor.module.css';

type PropertyChoice = { id: string; name: string; defaultLeaseTemplateId: string | null };
const sections: TemplateSection[] = ['CLAUSE', 'RULE', 'DISCLOSURE'];
const labels = { CLAUSE: 'Clauses', RULE: 'Rules', DISCLOSURE: 'Disclosures' };

export function TemplateEditor({ initial, properties }: { initial: TemplateDefinition | null; properties: PropertyChoice[] }) {
  const router = useRouter();
  const [name, setName] = useState(initial?.name ?? 'New lease template');
  const [items, setItems] = useState<TemplateItem[]>(initial?.items ?? []);
  const [fees, setFees] = useState(initial?.defaultFees ?? STANDARD_FEES);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [allExpanded, setAllExpanded] = useState(false);
  const edit = (id: string, patch: Partial<TemplateItem>) => setItems((all) => all.map((item) => item.id === id ? { ...item, ...patch } : item));
  const add = (section: TemplateSection) => {
    const id = `new-${crypto.randomUUID()}`;
    setExpanded((value) => ({ ...value, [id]: true }));
    setItems((all) => [...all, { id, section, title: '', body: '', order: all.length,
      required: false, includeWhen: 'ALWAYS' }]);
  };
  const move = (id: string, delta: number) => setItems((all) => {
    const index = all.findIndex((item) => item.id === id);
    const next = index + delta;
    if (index < 0 || next < 0 || next >= all.length || all[index].section !== all[next].section) return all;
    const copy = [...all];
    [copy[index], copy[next]] = [copy[next], copy[index]];
    return copy.map((item, order) => ({ ...item, order }));
  });
  const save = async (duplicate = false) => {
    setBusy(true);
    const result = await saveLeaseTemplateAction({ id: duplicate ? undefined : initial?.id,
      name: duplicate ? `${name} copy` : name, items, defaultFees: fees });
    setBusy(false);
    if ('error' in result) { setMessage(result.error ?? 'Could not save template.'); return; }
    if (result.template) router.push(`/leases/templates/${result.template.id}`);
    router.refresh();
    setMessage(`Saved version ${result.template?.version ?? 1}.`);
  };
  const remove = async () => {
    if (!initial) return;
    setBusy(true);
    const result = await deleteLeaseTemplateAction(initial.id);
    setBusy(false);
    if ('error' in result) { setMessage(result.error ?? 'Could not delete template.'); return; }
    router.push('/leases/templates');
    router.refresh();
  };
  const setDefault = async (propertyId: string) => {
    if (!initial) { setMessage('Save this template before making it a property default.'); return; }
    const result = await setPropertyLeaseTemplateAction(propertyId, initial.id);
    setMessage('error' in result ? result.error ?? 'Could not set default.' : 'Property default updated.');
    router.refresh();
  };
  return <div className={styles.page}>
    <PageHeader
      eyebrow="Lease templates"
      title={initial ? 'Edit lease template' : 'Create lease template'}
      actions={[{ label: 'All templates', href: '/leases/templates' }]}
    />
    <p className="muted">Set the terms your team starts with. Each item can still be changed in a lease draft. Review templates with a local attorney before use.</p>
    {message && <p role="status" className={styles.note}>{message}</p>}
    <div className={styles.layout}><div className={styles.panel}>
      <div className={styles.panelHead}><h2>{name}</h2><span>v{initial?.version ?? 1} · Saving changes creates a new version</span></div>
      <div className={styles.panelBody}><label className={styles.field}>Template name<input value={name} onChange={(e) => setName(e.target.value)} /></label>
        <button type="button" className="btn btn-secondary" onClick={() => { setAllExpanded(!allExpanded); setExpanded({}); }}>{allExpanded ? 'Collapse all' : 'Expand all'}</button>
        {sections.map((section) => <section key={section} className={styles.section}>
          <div className={styles.sectionHead}><h3>{labels[section]}</h3><button type="button" className="btn btn-secondary" onClick={() => add(section)}>+ Add {section.toLowerCase()}</button></div>
          {items.filter((item) => item.section === section).map((item) => <article key={item.id} className={styles.item}>
            <button type="button" className={styles.itemToggle} aria-expanded={expanded[item.id] ?? allExpanded} onClick={() => setExpanded((value) => ({ ...value, [item.id]: !(value[item.id] ?? allExpanded) }))}>
              <strong>{items.filter((entry) => entry.section === section).findIndex((entry) => entry.id === item.id) + 1}. {item.title || 'New item'}</strong>
              <span>{expanded[item.id] ?? allExpanded ? 'Collapse' : 'Expand'}</span>
            </button>
            <p className={styles.itemPreview}>{item.body.replace(/\{\{([a-z_]+)\}\}/g, '________ ($1)')}</p>
            {(expanded[item.id] ?? allExpanded) && <><p className={styles.itemFull}>{item.body}</p>
            <div className={styles.itemHead}><button type="button" aria-label={`Move ${item.title} up`} onClick={() => move(item.id, -1)}>↑</button>
              <button type="button" aria-label={`Move ${item.title} down`} onClick={() => move(item.id, 1)}>↓</button>
              <input aria-label={`${item.title || 'New item'} title`} placeholder="Title" value={item.title} onChange={(e) => edit(item.id, { title: e.target.value })} /></div>
            <textarea aria-label={`${item.title || 'New item'} wording`} placeholder="Write the term in plain language" value={item.body} onChange={(e) => edit(item.id, { body: e.target.value })} />
            <div className={styles.itemOptions}><label>Include when… <select aria-label={`${item.title || 'New item'} include when`} value={item.includeWhen} onChange={(e) => edit(item.id, { includeWhen: e.target.value as TemplateItem['includeWhen'] })}>
              {INCLUDE_WHEN.map((condition) => <option key={condition} value={condition}>{CONDITION_LABELS[condition]}</option>)}
            </select></label><label><input type="checkbox" checked={item.required} onChange={(e) => edit(item.id, { required: e.target.checked })} /> Required by template</label>
            <button type="button" onClick={() => setItems((all) => all.filter((i) => i.id !== item.id))}>Remove</button></div></>}
          </article>)}
        </section>)}
        <section className={styles.section}><h3>Default fees</h3><p className="muted">These prefill Rent, deposit &amp; fees.</p><div className={styles.feeGrid}>
          {(['lateFee', 'graceDays', 'moveInFee', 'petDeposit', 'returnedPaymentFee', 'keyFee'] as const).map((field) => <label key={field} className={styles.field}>{({ lateFee: 'Late fee', graceDays: 'Grace days', moveInFee: 'Move-in fee', petDeposit: 'Pet deposit', returnedPaymentFee: 'Returned payment fee', keyFee: 'Key replacement fee' })[field]}
            <input type="number" min="0" value={fees[field] ?? ''} onChange={(e) => setFees({ ...fees, [field]: field === 'graceDays' ? Number(e.target.value) : e.target.value })} />
          </label>)}
        </div></section>
      </div>
      <div className={styles.footer}><button type="button" className="btn btn-secondary" disabled={busy} onClick={() => save(true)}>Duplicate</button>
        {initial && <button type="button" className="btn btn-secondary" disabled={busy} onClick={remove}>Delete when unused</button>}
        <button type="button" className="btn btn-primary" disabled={busy} onClick={() => save()}>Save template</button></div>
    </div><aside className={styles.panel}><div className={styles.panelHead}><h2>Apply to properties</h2></div><div className={styles.panelBody}>
      {properties.map((property) => <div key={property.id} className={styles.property}><strong>{property.name}</strong>
        {property.defaultLeaseTemplateId === initial?.id ? <span>Default for this property</span>
          : <button type="button" onClick={() => setDefault(property.id)}>Set as default</button>}</div>)}
      <p className={styles.note}>The default is selected automatically for a unit in that property.</p>
    </div></aside></div>
  </div>;
}
