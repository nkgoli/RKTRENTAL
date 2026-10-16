import Link from 'next/link';
import { PageHeader } from '@/components/shell/PageHeader';
import { ScopedWorkspace } from '@/components/workspace/ScopedWorkspace';
import { scopeFilterFrom } from '@/lib/workspace/scope';
import { EmptyState } from '@/components/RouteStates';
import {
  Alert,
  Avatar,
  AvatarStack,
  Badge,
  KanbanBoard,
  KanbanColumn,
  KpiIcon,
  Ticket,
  TrendChip,
} from '@/components/ui';
import { FileUploader } from '@/components/upload';
import { requireManagerRole } from '@/lib/auth/access';
import {
  listMaintenanceOptions,
  listMaintenancePage,
  parseMaintenanceQuery,
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
  const coverDocumentId = request.photos[0]?.documentId;
  const priorityTone =
    request.priority === 'URGENT' ? 'danger' : request.priority === 'HIGH' ? 'warning' : 'info';
  return (
    <Ticket>
      <article id={`request-${request.id}`} className={styles.ticketContent}>
        {coverDocumentId ? (
          <div className={styles.photo}>
            {/* eslint-disable-next-line @next/next/no-img-element -- authenticated file route, loaded lazily */}
            <img
              src={`/api/files/${coverDocumentId}/preview`}
              alt={`${request.title} photo`}
              loading="lazy"
              decoding="async"
              width={240}
              height={78}
            />
            <span className="caption">Photo attached</span>
          </div>
        ) : (
          <div className={styles.photoEmpty}>No photo yet</div>
        )}
        <strong>{request.title}</strong>
        <span className="muted" style={{ fontSize: 12 }}>
          <Link href={`/properties/${request.property.id}`}>{request.property.name}</Link> ·{' '}
          <Link href={`/properties/${request.property.id}/units/${request.unit.id}`}>
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
        {request.description && <p className={styles.description}>{request.description}</p>}
        <details className={styles.controls}>
          <summary>Manage request</summary>
          <form action={assignMaintenanceAction} className={styles.compactForm}>
            <input type="hidden" name="requestId" value={request.id} />
            <label htmlFor={`vendor-${request.id}`}>Assign vendor</label>
            <div className={styles.inlineControls}>
              <select
                id={`vendor-${request.id}`}
                name="vendorId"
                defaultValue={request.vendorId ?? ''}
                required
              >
                <option value="" disabled>
                  Select vendor
                </option>
                {vendors.map((vendor) => (
                  <option key={vendor.id} value={vendor.id}>
                    {vendor.name}
                  </option>
                ))}
              </select>
              <button className="btn btn-secondary btn-sm" type="submit">
                Assign
              </button>
            </div>
          </form>
          <form action={setMaintenanceStatusAction} className={styles.compactForm}>
            <input type="hidden" name="requestId" value={request.id} />
            <label htmlFor={`status-${request.id}`}>Change status</label>
            <div className={styles.inlineControls}>
              <select id={`status-${request.id}`} name="status" defaultValue={request.status}>
                <option value="NEW">New</option>
                <option value="ASSIGNED">Assigned</option>
                <option value="IN_PROGRESS">In progress</option>
                <option value="DONE">Done</option>
                <option value="CANCELLED">Cancelled</option>
              </select>
              <button className="btn btn-secondary btn-sm" type="submit">
                Update
              </button>
            </div>
          </form>
          <form action={uploadMaintenancePhotoAction} className={styles.compactForm}>
            <input type="hidden" name="requestId" value={request.id} />
            <span id={`photo-${request.id}`}>Add photo</span>
            <FileUploader kind="photo" formField="photo" multiple={false} label="Add photo" />
            <button className="btn btn-secondary btn-sm" type="submit">
              Upload photo
            </button>
          </form>
          <form action={commentMaintenanceAction} className={styles.compactForm}>
            <input type="hidden" name="requestId" value={request.id} />
            <label htmlFor={`comment-${request.id}`}>Comment</label>
            <textarea id={`comment-${request.id}`} name="comment" maxLength={2000} required />
            <button className="btn btn-secondary btn-sm" type="submit">
              Add comment
            </button>
          </form>
          {request.events.map((event) => (
            <p key={event.id} className={styles.comment}>
              {event.body}
            </p>
          ))}
        </details>
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
  const { requests, summary, statusCounts } = list;
  const hidden = { propertyId: scope.propertyId, unitId: scope.unitId };
  return (
    <>
      <ScopedWorkspace
        organizationId={session.organizationId}
        filter={scope}
        activeTab="maintenance"
      />
      <PageHeader
        actions={[
          { label: 'Assign vendor', href: '#requests' },
          { label: '+ New request', href: '#new-request', primary: true },
        ]}
      />
      <div className="row between">
        <div>
          <p className="eyebrow">Work orders</p>
          <div className={styles.headingPeople}>
            <h2>Repairs at a glance</h2>
            <AvatarStack initials={vendors.slice(0, 4).map((vendor) => initials(vendor.name))} />
          </div>
          <p className="muted">From tenant photo to completed work, keep every request moving.</p>
        </div>
        <span className="chip active">All properties</span>
      </div>
      <div className={styles.stats}>
        <article className={styles.stat}>
          <div className={styles.statTop}>
            <span>Open requests</span>
            <KpiIcon>⚒</KpiIcon>
          </div>
          <strong>{summary.open}</strong>
          <TrendChip>Across {summary.openProperties} properties</TrendChip>
        </article>
        <article className={styles.stat}>
          <div className={styles.statTop}>
            <span>Urgent attention</span>
            <KpiIcon tone="coral">!</KpiIcon>
          </div>
          <strong>{summary.urgent}</strong>
          <TrendChip warm>
            {summary.firstUrgent
              ? `${summary.firstUrgent.title} · ${summary.firstUrgent.property.name}`
              : 'No urgent requests'}
          </TrendChip>
        </article>
        <article className={styles.stat}>
          <div className={styles.statTop}>
            <span>Completed this week</span>
            <KpiIcon tone="green">✓</KpiIcon>
          </div>
          <strong>{summary.completedThisWeek}</strong>
          <TrendChip>Requests resolved</TrendChip>
        </article>
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
      <MaintenanceListFooter
        action="/maintenance"
        hidden={hidden}
        query={query}
        page={list.page}
        pageCount={list.pageCount}
        total={list.total}
      />
      <section id="new-request" className={`card ${styles.newRequest}`}>
        <div className="card-header">
          <h3>New repair request</h3>
        </div>
        <form action={createMaintenanceAction} className="form">
          <div className="form-row">
            <label className="field">
              Unit
              <select name="unitId" required defaultValue="">
                <option value="" disabled>
                  Select unit
                </option>
                {properties.map((property) => (
                  <optgroup key={property.id} label={property.name}>
                    {property.units.map((unit) => (
                      <option key={unit.id} value={unit.id}>
                        {property.name} · {unit.number}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </label>
            <label className="field">
              Priority
              <select name="priority" defaultValue="NORMAL">
                <option value="LOW">Low</option>
                <option value="NORMAL">Normal</option>
                <option value="HIGH">High</option>
                <option value="URGENT">Urgent</option>
              </select>
            </label>
          </div>
          <label className="field">
            Request title
            <input name="title" required maxLength={160} placeholder="e.g. Kitchen sink leak" />
          </label>
          <label className="field">
            Description
            <textarea name="description" maxLength={3000} placeholder="What needs attention?" />
          </label>
          <div className="field">
            <span>Photo</span>
            <FileUploader kind="photo" formField="photo" multiple={false} label="Request photo" />
          </div>
          <button className="btn btn-primary" type="submit">
            Create request
          </button>
        </form>
      </section>
      <Alert>
        <strong>Keep tenants informed.</strong>
        <br />
        Status changes and vendor visits can be shared with residents from each work order.
      </Alert>
    </>
  );
}
