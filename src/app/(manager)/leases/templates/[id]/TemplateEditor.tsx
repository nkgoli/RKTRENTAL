'use client';

import { useRouter } from 'next/navigation';
import { PageHeader } from '@/components/shell/PageHeader';
import { useEffect, useRef, useState } from 'react';
import {
  deleteLeaseTemplateAction,
  saveLeaseTemplateAction,
  setPropertyLeaseTemplateAction,
} from '../actions';
import {
  CONDITION_LABELS,
  INCLUDE_WHEN,
  STANDARD_FEES,
  type TemplateDefinition,
  type TemplateItem,
  type TemplateSection,
} from '@/lib/lease-create/templates';
import styles from '../templates.module.css';
import { TemplateIcon } from '../TemplateIcons';

type PropertyChoice = { id: string; name: string; defaultLeaseTemplateId: string | null };
const sections: TemplateSection[] = ['CLAUSE', 'RULE', 'DISCLOSURE'];
const labels = { CLAUSE: 'Clauses', RULE: 'Rules', DISCLOSURE: 'Disclosures' };

export function TemplateEditor({
  initial,
  properties,
}: {
  initial: TemplateDefinition | null;
  properties: PropertyChoice[];
}) {
  const router = useRouter();
  const [name, setName] = useState(initial?.name ?? 'New lease template');
  const [items, setItems] = useState<TemplateItem[]>(initial?.items ?? []);
  const [fees, setFees] = useState(initial?.defaultFees ?? STANDARD_FEES);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [version, setVersion] = useState(initial?.version ?? 1);
  const [invalid, setInvalid] = useState(false);
  const messageRef = useRef<HTMLParagraphElement>(null);
  useEffect(() => {
    if (message) messageRef.current?.focus();
  }, [message]);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [allExpanded, setAllExpanded] = useState(false);
  const changed = () => {
    setDirty(true);
    setMessage('');
  };
  const edit = (id: string, patch: Partial<TemplateItem>) => {
    changed();
    setItems((all) => all.map((item) => (item.id === id ? { ...item, ...patch } : item)));
  };
  const add = (section: TemplateSection) => {
    changed();
    const id = `new-${crypto.randomUUID()}`;
    setExpanded((value) => ({ ...value, [id]: true }));
    setItems((all) => [
      ...all,
      {
        id,
        section,
        title: '',
        body: '',
        order: all.length,
        required: false,
        includeWhen: 'ALWAYS',
      },
    ]);
  };
  const move = (id: string, delta: number) => {
    changed();
    setItems((all) => {
      const index = all.findIndex((item) => item.id === id);
      if (index < 0) return all;
      const siblings = all
        .map((item, position) => ({ item, position }))
        .filter(({ item }) => item.section === all[index].section);
      const next =
        siblings[siblings.findIndex(({ position }) => position === index) + delta]?.position;
      if (next === undefined) return all;
      const copy = [...all];
      [copy[index], copy[next]] = [copy[next], copy[index]];
      return copy.map((item, order) => ({ ...item, order }));
    });
  };
  const save = async (duplicate = false) => {
    setInvalid(true);
    const incomplete = items.find((item) => !item.title.trim() || !item.body.trim());
    if (!name.trim()) {
      setMessage('Enter a template name.');
      return;
    }
    if (incomplete) {
      setExpanded((value) => ({ ...value, [incomplete.id]: true }));
      setMessage(
        `Complete the title and wording for ${incomplete.title || 'the new item'} in ${labels[incomplete.section]}.`,
      );
      return;
    }
    if (
      Object.entries(fees).some(
        ([key, value]) =>
          key !== 'graceDays' && value && (!Number.isFinite(Number(value)) || Number(value) < 0),
      )
    ) {
      setMessage('Enter a valid amount of zero or more for each fee.');
      return;
    }
    if (!Number.isInteger(fees.graceDays) || fees.graceDays < 0 || fees.graceDays > 31) {
      setMessage('Enter 0 to 31 grace days.');
      return;
    }
    setMessage('');
    setBusy(true);
    try {
      const result = await saveLeaseTemplateAction({
        id: duplicate ? undefined : initial?.id,
        name: duplicate ? `${name} copy` : name,
        items,
        defaultFees: fees,
      });
      if ('error' in result) {
        setMessage(result.error ?? 'Could not save template.');
        return;
      }
      if (result.template) {
        setName(result.template.name);
        setVersion(result.template.version);
        setItems(result.template.items);
        setDirty(false);
        setInvalid(false);
      }
      if (result.template && (duplicate || !initial)) {
        router.push(`/leases/templates/${result.template.id}`);
      } else {
        router.refresh();
      }
      setMessage(`Saved version ${result.template?.version ?? 1}.`);
    } catch {
      setMessage('The template could not be saved. Your edits are still here; try again.');
    } finally {
      setBusy(false);
    }
  };
  const remove = async () => {
    if (!initial) return;
    setBusy(true);
    try {
      const result = await deleteLeaseTemplateAction(initial.id);
      if ('error' in result) {
        setMessage(result.error ?? 'Could not delete template.');
        return;
      }
      router.push('/leases/templates');
    } catch {
      setMessage('The template could not be deleted. Try again.');
    } finally {
      setBusy(false);
    }
  };
  const setDefault = async (propertyId: string) => {
    if (!initial) {
      setMessage('Save this template before making it a property default.');
      return;
    }
    setBusy(true);
    try {
      const result = await setPropertyLeaseTemplateAction(propertyId, initial.id);
      setMessage(
        'error' in result
          ? (result.error ?? 'Could not set default.')
          : 'Property default updated.',
      );
      router.refresh();
    } catch {
      setMessage('The property default could not be updated. Try again.');
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className={styles.page}>
      <PageHeader
        eyebrow="Lease templates"
        title={initial ? 'Edit lease template' : 'Create lease template'}
        actions={[{ label: 'All templates', href: '/leases/templates' }]}
      />
      <p className="muted">
        Set the terms your team starts with. Each item can still be changed in a lease draft. Review
        templates with a local attorney before use.
      </p>
      <div className={styles['lt-savebar']}>
        <div>
          <strong>{name || 'Untitled template'}</strong>
          <span role="status">
            {busy ? 'Saving…' : dirty ? 'Unsaved changes' : `Version ${version}`}
          </span>
        </div>
        <button type="button" className="btn btn-primary" disabled={busy} onClick={() => save()}>
          {busy ? 'Saving…' : 'Save template'}
        </button>
      </div>
      {message && (
        <p
          id="template-feedback"
          ref={messageRef}
          tabIndex={-1}
          role="status"
          className={`${styles['lt-feedback']} ${/^(Saved version|Property default updated)/.test(message) ? styles.success : styles.error}`}
        >
          {message}
        </p>
      )}
      <nav className={styles['lt-section-nav']} aria-label="Template sections">
        {sections.map((section) => (
          <a key={section} href={`#template-${section.toLowerCase()}`}>
            {labels[section]} <span>{items.filter((item) => item.section === section).length}</span>
          </a>
        ))}
        <a href="#template-fees">Default fees</a>
        <a href="#template-properties">Property defaults</a>
      </nav>
      <fieldset className={styles.editFields} disabled={busy}>
        <div className={styles['lt-editor-grid']}>
          <div className={styles['lt-panel']}>
            <div className={styles['lt-panel-head']}>
              <h2>{name || 'Untitled template'}</h2>
              <span className={styles['lt-badge']}>v{version}</span>
            </div>
            <div className={styles['lt-panel-body']}>
              <p className={styles['lt-feedback']}>
                Saving creates a new version. Sent and signed leases keep their wording.
              </p>
              <label className={styles['lt-field']}>
                Template name
                <input
                  aria-describedby={message ? 'template-feedback' : undefined}
                  aria-invalid={invalid && !name.trim()}
                  value={name}
                  onChange={(e) => {
                    changed();
                    setName(e.target.value);
                  }}
                />
              </label>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => {
                  setAllExpanded(!allExpanded);
                  setExpanded({});
                }}
              >
                {allExpanded ? 'Collapse all' : 'Expand all'}
              </button>
              {sections.map((section) => (
                <section
                  key={section}
                  className={styles['lt-section']}
                  id={`template-${section.toLowerCase()}`}
                >
                  <div className={styles['lt-section-heading']}>
                    <h3>
                      {labels[section]}{' '}
                      <span className={styles['lt-badge']}>
                        {items.filter((item) => item.section === section).length}
                      </span>
                    </h3>
                    <button
                      type="button"
                      className="btn btn-secondary"
                      aria-label={`+ Add ${section.toLowerCase()}`}
                      onClick={() => add(section)}
                    >
                      <TemplateIcon name="add" /> Add {section.toLowerCase()}
                    </button>
                  </div>
                  {!items.some((item) => item.section === section) && (
                    <p className={styles['lt-small']}>
                      No {labels[section].toLowerCase()} yet. Add reusable wording for future
                      leases.
                    </p>
                  )}
                  {items
                    .filter((item) => item.section === section)
                    .map((item) => (
                      <article key={item.id} className={styles['lt-item']}>
                        <button
                          type="button"
                          className={styles['lt-item-toggle']}
                          aria-controls={`template-item-${item.id}`}
                          aria-expanded={expanded[item.id] ?? allExpanded}
                          onClick={() =>
                            setExpanded((value) => ({
                              ...value,
                              [item.id]: !(value[item.id] ?? allExpanded),
                            }))
                          }
                        >
                          <strong>
                            {items
                              .filter((entry) => entry.section === section)
                              .findIndex((entry) => entry.id === item.id) + 1}
                            . {item.title || 'New item'}
                          </strong>
                          <span>{(expanded[item.id] ?? allExpanded) ? 'Collapse' : 'Expand'}</span>
                        </button>
                        <p className={styles['lt-item-preview']}>
                          {item.body.replace(/\{\{([a-z_]+)\}\}/g, '________ ($1)')}
                        </p>
                        <p className={styles['lt-item-meta']}>
                          {CONDITION_LABELS[item.includeWhen]} ·{' '}
                          {item.required ? 'Required by template' : 'Optional'}
                        </p>
                        {(expanded[item.id] ?? allExpanded) && (
                          <div className={styles['lt-item-edit']} id={`template-item-${item.id}`}>
                            <div className={styles['reorder']}>
                              <button
                                type="button"
                                aria-label={`Move ${item.title} up`}
                                disabled={
                                  items.filter((entry) => entry.section === section)[0]?.id ===
                                  item.id
                                }
                                onClick={() => move(item.id, -1)}
                              >
                                ↑
                              </button>
                              <button
                                type="button"
                                aria-label={`Move ${item.title} down`}
                                disabled={
                                  items.filter((entry) => entry.section === section).at(-1)?.id ===
                                  item.id
                                }
                                onClick={() => move(item.id, 1)}
                              >
                                ↓
                              </button>
                              <input
                                aria-label={`${item.title || 'New item'} title`}
                                aria-describedby={message ? 'template-feedback' : undefined}
                                aria-invalid={invalid && !item.title.trim()}
                                placeholder="Title"
                                value={item.title}
                                onChange={(e) => edit(item.id, { title: e.target.value })}
                              />
                            </div>
                            <textarea
                              aria-label={`${item.title || 'New item'} wording`}
                              aria-describedby={message ? 'template-feedback' : undefined}
                              aria-invalid={invalid && !item.body.trim()}
                              placeholder="Write the term in plain language"
                              value={item.body}
                              onChange={(e) => edit(item.id, { body: e.target.value })}
                            />
                            <div className={styles['lt-item-options']}>
                              <label>
                                Include when…{' '}
                                <select
                                  aria-label={`${item.title || 'New item'} include when`}
                                  value={item.includeWhen}
                                  onChange={(e) =>
                                    edit(item.id, {
                                      includeWhen: e.target.value as TemplateItem['includeWhen'],
                                    })
                                  }
                                >
                                  {INCLUDE_WHEN.map((condition) => (
                                    <option key={condition} value={condition}>
                                      {CONDITION_LABELS[condition]}
                                    </option>
                                  ))}
                                </select>
                              </label>
                              <label>
                                <input
                                  type="checkbox"
                                  checked={item.required}
                                  onChange={(e) => edit(item.id, { required: e.target.checked })}
                                />{' '}
                                Required by template
                              </label>
                              <button
                                type="button"
                                aria-label={`Remove ${item.title || 'new item'}`}
                                onClick={() => {
                                  changed();
                                  setItems((all) => all.filter((i) => i.id !== item.id));
                                }}
                              >
                                Remove
                              </button>
                            </div>
                          </div>
                        )}
                      </article>
                    ))}
                </section>
              ))}
              <section className={styles['lt-section']} id="template-fees">
                <h3>Default fees</h3>
                <p className="muted">
                  These prefill Rent, deposit &amp; fees. Review amounts for each new lease.
                </p>
                <div className={styles['lt-fees']}>
                  {(
                    [
                      'lateFee',
                      'graceDays',
                      'moveInFee',
                      'petDeposit',
                      'returnedPaymentFee',
                      'keyFee',
                    ] as const
                  ).map((field) => (
                    <label key={field} className={styles['lt-field']}>
                      {
                        {
                          lateFee: 'Late fee',
                          graceDays: 'Grace days',
                          moveInFee: 'Move-in fee',
                          petDeposit: 'Pet deposit',
                          returnedPaymentFee: 'Returned payment fee',
                          keyFee: 'Key replacement fee',
                        }[field]
                      }
                      <input
                        type="number"
                        aria-describedby={message ? 'template-feedback' : undefined}
                        aria-invalid={
                          invalid &&
                          (field === 'graceDays'
                            ? !Number.isInteger(fees.graceDays) ||
                              fees.graceDays < 0 ||
                              fees.graceDays > 31
                            : !!fees[field] &&
                              (!Number.isFinite(Number(fees[field])) || Number(fees[field]) < 0))
                        }
                        min="0"
                        max={field === 'graceDays' ? 31 : undefined}
                        step={field === 'graceDays' ? 1 : 0.01}
                        value={fees[field] ?? ''}
                        onChange={(e) => {
                          changed();
                          setFees({
                            ...fees,
                            [field]:
                              field === 'graceDays' ? Number(e.target.value) : e.target.value,
                          });
                        }}
                      />
                    </label>
                  ))}
                </div>
              </section>
            </div>
            <div className={styles['lt-panel-footer']}>
              <button
                type="button"
                className="btn btn-secondary"
                disabled={busy}
                onClick={() => save(true)}
              >
                Duplicate
              </button>
              {initial && (
                <button
                  type="button"
                  className="btn btn-secondary"
                  disabled={busy}
                  onClick={remove}
                >
                  Delete when unused
                </button>
              )}
            </div>
          </div>
          <aside className={styles['lt-panel']} id="template-properties">
            <div className={styles['lt-panel-head']}>
              <h2>Apply to properties</h2>
            </div>
            <div className={styles['lt-panel-body']}>
              {!properties.length && (
                <p className={styles['lt-small']}>
                  No properties yet. Save this template now and set a default after adding a
                  property.
                </p>
              )}
              {properties.map((property) => (
                <div key={property.id} className={styles['lt-property']}>
                  <strong>{property.name}</strong>
                  {property.defaultLeaseTemplateId === initial?.id ? (
                    <span>Default for this property</span>
                  ) : (
                    <button
                      type="button"
                      className="btn btn-secondary"
                      aria-label={`Set as default for ${property.name}`}
                      onClick={() => setDefault(property.id)}
                    >
                      Set as default
                    </button>
                  )}
                </div>
              ))}
              <p className={styles['lt-feedback']}>
                The default is selected automatically for a unit in that property.
              </p>
            </div>
          </aside>
        </div>
      </fieldset>
    </div>
  );
}
