export type EsignStatusValue = 'NOT_SENT' | 'SENT' | 'PARTIALLY_SIGNED' | 'SIGNED' | 'DECLINED';

export type EsignSigner = {
  name: string;
  email: string;
  id?: string;
  role?: 'OWNER' | 'TENANT';
  signedAt?: string | null;
};

export type EsignEnvelope = {
  id: string;
  provider: string;
  leaseId: string;
  status: EsignStatusValue;
  signers: EsignSigner[];
  sentAt: string | null;
  signedAt: string | null;
  version?: number;
  snapshotHash?: string;
  archiveStatus?: string;
};

export type EsignCallbackPayload = {
  envelopeId: string;
  event: 'sent' | 'signed' | 'declined';
  signedAt?: string;
};

export type SendForSignatureRequest = {
  leaseId: string;
  documentName: string;
  signers: EsignSigner[];
  summaryLines: string[];
};

export interface EsignProvider {
  readonly name: string;
  sendForSignature(request: SendForSignatureRequest): Promise<EsignEnvelope>;
  getStatus(envelopeId: string): Promise<EsignEnvelope | null>;
  handleCallback(payload: EsignCallbackPayload): Promise<EsignEnvelope>;
}

export class EsignError extends Error {
  constructor(
    message: string,
    readonly field?: string,
    readonly status = 400,
    readonly code = 'INVALID_SIGNING_REQUEST',
  ) {
    super(message);
    this.name = 'EsignError';
  }
}

export function envelopeIdForLease(leaseId: string): string {
  return `mock-${leaseId}`;
}

export function leaseIdFromEnvelope(envelopeId: string): string | null {
  return envelopeId.startsWith('mock-') ? envelopeId.slice('mock-'.length) : null;
}
