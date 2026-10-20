import Link from 'next/link';
import { maintenanceFormHref } from '@/lib/maintenance/navigation';
import type { MaintenanceBoardRequest } from '@/lib/maintenance';
import { FileUploader } from '@/components/upload';
import { RequestActionForm, type RequestAction } from './RequestActionForm';
import { RequestPhoto } from './RequestPhoto';
import styles from './maintenance.module.css';

export type RequestActions = {
  assign: RequestAction;
  status: RequestAction;
  comment: RequestAction;
  photo: RequestAction;
};

export function RequestDetails({
  request,
  vendors,
  actions,
  returnTo = '/maintenance',
  expanded = false,
  hideEdit = false,
  documentActions = false,
}: {
  request: MaintenanceBoardRequest;
  vendors: { id: string; name: string }[];
  actions: RequestActions;
  returnTo?: string;
  expanded?: boolean;
  hideEdit?: boolean;
  documentActions?: boolean;
}) {
  return (
    <details className={styles.details} open={expanded}>
      <summary>
        Manage request<span className={styles.screenReaderOnly}>: {request.title}</span>
      </summary>
      <div className={styles.detailBody}>
        {!hideEdit && (
          <Link
            className="btn btn-secondary"
            href={maintenanceFormHref(request.propertyId, request.unit.id, returnTo, request.id)}
          >
            Edit request
          </Link>
        )}
        <p className={styles.description}>{request.description || 'No description provided.'}</p>
        <div className={styles.controlGrid}>
          <RequestActionForm
            action={actions.assign}
            transport={
              documentActions
                ? { operation: 'assign', propertyId: request.propertyId, unitId: request.unit.id }
                : undefined
            }
            label={`Assign vendor for ${request.title}`}
          >
            <input type="hidden" name="requestId" value={request.id} />
            <label className="field">
              Assign vendor
              <select
                name="vendorId"
                defaultValue={request.vendorId ?? ''}
                required
                disabled={!vendors.length}
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
            </label>
            {!vendors.length && (
              <p className="muted">No vendors are available for this portfolio.</p>
            )}
            <button className="btn btn-secondary btn-sm" type="submit" disabled={!vendors.length}>
              Assign
            </button>
          </RequestActionForm>
          <RequestActionForm
            action={actions.status}
            transport={
              documentActions
                ? { operation: 'status', propertyId: request.propertyId, unitId: request.unit.id }
                : undefined
            }
            label={`Change status for ${request.title}`}
          >
            <input type="hidden" name="requestId" value={request.id} />
            <label className="field">
              Change status
              <select name="status" defaultValue={request.status}>
                <option value="NEW">New</option>
                <option value="ASSIGNED">Assigned</option>
                <option value="IN_PROGRESS">In progress</option>
                <option value="DONE">Done</option>
                <option value="CANCELLED">Cancelled</option>
              </select>
            </label>
            <button className="btn btn-secondary btn-sm" type="submit">
              Update
            </button>
          </RequestActionForm>
        </div>
        <section className={styles.section} aria-label="Request photos">
          <h3>Photos</h3>
          {request.photos.length ? (
            <div className={styles.photos}>
              {request.photos.map(
                (photo) =>
                  photo.documentId && (
                    <RequestPhoto
                      key={photo.documentId}
                      documentId={photo.documentId}
                      title={request.title}
                    />
                  ),
              )}
            </div>
          ) : (
            <p className="muted">No photos attached. Add one to help the vendor prepare.</p>
          )}
          <RequestActionForm
            action={actions.photo}
            transport={
              documentActions
                ? { operation: 'photo', propertyId: request.propertyId, unitId: request.unit.id }
                : undefined
            }
            label={`Add photo to ${request.title}`}
          >
            <input type="hidden" name="requestId" value={request.id} />
            <FileUploader kind="photo" formField="photo" multiple={false} label="Add photo" />
            <button className="btn btn-secondary btn-sm" type="submit">
              Upload photo
            </button>
          </RequestActionForm>
        </section>
        <section className={styles.section} aria-label="Request comments">
          <h3>Recent comments</h3>
          {request.events.length ? (
            <ul className={styles.comments}>
              {request.events.map((event) => (
                <li key={event.id}>{event.body}</li>
              ))}
            </ul>
          ) : (
            <p className="muted">No comments yet.</p>
          )}
          <RequestActionForm
            action={actions.comment}
            transport={
              documentActions
                ? { operation: 'comment', propertyId: request.propertyId, unitId: request.unit.id }
                : undefined
            }
            label={`Comment on ${request.title}`}
          >
            <input type="hidden" name="requestId" value={request.id} />
            <label className="field">
              Comment
              <textarea
                name="comment"
                maxLength={2000}
                required
                placeholder="Add an update for this request"
              />
            </label>
            <button className="btn btn-secondary btn-sm" type="submit">
              Add comment
            </button>
          </RequestActionForm>
        </section>
      </div>
    </details>
  );
}
