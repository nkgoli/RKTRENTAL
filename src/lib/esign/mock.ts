import type {
  EsignCallbackPayload,
  EsignEnvelope,
  EsignProvider,
  SendForSignatureRequest,
} from './types';
import { EsignError } from './types';
import { isSandboxEnabled } from '@/lib/providers/sandbox';

/** Compatibility only. Signing records now live in PostgreSQL, including in sandbox mode. */
export function resetMockEsign(): void {}

export class MockEsignProvider implements EsignProvider {
  readonly name = 'mock';

  async sendForSignature(_request: SendForSignatureRequest): Promise<EsignEnvelope> {
    void _request;
    throw new EsignError('Use sendLeaseForSignature to persist the required signing parties.');
  }

  async getStatus(_envelopeId: string): Promise<EsignEnvelope | null> {
    void _envelopeId;
    return null;
  }

  async handleCallback(_payload: EsignCallbackPayload): Promise<EsignEnvelope> {
    void _payload;
    throw new EsignError('Bulk signing is retired. Each designated party must sign separately.');
  }

  async completeSigning(_leaseId: string, _signedAt = new Date()): Promise<EsignEnvelope> {
    void _signedAt;
    throw new EsignError('Bulk signing is retired. Each designated party must sign separately.');
  }
}

export function getEsignProvider(): EsignProvider {
  if (!isSandboxEnabled()) throw new EsignError('Mock e-signature provider is sandbox-only.');
  return new MockEsignProvider();
}
