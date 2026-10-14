// Preload: some sandboxed hosts fail os.userInfo() with ENOMEM. Fall back to env values.
import os from 'node:os';
import { syncBuiltinESMExports } from 'node:module';

const original = os.userInfo;
os.userInfo = function userInfo(...args) {
  try {
    return original.apply(this, args);
  } catch {
    const username = process.env.USERNAME || process.env.USER || 'rocketrental';
    return { uid: -1, gid: -1, username, homedir: os.homedir(), shell: null };
  }
};
syncBuiltinESMExports();
