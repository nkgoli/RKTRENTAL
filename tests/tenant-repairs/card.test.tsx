// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, expect, it } from 'vitest';
import { RepairRequestCard } from '@/app/(tenant)/_components/RepairRequestCard';

beforeEach(() => {
  HTMLDialogElement.prototype.showModal = function () {
    this.setAttribute('open', '');
  };
  HTMLDialogElement.prototype.close = function () {
    this.removeAttribute('open');
  };
});
afterEach(cleanup);
const request = {
  id: 'repair',
  title: 'Kitchen sink leak',
  status: 'IN_PROGRESS' as const,
  createdAt: new Date('2026-10-21'),
  description: 'Category: Plumbing\n\nLeaking tap',
};

it('preserves the recorded category and exposes the same three labelled stages on every card', () => {
  render(<RepairRequestCard request={request} />);
  expect(screen.getByText('Plumbing · Submitted Oct 21')).toBeTruthy();
  const stages = screen.getByRole('list', { name: 'Repair stages' });
  expect(
    within(stages)
      .getAllByRole('listitem')
      .map((item) => item.textContent),
  ).toEqual(['Received', 'Scheduled', 'Done']);
  expect(within(stages).getByText('Scheduled').getAttribute('aria-current')).toBe('step');
});

it('opens an authorized image in a native lightbox and replaces unavailable images with a neutral tile', async () => {
  const photo = { id: 'photo', src: '/api/files/own-photo/preview', alt: 'Kitchen sink photo' };
  render(<RepairRequestCard request={{ ...request, photos: [photo] }} />);
  const thumbnail = screen.getByRole('button', { name: 'View Kitchen sink photo' });
  expect(within(thumbnail).getByRole('img').getAttribute('src')).toBe(photo.src);
  await userEvent.click(thumbnail);
  const lightbox = screen.getByRole('dialog', { name: photo.alt });
  expect(within(lightbox).getByRole('img').getAttribute('src')).toBe(photo.src);
  await userEvent.click(within(lightbox).getByRole('button', { name: 'Close' }));
  fireEvent.error(within(thumbnail).getByRole('img'));
  expect(
    screen.getByRole('img', { name: 'Kitchen sink photo — photo unavailable' }).textContent,
  ).toBe('Photo unavailable');
});
