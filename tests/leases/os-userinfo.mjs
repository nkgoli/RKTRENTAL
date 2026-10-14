// The embedded PostgreSQL package imports Node's named userInfo export.
// Some Windows sandboxes fail that OS lookup, so bind a fallback before loading it.
import os from 'node:os';
import { syncBuiltinESMExports } from 'node:module';

const original = os.userInfo;
os.userInfo = function userInfo(...args) {
  try {
    return original.apply(this, args);
  } catch {
    return {
      uid: -1, gid: -1,
      username: process.env.USERNAME || 'rocketrental',
      homedir: os.homedir(), shell: null,
    };
  }
};
syncBuiltinESMExports();
