import Link from 'next/link';
import type { ReactNode } from 'react';
import type { MaintenanceBoardRequest } from '@/lib/maintenance';
import styles from './operations.module.css';

function statusLabel(status: MaintenanceBoardRequest['status']) {
  return status
    .replaceAll('_', ' ')
    .toLowerCase()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function statusTone(status: MaintenanceBoardRequest['status']) {
  if (status === 'DONE') return 'success';
  if (status === 'CANCELLED') return '';
  if (status === 'NEW') return 'info';
  return 'warning';
}

function priorityTone(priority: MaintenanceBoardRequest['priority']) {
  if (priority === 'URGENT') return 'danger';
  if (priority === 'HIGH') return 'warning';
  return '';
}

function priorityLabel(priority: MaintenanceBoardRequest['priority']) {
  return priority[0] + priority.slice(1).toLowerCase();
}

function formatDate(date: Date) {
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export function PropertyMaintenanceList({
  propertyId,
  requests,
  createRequestControl,
}: {
  propertyId: string;
  requests: MaintenanceBoardRequest[];
  createRequestControl: ReactNode;
}) {
  return (
    <>
      <section
        className={`card flush ${styles.listCard}`}
        aria-labelledby="repair-requests-heading"
      >
        <div className={`card-header ${styles.listHeader}`}>
          <h2 id="repair-requests-heading">Repair requests</h2>
          {createRequestControl}
        </div>
        <div className={styles.tableWrap}>
          <table className="table" aria-label="Repair requests">
            <thead>
              <tr>
                <th>Request</th>
                <th>Unit</th>
                <th>Priority</th>
                <th>Status</th>
                <th>Assigned to</th>
                <th>Date</th>
              </tr>
            </thead>
            <tbody>
              {requests.length === 0 ? (
                <tr>
                  <td colSpan={6} className={`muted ${styles.emptyCell}`}>
                    No repair requests for this property yet.
                  </td>
                </tr>
              ) : (
                requests.map((request) => (
                  <tr key={request.id} id={`request-${request.id}`}>
                    <td>
                      <strong>{request.title}</strong>
                      {request.description && (
                        <span className={styles.requestDescription}>{request.description}</span>
                      )}
                      {request.photos.length > 0 && (
                        <span className={styles.requestDescription}>Photo attached</span>
                      )}
                    </td>
                    <td>
                      <Link
                        href={`/properties/${propertyId}?unit=${encodeURIComponent(request.unit.id)}`}
                      >
                        {request.unit.number}
                      </Link>
                    </td>
                    <td>
                      <span className={`badge ${priorityTone(request.priority)}`}>
                        {priorityLabel(request.priority)}
                      </span>
                    </td>
                    <td>
                      <span className={`badge ${statusTone(request.status)}`}>
                        {statusLabel(request.status)}
                      </span>
                    </td>
                    <td>{request.vendor?.name ?? request.vendorName ?? 'Unassigned'}</td>
                    <td>{formatDate(request.createdAt)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
