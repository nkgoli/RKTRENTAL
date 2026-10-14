'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { requireManagerRole } from '@/lib/auth/access';
import { db } from '@/lib/db/client';
import {
  IntegrationError,
  connectProvider,
  disconnectProvider,
  saveGroupSettings,
} from '@/lib/integrations/service';
import { SettingsError } from '@/lib/integrations/settings';
import type { IntegrationGroup } from '@/lib/integrations/catalog';

const store = db.providerConnection;

function field(form: FormData, name: string) {
  const value = form.get(name);
  return typeof value === 'string' ? value : '';
}

async function finish(run: () => Promise<string>): Promise<never> {
  let query: string;
  try {
    query = `notice=${encodeURIComponent(await run())}`;
  } catch (error) {
    if (!(error instanceof IntegrationError || error instanceof SettingsError)) throw error;
    query = `error=${encodeURIComponent(error.message)}`;
  }
  revalidatePath('/integrations');
  redirect(`/integrations?${query}`);
}

export async function connectAction(form: FormData) {
  const session = await requireManagerRole();
  await finish(async () => {
    await connectProvider(
      session.organizationId,
      field(form, 'kind'),
      field(form, 'provider'),
      store,
    );
    return `${field(form, 'name') || 'Provider'} connected`;
  });
}

export async function disconnectAction(form: FormData) {
  const session = await requireManagerRole();
  await finish(async () => {
    await disconnectProvider(
      session.organizationId,
      field(form, 'kind'),
      field(form, 'provider'),
      store,
    );
    return `${field(form, 'name') || 'Provider'} disconnected`;
  });
}

export async function saveSettingsAction(form: FormData) {
  const session = await requireManagerRole();
  const group = field(form, 'group');
  if (group !== 'payments' && group !== 'screening' && group !== 'comps')
    throw new IntegrationError('Unknown settings group');
  await finish(async () => {
    await saveGroupSettings(
      session.organizationId,
      group as IntegrationGroup,
      Object.fromEntries(form.entries()),
      store,
    );
    return 'Settings saved';
  });
}
