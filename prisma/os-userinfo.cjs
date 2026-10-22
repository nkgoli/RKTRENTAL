// Load before tsx's CommonJS preflight on sandboxed Windows hosts.
const os = require('node:os');
const { syncBuiltinESMExports } = require('node:module');
const original = os.userInfo;
os.userInfo = function userInfo(...args) {
  try {
    return original.apply(this, args);
  } catch {
    return {
      uid: -1,
      gid: -1,
      username: process.env.USERNAME || process.env.USER || 'rocketrental',
      homedir: os.homedir(),
      shell: null,
    };
  }
};
syncBuiltinESMExports();
