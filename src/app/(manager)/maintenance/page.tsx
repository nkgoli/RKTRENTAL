import Link from 'next/link';
import { RequestDetails } from '@/components/maintenance/RequestDetails';
import { NewMaintenanceRequestDialog } from '@/components/workspace/panels/operations/NewMaintenanceRequestDialog';
import { withRequestPhotos } from '@/components/maintenance/request-photos';
import { PageHeader } from '@/components/shell/PageHeader';
import { ScopedWorkspace } from '@/components/workspace/ScopedWorkspace';
import { scopeFilterFrom } from '@/lib/workspace/scope';
import { EmptyState } from '@/components/RouteStates';
import { Avatar, Badge, KanbanBoard, KanbanColumn, Ticket } from '@/components/ui';
import { KpiCard } from '@/components/dashboard/KpiCard';

import { requireManagerRole } from '@/lib/auth/access';
import {
  listMaintenanceOptions,
  listMaintenancePage,
  parseMaintenanceQuery,
  maintenanceQueryString,
  type MaintenanceBoardRequest,
  type MaintenanceListParams,
} from '@/lib/maintenance';
import {
  MaintenanceFilters,
  MaintenanceListFooter,
} from '@/components/maintenance/MaintenanceListControls';
import {
  assignMaintenanceAction,
  commentMaintenanceAction,
  createMaintenanceAction,
  setMaintenanceStatusAction,
  uploadMaintenancePhotoAction,
} from './actions';
import styles from './maintenance.module.css';

const columns = [
  { status: 'NEW', title: 'New' },
  { status: 'ASSIGNED', title: 'Assigned' },
  { status: 'IN_PROGRESS', title: 'In progress' },
  { status: 'DONE', title: 'Done' },
  { status: 'CANCELLED', title: 'Cancelled' },
] as const;

function initials(name: string) {
  return name
    .split(/\s+/)
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

function RequestTicket({
  request,
  vendors,
}: {
  request: MaintenanceBoardRequest;
  vendors: { id: string; name: string }[];
}) {
  const priorityTone =
    request.priority === 'URGENT' ? 'danger' : request.priority === 'HIGH' ? 'warning' : 'info';
  return (
    <Ticket>
      <article id={`request-${request.id}`} className={styles.ticketContent}>
        <h3 className={styles.ticketTitle}>{request.title}</h3>
        <span className="muted" style={{ fontSize: 12 }}>
          <Link href={`/properties/${request.property.id}`}>{request.property.name}</Link> ·{' '}
          <Link
            href={`/properties/${request.property.id}?unit=${encodeURIComponent(request.unit.id)}`}
          >
            {request.unit.number}
          </Link>
        </span>
        <div className="row between">
          <Badge tone={priorityTone}>
            {request.priority[0] + request.priority.slice(1).toLowerCase()}
          </Badge>
          <span className="muted" style={{ fontSize: 12 }}>
            {request.createdAt.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
          </span>
        </div>
        <div className="row" style={{ fontSize: 12 }}>
          <Avatar initials={request.vendor ? initials(request.vendor.name) : '?'} size="sm" />
          <span>{request.vendor?.name ?? request.vendorName ?? 'Unassigned'}</span>
        </div>
        {request.photos.length > 0 && (
          <span className="muted" style={{ fontSize: 12 }}>
            {request.photos.length} {request.photos.length === 1 ? 'photo' : 'photos'} attached
          </span>
        )}
        <RequestDetails
          request={request}
          vendors={vendors}
          actions={{
            assign: assignMaintenanceAction,
            status: setMaintenanceStatusAction,
            comment: commentMaintenanceAction,
            photo: uploadMaintenancePhotoAction,
          }}
        />
      </article>
    </Ticket>
  );
}
export default async function MaintenancePage({
  searchParams,
}: {
  searchParams: Promise<{ propertyId?: string; unitId?: string } & MaintenanceListParams>;
}) {
  const [session, params] = await Promise.all([requireManagerRole(), searchParams]);
  const scope = scopeFilterFrom(params);
  const query = parseMaintenanceQuery(params);
  const [list, { properties, vendors }] = await Promise.all([
    listMaintenancePage(session.organizationId, scope, query),
    listMaintenanceOptions(session.organizationId),
  ]);
  const { summary, statusCounts } = list;
  const requests = await withRequestPhotos(session.organizationId, list.requests);
  const hidden = { propertyId: scope.propertyId, unitId: scope.unitId };
  return (
    <>
      <ScopedWorkspace
        organizationId={session.organizationId}
        filter={scope}
        activeTab="maintenance"
      />
      <PageHeader
        title="Maintenance"
        actions={[{ label: 'New request', href: '#new-request', primary: true }]}
      />
      <div className="kpis">
        <KpiCard
          label="Open requests"
          value={summary.open}
          note={`Across ${summary.openProperties} ${summary.openProperties === 1 ? 'property' : 'properties'}`}
        />
        <KpiCard
          label="Urgent attention"
          value={summary.urgent}
          note={
            summary.firstUrgent
              ? `${summary.firstUrgent.title} · ${summary.firstUrgent.property.name}`
              : 'No urgent requests'
          }
        />
        <KpiCard
          label="Completed this week"
          value={summary.completedThisWeek}
          note="Requests resolved"
        />
      </div>
      <MaintenanceFilters action="/maintenance" hidden={hidden} query={query} />
      {list.isEmpty && (
        <EmptyState
          title="No repair requests yet"
          description="Create a repair request to track work from start to finish."
          action="Create a request"
          href="#new-request"
        />
      )}
      {!list.isEmpty && list.total === 0 && (
        <EmptyState
          title="No repair requests match this view"
          description="Clear the filters or show all history to find older requests."
          action="Show all requests"
          href={`/maintenance${maintenanceQueryString({ allHistory: true, page: 1 }, hidden)}`}
        />
      )}
      {list.total > 0 && (
        <div id="requests" className={styles.board}>
          <KanbanBoard>
            {columns
              .filter((column) => column.status !== 'CANCELLED' || statusCounts.CANCELLED)
              .map((column) => {
                const items = requests.filter((request) => request.status === column.status);
                return (
                  <KanbanColumn
                    key={column.status}
                    title={column.title}
                    count={statusCounts[column.status] ?? 0}
                  >
                    {items.map((request) => (
                      <RequestTicket key={request.id} request={request} vendors={vendors} />
                    ))}
                    {items.length === 0 && (
                      <p className="muted" style={{ fontSize: 13 }}>
                        No requests
                      </p>
                    )}
                  </KanbanColumn>
                );
              })}
          </KanbanBoard>
        </div>
      )}
      <MaintenanceListFooter
        action="/maintenance"
        hidden={hidden}
        query={query}
        page={list.page}
        pageCount={list.pageCount}
        total={list.total}
      />
      <section id="new-request" className={`card ${styles.newRequest}`}>
        <div>
          <h2>New repair request</h2>
          <p className="muted">
            Choose a unit, set a priority and add photos to help the vendor prepare.
          </p>
        </div>
        <NewMaintenanceRequestDialog
          action={createMaintenanceAction}
          propertyName="Portfolio"
          units={properties
            .filter((property) => !scope.propertyId || property.id === scope.propertyId)
            .flatMap((property) =>
              property.units
                .filter((unit) => !scope.unitId || unit.id === scope.unitId)
                .map((unit) => ({ id: unit.id, number: `${property.name} · ${unit.number}` })),
            )}
          selectedUnitId={scope.unitId}
        />
      </section>
    </>
  );
}
