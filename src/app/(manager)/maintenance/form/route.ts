import { NextRequest, NextResponse } from 'next/server';
import {
  createRequest,
  saveRequestDetails,
  updateRequest,
} from '@/components/maintenance/request-actions';
import { maintenanceReturn } from '@/lib/maintenance/navigation';
export async function POST(request: NextRequest) {
  const form = await request.formData();
  const value = (name: string) => String(form.get(name) ?? '');
  const propertyId = value('propertyId') || undefined;
  const unitId = value('scopeUnitId') || undefined;
  const requestId = value('requestId');
  const operation = value('operation');
  if (['assign', 'status', 'comment', 'photo'].includes(operation)) {
    return NextResponse.json(
      await updateRequest(
        operation as 'assign' | 'status' | 'comment' | 'photo',
        form,
        propertyId,
        unitId,
      ),
      { headers: { 'Cache-Control': 'no-store' } },
    );
  }
  const result = requestId
    ? await saveRequestDetails(form, requestId, propertyId ?? '', unitId)
    : await createRequest(form, propertyId, unitId);
  if (result.requestId)
    result.requestHref = `${maintenanceReturn(value('returnTo')).split('#')[0]}#request-${result.requestId}`;
  return NextResponse.json(result, { headers: { 'Cache-Control': 'no-store' } });
}
