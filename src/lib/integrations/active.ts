import type { ProviderKind } from '@prisma/client';
import { db } from '@/lib/db/client';
import type { IntegrationGroup } from './catalog';
import { GROUP_KIND, readSettings, SETTINGS_PROVIDER, type SettingsByGroup } from './settings';

type Connection = {
  kind: ProviderKind;
  provider: string;
  status: string;
  settings: unknown;
};

/** One lookup for the integration selected by the UI and its group settings row. */
export async function activeIntegration<G extends IntegrationGroup>(
  organizationId: string,
  group: G,
  preferredProviders: string[] = [],
  findMany: (args: {
    where: { organizationId: string; kind: ProviderKind };
  }) => Promise<Connection[]> = (args) => db.providerConnection.findMany(args),
): Promise<{ connection: Connection | null; settings: SettingsByGroup[G] }> {
  const rows = await findMany({ where: { organizationId, kind: GROUP_KIND[group] } });
  const settings = readSettings(
    group,
    rows.find((row) => row.provider === SETTINGS_PROVIDER)?.settings,
  );
  const connected = rows.filter(
    (row) => row.provider !== SETTINGS_PROVIDER && row.status === 'CONNECTED',
  );
  const connection =
    preferredProviders
      .map((provider) => connected.find((row) => row.provider === provider))
      .find(Boolean) ??
    connected[0] ??
    null;
  return { connection, settings };
}
