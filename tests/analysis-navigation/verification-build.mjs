import configModule from 'next/dist/server/config.js';
import buildModule from 'next/dist/build/index.js';
const loadConfig = configModule.default ?? configModule;
const build = buildModule.default ?? buildModule;
const resolved = await loadConfig('phase-production-build', process.cwd());
resolved.distDir = '.next/build-analysis-navigation';
resolved.typescript.tsconfigPath = 'tests/analysis-navigation/tsconfig.verification.json';
process.env.__NEXT_PRIVATE_STANDALONE_CONFIG = JSON.stringify(resolved);
await build(process.cwd());
