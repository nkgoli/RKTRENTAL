import Link from 'next/link';
import { PageHeader } from '@/components/shell/PageHeader';
import { Alert, Avatar, Badge, KanbanBoard, KanbanColumn, Stat, Ticket } from '@/components/ui';
import { requireManagerRole } from '@/lib/auth/access';
import {
  listMaintenanceBoard,
  listMaintenanceOptions,
  type MaintenanceBoardRequest,
} from '@/lib/maintenance';
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
  const firstPhoto = request.photos.find((photo) => photo.document);
  const priorityTone =
    request.priority === 'URGENT' ? 'danger' : request.priority === 'HIGH' ? 'warning' : 'info';
  return (
    <Ticket>
      <article id={`request-${request.id}`} className={styles.ticketContent}>
        {firstPhoto?.document ? (
          <div
            className={styles.photo}
            role="img"
            aria-label={`${request.title} photo`}
            style={{ backgroundImage: `url(/api/files/${firstPhoto.document.id}/preview)` }}
          >
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
            <label htmlFor={`photo-${request.id}`}>Add photo</label>
            <input
              id={`photo-${request.id}`}
              name="photo"
              type="file"
              accept="image/png,image/jpeg,image/heic,image/heif"
              required
            />
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
          {request.events
            .filter((event) => event.kind === 'COMMENT')
            .map((event) => (
              <p key={event.id} className={styles.comment}>
                {event.body}
              </p>
            ))}
        </details>
      </article>
    </Ticket>
  );
}

export default async function MaintenancePage() {
  const session = await requireManagerRole();
  const [requests, { properties, vendors }] = await Promise.all([
    listMaintenanceBoard(session.organizationId),
    listMaintenanceOptions(session.organizationId),
  ]);
  const open = requests.filter((request) => !['DONE', 'CANCELLED'].includes(request.status));
  const urgent = open.filter((request) => request.priority === 'URGENT');
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const completed = requests.filter(
    (request) => request.status === 'DONE' && request.completedAt && request.completedAt >= weekAgo,
  );
  return (
    <>
      <PageHeader
        actions={[
          { label: 'Assign vendor', href: '#requests' },
          { label: '+ New request', href: '#new-request', primary: true },
        ]}
      />
      <div className="row between">
        <div>
          <p className="eyebrow">Work orders</p>
          <h2>Repairs at a glance</h2>
          <p className="muted">From tenant photo to completed work, keep every request moving.</p>
        </div>
        <span className="chip active">All properties</span>
      </div>
      <div className="grid-3">
        <Stat
          label="Open requests"
          value={open.length}
          delta={`Across ${new Set(open.map((request) => request.propertyId)).size} properties`}
        />
        <Stat
          label="Urgent attention"
          value={urgent.length}
          delta={
            urgent[0] ? `${urgent[0].title} · ${urgent[0].property.name}` : 'No urgent requests'
          }
          tone={urgent.length ? 'down' : 'up'}
        />
        <Stat
          label="Completed this week"
          value={completed.length}
          delta="Requests resolved"
          tone="up"
        />
      </div>
      <div id="requests" className={styles.board}>
        <KanbanBoard>
          {columns.map((column) => {
            const items = requests.filter((request) => request.status === column.status);
            return (
              <KanbanColumn key={column.status} title={column.title} count={items.length}>
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
          <label className="field">
            Photo
            <input type="file" name="photo" accept="image/png,image/jpeg,image/heic,image/heif" />
            <span className="hint">PNG, JPEG or HEIC, up to 25 MB</span>
          </label>
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
