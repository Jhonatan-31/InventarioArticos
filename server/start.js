import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const index = fileURLToPath(new URL('./index.js', import.meta.url));
const child = spawn(process.execPath, ['--experimental-sqlite', index], {
  stdio: 'inherit',
  env: process.env,
});

function stop(signal) {
  if (!child.killed) child.kill(signal);
}

process.on('SIGTERM', () => stop('SIGTERM'));
process.on('SIGINT', () => stop('SIGINT'));

child.on('exit', (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exit(code ?? 1);
});
