import { NextRequest, NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import type { MaintenancePriority, MaintenanceStatus } from '@prisma/client';
import { requireManagerRole } from '@/lib/auth/access';
import {
  getMaintenanceEditor,
  MaintenanceError,
  saveMaintenanceEditor,
} from '@/lib/maintenance/service';
import { serializeMaintenanceEditor } from '@/lib/maintenance/editor';
import { updateRequest } from '@/components/maintenance/request-actions';

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireManagerRole();
  const { id } = await params;
  const form = await request.formData();
  const value = (name: string) => String(form.get(name) ?? '').trim();
  const scope = { propertyId: value('propertyId'), unitId: value('scopeUnitId') };
  const json = (body: unknown) =>
    NextResponse.json(body, { headers: { 'Cache-Control': 'no-store' } });
  if (!scope.propertyId || !scope.unitId)
    return json({ error: 'Property and unit scope are required.' });
  try {
    const operation = value('operation');
    let message = 'Request saved. All changes are up to date.';
    if (operation === 'save') {
      await saveMaintenanceEditor(
        session,
        id,
        {
          title: value('title'),
          description: value('description'),
          priority: value('priority') as MaintenancePriority,
          vendorId: value('vendorId') || null,
          status: value('status') as MaintenanceStatus,
          updatedAt: value('updatedAt'),
        },
        scope,
      );
    } else if (operation === 'comment' || operation === 'photo') {
      form.set('requestId', id);
      const result = await updateRequest(operation, form, scope.propertyId, scope.unitId);
      if (result.error) return json(result);
      message = result.message!;
    } else return json({ error: 'Choose a supported request action.' });
    revalidatePath('/maintenance');
    revalidatePath(`/maintenance/${id}/edit`);
    revalidatePath(`/properties/${scope.propertyId}`);
    revalidatePath(`/properties/${scope.propertyId}/maintenance`);
    const saved = await getMaintenanceEditor(session.organizationId, id, scope);
    return json({ message, request: saved ? serializeMaintenanceEditor(saved) : undefined });
  } catch (error) {
    return json({
      error:
        error instanceof MaintenanceError
          ? error.message
          : 'The action could not be completed. Your input is still here. Try again.',
    });
  }
}
