'use client';

import { useCallback, useId, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { Icon } from '../shell/Icons';
import { cx } from './cx';

/** Gap between the trigger and the panel, and the minimum distance kept from viewport edges. */
const GAP = 4;
const EDGE = 8;
const ACTIONS = 'a[href], button:not(:disabled), input:not([type="hidden"]):not(:disabled)';

/** Closes the menu that is currently open, so opening another one closes it first. */
let closeOpenMenu: (() => void) | null = null;

/** Focusable actions in the panel, excluding controls inside a ConfirmButton's dialog. */
function actions(panel: HTMLElement) {
  return Array.from(panel.querySelectorAll<HTMLElement>(ACTIONS)).filter(
    (action) => !action.closest('dialog'),
  );
}

/** True when a ConfirmButton inside the menu has its dialog open: the menu must stay mounted. */
function hasOpenDialog(root: HTMLElement | null) {
  return !!root?.querySelector('dialog[open]');
}

/** True when the trigger is still visible inside every scrolling ancestor and the viewport. */
function triggerVisible(trigger: HTMLElement) {
  const r = trigger.getBoundingClientRect();
  const x = r.left + r.width / 2;
  const y = r.top + r.height / 2;
  const doc = document.documentElement;
  if (x < 0 || y < 0 || x > doc.clientWidth || y > doc.clientHeight) return false;
  for (let el = trigger.parentElement; el && el !== document.body; el = el.parentElement) {
    const { overflowX, overflowY } = getComputedStyle(el);
    if (overflowX === 'visible' && overflowY === 'visible') continue;
    const box = el.getBoundingClientRect();
    if (x < box.left || x > box.right || y < box.top || y > box.bottom) return false;
  }
  return true;
}

/**
 * Anchor the panel to its trigger in viewport coordinates. The panel is `position: fixed`, so it
 * escapes the row's stacking context and the table's scroll clipping; it opens below the trigger
 * (above when there is more room there), is aligned to the trigger's end or start edge and is
 * clamped inside the viewport, scrolling internally when taller than the room available.
 */
function place(panel: HTMLElement, trigger: HTMLElement, align: 'start' | 'end') {
  const doc = document.documentElement;
  const vw = doc.clientWidth;
  const vh = doc.clientHeight;
  const t = trigger.getBoundingClientRect();
  panel.style.maxHeight = '';
  panel.style.maxWidth = `${vw - EDGE * 2}px`;
  const { width, height } = panel.getBoundingClientRect();
  const below = vh - t.bottom - GAP - EDGE;
  const above = t.top - GAP - EDGE;
  const up = height > below && above > below;
  const room = Math.max(up ? above : below, 0);
  let left = align === 'end' ? t.right - width : t.left;
  left = Math.min(Math.max(left, EDGE), vw - EDGE - width);
  let top = up ? t.top - GAP - Math.min(height, room) : t.bottom + GAP;
  panel.style.maxHeight = `${room}px`;
  panel.style.left = `${left}px`;
  panel.style.top = `${top}px`;
  // A transformed ancestor makes it the containing block for fixed elements: correct by the drift.
  const actual = panel.getBoundingClientRect();
  left += left - actual.left;
  top += top - actual.top;
  panel.style.left = `${left}px`;
  panel.style.top = `${top}px`;
  panel.dataset.side = up ? 'top' : 'bottom';
}

/**
 * Overflow ("⋯") disclosure for secondary row actions: links, submit buttons or ConfirmButtons,
 * which keep their native roles. The panel floats above neighbouring rows and stays anchored to
 * the trigger while the page or table scrolls. It closes on Escape (focus returns to the trigger),
 * an outside click, Tab away, opening another row's menu or when its row scrolls out of view.
 * Arrow keys open it from the trigger and move between actions, with Home and End. A
 * ConfirmButton's dialog keeps the menu open behind it so Cancel returns focus to the action;
 * confirming closes the menu once the dialog is gone and returns focus to the trigger.
 */
export function RowMenu({
  label = 'More actions',
  children,
  align = 'end',
  className,
}: {
  label?: string;
  children: ReactNode;
  align?: 'start' | 'end';
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  /** Action focused when the menu opens from the keyboard; null keeps focus on the trigger. */
  const focusOnOpen = useRef<'first' | 'last' | null>(null);
  /** Set when a dialog inside the menu was confirmed: close once that dialog is gone. */
  const confirmed = useRef(false);
  const panelId = useId();

  const show = (focus: 'first' | 'last' | null) => {
    focusOnOpen.current = focus;
    setOpen(true);
  };

  const settleConfirmed = useCallback(() => {
    if (!confirmed.current || hasOpenDialog(root.current)) return;
    confirmed.current = false;
    setOpen(false);
    const active = document.activeElement;
    if (!active || active === document.body || panel.current?.contains(active))
      trigger.current?.focus({ preventScroll: true });
  }, []);

  // A confirmed action re-renders the row (often removing the ConfirmButton) or closes the dialog;
  // a dialog's `close` event does not bubble, so listen in the capture phase as well.
  useLayoutEffect(settleConfirmed);
  useLayoutEffect(() => {
    const el = root.current;
    el?.addEventListener('close', settleConfirmed, true);
    return () => el?.removeEventListener('close', settleConfirmed, true);
  }, [settleConfirmed]);

  useLayoutEffect(() => {
    const el = panel.current;
    const button = trigger.current;
    if (!open || !el || !button) return;
    const dismiss = () => setOpen(false);
    closeOpenMenu?.();
    closeOpenMenu = dismiss;
    place(el, button, align);
    if (focusOnOpen.current) {
      const list = actions(el);
      (focusOnOpen.current === 'last' ? list[list.length - 1] : list[0])?.focus({
        preventScroll: true,
      });
    }

    let frame = 0;
    const follow = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        if (hasOpenDialog(root.current)) return;
        if (!triggerVisible(button)) setOpen(false);
        else place(el, button, align);
      });
    };
    const outside = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    window.addEventListener('scroll', follow, true);
    window.addEventListener('resize', follow);
    document.addEventListener('pointerdown', outside, true);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('scroll', follow, true);
      window.removeEventListener('resize', follow);
      document.removeEventListener('pointerdown', outside, true);
      if (closeOpenMenu === dismiss) closeOpenMenu = null;
    };
  }, [open, align]);

  return (
    <div
      ref={root}
      className={cx(
        'row-menu',
        align === 'start' && 'row-menu-start',
        open && 'row-menu-open',
        className,
      )}
      onKeyDown={(event) => {
        if (!open || (event.target as HTMLElement).closest('dialog')) return;
        if (event.key === 'Escape') {
          event.preventDefault();
          event.stopPropagation();
          setOpen(false);
          trigger.current?.focus();
          return;
        }
        if (!panel.current) return;
        const list = actions(panel.current);
        const at = list.indexOf(document.activeElement as HTMLElement);
        const last = list.length - 1;
        const next = {
          Home: 0,
          End: last,
          ArrowDown: at + 1 > last ? 0 : at + 1,
          ArrowUp: at <= 0 ? last : at - 1,
        }[event.key];
        if (next === undefined) return;
        event.preventDefault();
        list[next]?.focus();
      }}
      onBlur={(event) => {
        // Tab (or any focus move) out of the menu closes it, unless a dialog inside took focus.
        const next = event.relatedTarget as Node | null;
        if (open && next && !root.current?.contains(next) && !hasOpenDialog(root.current))
          setOpen(false);
      }}
    >
      <button
        ref={trigger}
        type="button"
        className="icon-btn"
        aria-label={label}
        title={label}
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => (open ? setOpen(false) : show(null))}
        onKeyDown={(event) => {
          if (open || (event.key !== 'ArrowDown' && event.key !== 'ArrowUp')) return;
          event.preventDefault();
          event.stopPropagation();
          show(event.key === 'ArrowUp' ? 'last' : 'first');
        }}
      >
        <Icon name="more" />
      </button>
      <div
        ref={panel}
        id={panelId}
        className="row-menu-panel"
        hidden={!open}
        onClick={(event) => {
          // Links and submit buttons act immediately; a ConfirmButton keeps the menu open behind
          // its dialog until the dialog closes.
          const target = event.target as HTMLElement;
          if (target.closest('dialog')) return;
          if (target.closest('a[href], button[type="submit"]')) setOpen(false);
        }}
        onSubmit={(event) => {
          // Confirmed in a dialog: close the menu once the action finishes and the dialog goes.
          if ((event.target as HTMLElement).closest('dialog')) confirmed.current = true;
        }}
      >
        {children}
      </div>
    </div>
  );
}
