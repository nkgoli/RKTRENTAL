import type {
  EsignCallbackPayload,
  EsignEnvelope,
  EsignProvider,
  SendForSignatureRequest,
} from './types';
import { EsignError, envelopeIdForLease, leaseIdFromEnvelope } from './types';

type Store = Map<string, EsignEnvelope>;
const globalStore = globalThis as unknown as { __rrMockEsign?: Store };
const store: Store = (globalStore.__rrMockEsign ??= new Map());

export function resetMockEsign(): void {
  store.clear();
}

/** Sandbox e-signature provider: no network, deterministic envelope per lease. */
export class MockEsignProvider implements EsignProvider {
  readonly name = 'mock';

  async sendForSignature(request: SendForSignatureRequest): Promise<EsignEnvelope> {
    if (!request.signers.length) throw new EsignError('At least one signer is required.');
    if (request.signers.some((s) => !s.email.includes('@')))
      throw new EsignError('Every signer needs a valid email address.');
    const existing = store.get(envelopeIdForLease(request.leaseId));
    if (existing?.status === 'SIGNED') return existing;
    const envelope: EsignEnvelope = {
      id: envelopeIdForLease(request.leaseId),
      provider: this.name,
      leaseId: request.leaseId,
      status: 'SENT',
      signers: request.signers,
      sentAt: existing?.sentAt ?? new Date().toISOString(),
      signedAt: null,
    };
    store.set(envelope.id, envelope);
    return envelope;
  }

  async getStatus(envelopeId: string): Promise<EsignEnvelope | null> {
    return store.get(envelopeId) ?? null;
  }

  async handleCallback(payload: EsignCallbackPayload): Promise<EsignEnvelope> {
    const leaseId = leaseIdFromEnvelope(payload.envelopeId);
    if (!leaseId) throw new EsignError('Unknown e-signature envelope.');
    const current = store.get(payload.envelopeId);
    if (payload.event === 'signed') {
      const envelope: EsignEnvelope = {
        id: payload.envelopeId,
        provider: this.name,
        leaseId,
        status: 'SIGNED',
        signers: current?.signers ?? [],
        sentAt: current?.sentAt ?? null,
        signedAt: payload.signedAt ?? new Date().toISOString(),
      };
      store.set(envelope.id, envelope);
      return envelope;
    }
    if (payload.event === 'declined') {
      const envelope: EsignEnvelope = {
        id: payload.envelopeId,
        provider: this.name,
        leaseId,
        status: 'DECLINED',
        signers: current?.signers ?? [],
        sentAt: current?.sentAt ?? null,
        signedAt: null,
      };
      store.set(envelope.id, envelope);
      return envelope;
    }
    if (!current) throw new EsignError('Unknown e-signature envelope.');
    return current;
  }

  /** Test and demo helper: simulate every signer completing signing. */
  async completeSigning(leaseId: string, signedAt = new Date()): Promise<EsignEnvelope> {
    return this.handleCallback({
      envelopeId: envelopeIdForLease(leaseId),
      event: 'signed',
      signedAt: signedAt.toISOString(),
    });
  }
}

export function getEsignProvider(): EsignProvider {
  return new MockEsignProvider();
}
