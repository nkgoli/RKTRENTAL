import type { FileTarget } from './types';
import { StorageError } from './types';

export const DEFAULT_PHOTO_LIMIT_PER_PROPERTY = 20;
export const DEFAULT_PHOTO_LIMIT_PER_UNIT = 10;

export type PhotoLimitEnv = Record<string, string | undefined>;

export interface PhotoUsage {
  used: number;
  max: number | null;
}

/** Parses a positive integer limit; blank or invalid values fall back to the default. */
export function parsePhotoLimit(raw: string | undefined, fallback: number): number {
  if (raw === undefined || raw.trim() === '') return fallback;
  const parsed = Number(raw);
  if (!Number.isInteger(parsed) || parsed <= 0) return fallback;
  return parsed;
}

export function photoLimits(env: PhotoLimitEnv = process.env): {
  perProperty: number;
  perUnit: number;
} {
  return {
    perProperty: parsePhotoLimit(env.PHOTO_LIMIT_PER_PROPERTY, DEFAULT_PHOTO_LIMIT_PER_PROPERTY),
    perUnit: parsePhotoLimit(env.PHOTO_LIMIT_PER_UNIT, DEFAULT_PHOTO_LIMIT_PER_UNIT),
  };
}

/**
 * Maximum PHOTO-kind files allowed on a target, or null when the target kind is
 * not limited. Only property and unit targets are limited; lease targets (for
 * example tenant repair photos) and every non-photo kind are unlimited.
 */
export function photoLimitForTarget(
  target: FileTarget,
  env: PhotoLimitEnv = process.env,
): number | null {
  const limits = photoLimits(env);
  if (target.kind === 'property') return limits.perProperty;
  if (target.kind === 'unit') return limits.perUnit;
  return null;
}

/** Alias kept for callers that phrase the lookup as a getter. */
export const getPhotoLimitForTarget = photoLimitForTarget;

export function photoLimitError(target: FileTarget, used: number, max: number): StorageError {
  const targetLabel = target.kind === 'property' ? 'property' : 'unit';
  return new StorageError(
    `Photo limit reached: this ${targetLabel} already has ${used} of ${max} photos allowed. ` +
      `Delete a photo before adding another (limit: ${max}).`,
    'VALIDATION',
    400,
  );
}

/** Throws the shared 400 photo-limit error when `used` has reached `max`. */
export function assertPhotoWithinLimit(target: FileTarget, used: number, max: number | null): void {
  if (max !== null && used >= max) throw photoLimitError(target, used, max);
}
