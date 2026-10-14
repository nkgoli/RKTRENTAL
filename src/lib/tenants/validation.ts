export type TenantInput = {
  name: string;
  email: string | null;
  phone: string | null;
};

export type NewTenantInput = TenantInput & {
  unitId: string | null;
  moveInDate: Date | null;
};

export type FieldErrors = Partial<
  Record<'name' | 'email' | 'phone' | 'unitId' | 'moveInDate', string>
>;

export type ParseResult<T> = { ok: true; data: T } | { ok: false; errors: FieldErrors };

type FormLike = { get(name: string): FormDataEntryValue | null | undefined };

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_CHARS = /^[0-9+()\-.\s]+$/;
const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

function text(form: FormLike, key: string): string {
  const value = form.get(key);
  return typeof value === 'string' ? value.trim() : '';
}

export function parseIsoDate(value: string): Date | null {
  const match = ISO_DATE.exec(value);
  if (!match) return null;
  const [, y, m, d] = match.map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  if (date.getUTCFullYear() !== y || date.getUTCMonth() !== m - 1 || date.getUTCDate() !== d) {
    return null;
  }
  return date;
}

function parseContact(form: FormLike, errors: FieldErrors): TenantInput {
  const name = text(form, 'name');
  const email = text(form, 'email').toLowerCase();
  const phone = text(form, 'phone');

  if (!name) errors.name = 'Enter the tenant’s full name.';
  else if (name.length > 120) errors.name = 'Name must be 120 characters or fewer.';

  if (email && (email.length > 254 || !EMAIL.test(email))) errors.email = 'Enter a valid email.';

  if (phone) {
    const digits = phone.replace(/\D/g, '');
    if (!PHONE_CHARS.test(phone) || digits.length < 7 || digits.length > 15) {
      errors.phone = 'Enter a valid phone number.';
    }
  }

  return { name, email: email || null, phone: phone || null };
}

/** Validates the profile fields editable on an existing tenant. */
export function parseTenantInput(form: FormLike): ParseResult<TenantInput> {
  const errors: FieldErrors = {};
  const data = parseContact(form, errors);
  return Object.keys(errors).length ? { ok: false, errors } : { ok: true, data };
}

/** Validates the add-tenant form: profile plus an optional unit and move-in date. */
export function parseNewTenantInput(form: FormLike): ParseResult<NewTenantInput> {
  const errors: FieldErrors = {};
  const contact = parseContact(form, errors);
  const unitId = text(form, 'unitId');
  const moveIn = text(form, 'moveInDate');

  let moveInDate: Date | null = null;
  if (moveIn) {
    moveInDate = parseIsoDate(moveIn);
    if (!moveInDate) errors.moveInDate = 'Enter a valid move-in date.';
    else if (!unitId) errors.unitId = 'Choose a unit to set a move-in date.';
  }

  if (Object.keys(errors).length) return { ok: false, errors };
  return { ok: true, data: { ...contact, unitId: unitId || null, moveInDate } };
}
