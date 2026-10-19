import { renameLeaseDocumentAction } from '../../documentActions';

/** Return confirmed rename feedback without applying a streamed page refresh. */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const form = await request.formData();
  form.set('leaseId', id);
  // The existing action checks the manager session and scopes the document to
  // this lease and organization, then validates, writes and revalidates it.
  const state = await renameLeaseDocumentAction(form);
  return Response.json(state, { headers: { 'Cache-Control': 'no-store' } });
}
