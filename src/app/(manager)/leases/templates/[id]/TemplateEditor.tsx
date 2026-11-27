'use client';

import { useRouter } from 'next/navigation';
import { PageHeader } from '@/components/shell/PageHeader';
import { Icon } from '@/components/shell/Icons';
import { Switch, cx } from '@/components/ui';
import { useEffect, useId, useRef, useState } from 'react';
import {
  deleteLeaseTemplateAction,
  saveLeaseTemplateAction,
  setPropertyLeaseTemplateAction,
} from '../actions';
import {
  CONDITION_LABELS,
  INCLUDE_WHEN,
  STANDARD_FEES,
  contextFromDraft,
  type TemplateDefinition,
  type TemplateItem,
  type TemplateSection,
} from '@/lib/lease-create/templates';
import styles from './template-editor.module.css';
import { TemplateIcon } from '../TemplateIcons';

type PropertyChoice = { id: string; name: string; defaultLeaseTemplateId: string | null };
const sections: TemplateSection[] = ['CLAUSE', 'RULE', 'DISCLOSURE'];
const labels = { CLAUSE: 'Clauses', RULE: 'Rules', DISCLOSURE: 'Disclosures' };
const FEE_FIELDS = [
  { key: 'lateFee', label: 'Late fee' },
  { key: 'graceDays', label: 'Grace days' },
  { key: 'moveInFee', label: 'Move-in fee' },
  { key: 'petDeposit', label: 'Pet deposit' },
  { key: 'returnedPaymentFee', label: 'Returned payment fee' },
  { key: 'keyFee', label: 'Key replacement fee' },
] as const;
/** Blanks each lease fills from its own terms, listed under the wording for reference. */
const AUTO_FIELDS = Object.keys(
  contextFromDraft({
    leaseType: 'fixed',
    options: [],
    petDepositEnabled: false,
    assignedParking: false,
    propertyType: 'MULTI_UNIT',
    tenantUtilities: [],
    yearBuilt: null,
  }).values ?? {},
);

/** Wording with each {{field}} blank shown as a small chip naming the field. */
function Wording({ body }: { body: string }) {
  return (
    <>
      {body.split(/(\{\{[a-z_]+\}\})/g).map((part, index) =>
        /^\{\{[a-z_]+\}\}$/.test(part) ? (
          <span key={index} className={styles.blank}>
            {part.slice(2, -2).replaceAll('_', ' ')}
          </span>
        ) : (
          part
        ),
      )}
    </>
  );
}

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
  const [section, setSection] = useState<TemplateSection | 'fees' | 'properties'>('CLAUSE');
  const [search, setSearch] = useState('');
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
    setSearch('');
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
      setSection(incomplete.section);
      setSearch('');
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
      setSection('fees');
      setMessage('Enter a valid amount of zero or more for each fee.');
      return;
    }
    if (!Number.isInteger(fees.graceDays) || fees.graceDays < 0 || fees.graceDays > 31) {
      setSection('fees');
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
  const feeId = useId();
  const listed = sections.includes(section as TemplateSection)
    ? (section as TemplateSection)
    : null;
  const sectionItems = listed ? items.filter((item) => item.section === listed) : [];
  const query = search.trim().toLowerCase();
  const shown = sectionItems
    .map((item, index) => ({ item, number: index + 1 }))
    .filter(({ item }) => `${item.title} ${item.body}`.toLowerCase().includes(query));
  const saveState = busy
    ? { tone: 'saving', text: 'Saving…' }
    : dirty
      ? { tone: 'dirty', text: 'Unsaved changes' }
      : initial
        ? { tone: 'clean', text: `Version ${version} · editing creates version ${version + 1}` }
        : { tone: 'new', text: 'Not saved yet' };
  const addButton = (key: TemplateSection) => (
    <button
      type="button"
      className="btn btn-secondary btn-sm"
      aria-label={`+ Add ${key.toLowerCase()}`}
      onClick={() => add(key)}
    >
      <TemplateIcon name="add" /> Add {key.toLowerCase()}
    </button>
  );
  return (
    <div className={styles.editor}>
      <PageHeader
        title={initial ? 'Edit template' : 'New template'}
        back={{ href: '/leases/templates', label: 'Lease templates' }}
        // The Leases section's "Create lease" shortcut does not belong on the template editor.
        actions={[]}
      />
      <div className={styles.savebar}>
        <div className={styles.savebarRow}>
          <input
            className={styles.nameInput}
            aria-label="Template name"
            aria-describedby={message ? 'template-feedback' : undefined}
            aria-invalid={invalid && !name.trim()}
            placeholder="Template name"
            disabled={busy}
            value={name}
            onChange={(e) => {
              changed();
              setName(e.target.value);
            }}
          />
          <div className={styles.saveMeta}>
            <span className={styles.saveState} data-tone={saveState.tone} role="status">
              {saveState.text}
            </span>
            <button
              type="button"
              className="btn btn-primary"
              disabled={busy || (!dirty && Boolean(initial))}
              onClick={() => save()}
            >
              {busy ? 'Saving…' : 'Save template'}
            </button>
          </div>
        </div>
        {message && (
          <p
            id="template-feedback"
            ref={messageRef}
            tabIndex={-1}
            role="status"
            className={cx(
              styles.feedback,
              /^(Saved version|Property default updated)/.test(message)
                ? styles.success
                : styles.error,
            )}
          >
            {message}
          </p>
        )}
      </div>
      <fieldset className={styles.editFields} disabled={busy}>
        <div className={styles.layout}>
          <nav className={styles.sectionNav} aria-label="Template sections">
            {sections.map((key) => (
              <button
                type="button"
                key={key}
                aria-pressed={section === key}
                onClick={() => setSection(key)}
              >
                {labels[key]}{' '}
                <span className={styles.navCount}>
                  {items.filter((item) => item.section === key).length}
                </span>
              </button>
            ))}
            <span className={styles.navDivider} aria-hidden="true" />
            <button
              type="button"
              aria-pressed={section === 'fees'}
              onClick={() => setSection('fees')}
            >
              Default fees
            </button>
            <button
              type="button"
              aria-pressed={section === 'properties'}
              onClick={() => setSection('properties')}
            >
              Property defaults
            </button>
          </nav>
          <div className={styles.main}>
            {listed && (
              <section
                className={styles.panel}
                id={`template-${listed.toLowerCase()}`}
                aria-labelledby="template-section-title"
              >
                <div className={styles.panelHead}>
                  <h2 id="template-section-title">{labels[listed]}</h2>
                  {sectionItems.length > 0 && addButton(listed)}
                </div>
                {sectionItems.length === 0 ? (
                  <div className={styles.empty}>
                    <span className={styles.emptyIcon} aria-hidden="true">
                      <Icon name="leases" />
                    </span>
                    <p>No {labels[listed].toLowerCase()} yet</p>
                    {addButton(listed)}
                  </div>
                ) : (
                  <>
                    <div className={styles.toolbar}>
                      <label className={styles.search}>
                        <Icon name="search" />
                        <input
                          type="search"
                          aria-label="Search titles and wording"
                          value={search}
                          onChange={(event) => setSearch(event.target.value)}
                          placeholder="Search titles and wording"
                        />
                      </label>
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm"
                        onClick={() => {
                          setAllExpanded(!allExpanded);
                          setExpanded({});
                        }}
                      >
                        {allExpanded ? 'Collapse all' : 'Expand all'}
                      </button>
                    </div>
                    {!shown.length && (
                      <p className={styles.noMatch}>No {labels[listed].toLowerCase()} match.</p>
                    )}
                    <ol className={styles.items}>
                      {shown.map(({ item, number }) => {
                        const open = expanded[item.id] ?? allExpanded;
                        const named = item.title || 'New item';
                        return (
                          <li key={item.id}>
                            <article className={styles.item} data-open={open || undefined}>
                              <button
                                type="button"
                                className={styles.itemToggle}
                                aria-controls={`template-item-${item.id}`}
                                aria-expanded={open}
                                aria-label={`${number}. ${named}`}
                                onClick={() =>
                                  setExpanded((value) => ({
                                    ...value,
                                    [item.id]: !(value[item.id] ?? allExpanded),
                                  }))
                                }
                              >
                                <span className={styles.itemNumber}>{number}</span>
                                <span className={styles.itemMain}>
                                  <strong>{named}</strong>
                                  {!open && item.body && (
                                    <span className={styles.itemPreview}>
                                      <Wording body={item.body} />
                                    </span>
                                  )}
                                </span>
                                <span className={styles.itemTags}>
                                  {item.includeWhen !== 'ALWAYS' && (
                                    <span className={styles.tag}>
                                      {CONDITION_LABELS[item.includeWhen]}
                                    </span>
                                  )}
                                  {item.required && <span className={styles.tag}>Required</span>}
                                </span>
                                <span className={styles.chevron} aria-hidden="true" />
                              </button>
                              {open && (
                                <div className={styles.itemEdit} id={`template-item-${item.id}`}>
                                  <label className={styles.field}>
                                    <span>Title</span>
                                    <input
                                      aria-label={`${named} title`}
                                      aria-describedby={message ? 'template-feedback' : undefined}
                                      aria-invalid={invalid && !item.title.trim()}
                                      placeholder="Title"
                                      value={item.title}
                                      onChange={(e) => edit(item.id, { title: e.target.value })}
                                    />
                                  </label>
                                  <label className={styles.field}>
                                    <span>Wording</span>
                                    <textarea
                                      aria-label={`${named} wording`}
                                      aria-describedby={message ? 'template-feedback' : undefined}
                                      aria-invalid={invalid && !item.body.trim()}
                                      placeholder="Write the term in plain language"
                                      value={item.body}
                                      onChange={(e) => edit(item.id, { body: e.target.value })}
                                    />
                                  </label>
                                  <details className={styles.fields}>
                                    <summary>Available fields</summary>
                                    <p>
                                      {AUTO_FIELDS.map((field) => (
                                        <code key={field}>{`{{${field}}}`}</code>
                                      ))}
                                    </p>
                                  </details>
                                  <div className={styles.itemOptions}>
                                    <label className={styles.field}>
                                      <span>Include when</span>
                                      <select
                                        aria-label={`${named} include when`}
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
                                    <label className={styles.switchRow}>
                                      <Switch
                                        on={item.required}
                                        label="Required by template"
                                        onChange={(required) => edit(item.id, { required })}
                                      />
                                      Required by template
                                    </label>
                                  </div>
                                  <div className={styles.itemFoot}>
                                    <span className={styles.reorder}>
                                      <button
                                        type="button"
                                        className="btn btn-secondary btn-sm"
                                        aria-label={`Move ${item.title} up`}
                                        disabled={sectionItems[0]?.id === item.id}
                                        onClick={() => move(item.id, -1)}
                                      >
                                        ↑
                                      </button>
                                      <button
                                        type="button"
                                        className="btn btn-secondary btn-sm"
                                        aria-label={`Move ${item.title} down`}
                                        disabled={sectionItems.at(-1)?.id === item.id}
                                        onClick={() => move(item.id, 1)}
                                      >
                                        ↓
                                      </button>
                                    </span>
                                    <button
                                      type="button"
                                      className={cx('btn btn-ghost btn-sm', styles.danger)}
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
                          </li>
                        );
                      })}
                    </ol>
                  </>
                )}
              </section>
            )}
            <section
              className={styles.panel}
              id="template-fees"
              hidden={section !== 'fees'}
              aria-labelledby="template-fees-title"
            >
              <div className={styles.panelHead}>
                <h2 id="template-fees-title">Default fees</h2>
              </div>
              <p className={styles.panelNote}>Prefilled in each new lease.</p>
              <div className={styles.feeGrid}>
                {FEE_FIELDS.map(({ key, label }) => (
                  <div key={key} className={styles.field}>
                    <label htmlFor={`${feeId}-${key}`}>{label}</label>
                    <span className={styles.adorned} data-adorn={key === 'graceDays' ? 'suffix' : 'prefix'}>
                      {key !== 'graceDays' && (
                        <span className={styles.prefix} aria-hidden="true">
                          $
                        </span>
                      )}
                      <input
                        id={`${feeId}-${key}`}
                        type="number"
                        aria-describedby={message ? 'template-feedback' : undefined}
                        aria-invalid={
                          invalid &&
                          (key === 'graceDays'
                            ? !Number.isInteger(fees.graceDays) ||
                              fees.graceDays < 0 ||
                              fees.graceDays > 31
                            : !!fees[key] &&
                              (!Number.isFinite(Number(fees[key])) || Number(fees[key]) < 0))
                        }
                        min="0"
                        max={key === 'graceDays' ? 31 : undefined}
                        step={key === 'graceDays' ? 1 : 0.01}
                        value={fees[key] ?? ''}
                        onChange={(e) => {
                          changed();
                          setFees({
                            ...fees,
                            [key]: key === 'graceDays' ? Number(e.target.value) : e.target.value,
                          });
                        }}
                      />
                      {key === 'graceDays' && (
                        <span className={styles.suffix} aria-hidden="true">
                          days
                        </span>
                      )}
                    </span>
                  </div>
                ))}
              </div>
            </section>
            <section
              className={styles.panel}
              id="template-properties"
              hidden={section !== 'properties'}
              aria-labelledby="template-properties-title"
            >
              <div className={styles.panelHead}>
                <h2 id="template-properties-title">Property defaults</h2>
              </div>
              <p className={styles.panelNote}>New leases on a property start from its default.</p>
              {!properties.length ? (
                <p className={styles.noMatch}>No properties yet.</p>
              ) : (
                <ul className={styles.properties}>
                  {properties.map((property) => (
                    <li key={property.id}>
                      <span className={styles.propertyIcon} aria-hidden="true">
                        <Icon name="property-house" />
                      </span>
                      <strong>{property.name}</strong>
                      {property.defaultLeaseTemplateId === initial?.id ? (
                        <span className={styles.isDefault}>
                          <Icon name="check" />
                          Default for this property
                        </span>
                      ) : (
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          aria-label={`Set as default for ${property.name}`}
                          onClick={() => setDefault(property.id)}
                        >
                          Set as default
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </section>
            {initial && (
              <div className={styles.quietActions}>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  disabled={busy}
                  onClick={() => save(true)}
                >
                  Duplicate
                </button>
                <button
                  type="button"
                  className={cx('btn btn-ghost btn-sm', styles.danger)}
                  disabled={busy}
                  onClick={remove}
                >
                  Delete when unused
                </button>
              </div>
            )}
          </div>
        </div>
      </fieldset>
    </div>
  );
}
