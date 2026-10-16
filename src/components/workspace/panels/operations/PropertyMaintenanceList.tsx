import Link from 'next/link';
import type { ReactNode } from 'react';
import {
  MaintenanceFilters,
  MaintenanceListFooter,
} from '@/components/maintenance/MaintenanceListControls';
import type { MaintenanceBoardRequest, MaintenanceListQuery } from '@/lib/maintenance';
import { workspaceTabHref } from '@/components/workspace/routes';
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
  list,
  query,
  unitId,
  createRequestControl,
}: {
  propertyId: string;
  list: {
    requests: MaintenanceBoardRequest[];
    isEmpty: boolean;
    total: number;
    page: number;
    pageCount: number;
  };
  query: MaintenanceListQuery;
  unitId?: string;
  createRequestControl: ReactNode;
}) {
  const { requests } = list;
  const action = workspaceTabHref(propertyId, 'maintenance');
  const hidden = { unit: unitId };
  if (list.isEmpty) {
    return (
      <section className={`card ${styles.emptyState}`} aria-labelledby="repair-requests-heading">
        <span className={styles.emptyIcon} aria-hidden="true">+</span>
        <h2 id="repair-requests-heading">No repair requests yet</h2>
        <p className="muted">When something needs fixing, log it here and track it from new to done. Start with your first request.</p>
        {createRequestControl}
      </section>
    );
  }

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
        <div className={styles.listHeader}>
          <MaintenanceFilters action={action} hidden={hidden} query={query} />
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
                    No repair requests match these filters.
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
        <div className={styles.listHeader}>
          <MaintenanceListFooter
            action={action}
            hidden={hidden}
            query={query}
            page={list.page}
            pageCount={list.pageCount}
            total={list.total}
          />
        </div>
      </section>
    </>
  );
}
