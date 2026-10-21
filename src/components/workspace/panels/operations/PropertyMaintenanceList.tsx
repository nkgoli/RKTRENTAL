import Link from 'next/link';
import type { ReactNode } from 'react';
import type { RequestActions } from '@/components/maintenance/RequestDetails';
import { maintenanceFormHref } from '@/lib/maintenance/navigation';
import { Table } from '@/components/ui/Table';
import {
  MaintenanceFilters,
  MaintenanceListFooter,
} from '@/components/maintenance/MaintenanceListControls';
import {
  maintenanceQueryString,
  type MaintenanceBoardRequest,
  type MaintenanceListQuery,
} from '@/lib/maintenance';
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
  vendors?: { id: string; name: string }[];
  actions?: RequestActions;
}) {
  const { requests } = list;
  const action = workspaceTabHref(propertyId, 'maintenance');
  const hidden = { unit: unitId };
  if (list.isEmpty) {
    return (
      <section className={`card ${styles.emptyState}`} aria-labelledby="repair-requests-heading">
        <span className={styles.emptyIcon} aria-hidden="true">
          +
        </span>
        <h2 id="repair-requests-heading">No repair requests yet</h2>
        <p className="muted">
          When something needs fixing, log it here and track it from new to done. Start with your
          first request.
        </p>
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
        <div
          className={styles.tableWrap}
          role="region"
          aria-label="Repair request list"
          tabIndex={0}
        >
          <Table mobile="cards" aria-label="Repair requests">
            <thead>
              <tr>
                <th scope="col">Request</th>
                <th scope="col">Unit</th>
                <th scope="col">Priority</th>
                <th scope="col">Status</th>
                <th scope="col">Assigned to</th>
                <th scope="col">Date</th>
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
                  <tr key={request.id} id={`request-${request.id}`} className="row-link">
                    <td data-cell="title">
                      <strong>
                        <Link
                          className="row-anchor"
                          href={maintenanceFormHref(
                            propertyId,
                            request.unit.id,
                            `/properties/${propertyId}/maintenance${maintenanceQueryString(query, { unit: unitId })}`,
                            request.id,
                          )}
                        >
                          {request.title}
                        </Link>
                      </strong>
                      {request.description && (
                        <span className={styles.requestDescription}>{request.description}</span>
                      )}
                      {request.photos.length > 0 && (
                        <span className={styles.requestDescription}>Photo attached</span>
                      )}
                    </td>
                    <td data-cell="meta">
                      <Link
                        href={`/properties/${propertyId}?unit=${encodeURIComponent(request.unit.id)}`}
                      >
                        {request.unit.number}
                      </Link>
                    </td>
                    <td data-cell="amount">
                      <span className={`badge ${priorityTone(request.priority)}`}>
                        {priorityLabel(request.priority)}
                      </span>
                    </td>
                    <td data-cell="status">
                      <span className={`badge ${statusTone(request.status)}`}>
                        {statusLabel(request.status)}
                      </span>
                    </td>
                    <td data-cell="sub">
                      {request.vendor?.name ?? request.vendorName ?? 'Unassigned'}
                    </td>
                    <td data-cell="hide">{formatDate(request.createdAt)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </Table>
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
