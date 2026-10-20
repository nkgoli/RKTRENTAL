import styles from '@/components/maintenance/issue-form.module.css';
import { notFound } from 'next/navigation';
import { requireManagerRole } from '@/lib/auth/access';
import { getMaintenanceRequest, listMaintenanceOptions } from '@/lib/maintenance';
import { maintenanceReturn } from '@/lib/maintenance/navigation';
import { MaintenanceIssueForm } from '@/components/maintenance/MaintenanceIssueForm';
import { RequestDetails } from '@/components/maintenance/RequestDetails';
import {
  assignPropertyMaintenanceAction,
  statusPropertyMaintenanceAction,
  commentPropertyMaintenanceAction,
  photoPropertyMaintenanceAction,
} from '../../../properties/[id]/maintenance/actions';
export default async function EditRequestPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{
    propertyId?: string;
    unitId?: string;
    returnTo?: string;
    notice?: string;
  }>;
}) {
  const [session, { id }, query] = await Promise.all([requireManagerRole(), params, searchParams]);
  const request = await getMaintenanceRequest(session.organizationId, id, {
    propertyId: query.propertyId,
    unitId: query.unitId,
  });
  if (!request) notFound();
  const { vendors } = await listMaintenanceOptions(session.organizationId);
  const returnTo = maintenanceReturn(query.returnTo);
  return (
    <div className={styles.page}>
      <a href={returnTo}>Back to repair requests</a>
      <h1>Edit repair request</h1>
      {query.notice && ['assign', 'status', 'comment', 'photo'].includes(query.notice) && (
        <p role="status">
          {
            {
              assign: 'Vendor assigned.',
              status: 'Status updated.',
              comment: 'Comment added.',
              photo: 'Photo uploaded.',
            }[query.notice]
          }
        </p>
      )}
      <MaintenanceIssueForm
        scope={{ requestId: id, propertyId: request.propertyId, unitId: request.unit.id }}
        returnTo={returnTo}
        units={[]}
        request={{ ...request, location: `${request.property.name} / ${request.unit.number}` }}
      />
      <section className="card">
        <h2>Assignment, status & activity</h2>
        <RequestDetails
          documentActions
          expanded
          hideEdit
          request={request}
          vendors={vendors}
          actions={{
            assign: assignPropertyMaintenanceAction.bind(null, request.propertyId, request.unit.id),
            status: statusPropertyMaintenanceAction.bind(null, request.propertyId, request.unit.id),
            comment: commentPropertyMaintenanceAction.bind(
              null,
              request.propertyId,
              request.unit.id,
            ),
            photo: photoPropertyMaintenanceAction.bind(null, request.propertyId, request.unit.id),
          }}
        />
      </section>
    </div>
  );
}
