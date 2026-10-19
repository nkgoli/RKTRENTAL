// Load the project configuration into Next's phase cache with task-owned output.
// This leaves the shared configuration and development output untouched.
import configModule from 'next/dist/server/config.js';
import buildModule from 'next/dist/build/index.js';

const loadConfig = configModule.default ?? configModule;
const build = buildModule.default ?? buildModule;
const resolved = await loadConfig('phase-production-build', process.cwd());
const verificationId = process.env.RENT_VERIFICATION_ID ?? '102d7024';
if (!/^[a-z0-9]+$/.test(verificationId)) throw new Error('Invalid verification identity');
resolved.distDir = `.next/build-${verificationId}`;
resolved.typescript.tsconfigPath = 'tests/rent-analysis/tsconfig.verification.json';
process.env.__NEXT_PRIVATE_STANDALONE_CONFIG = JSON.stringify(resolved);
await build(process.cwd());
