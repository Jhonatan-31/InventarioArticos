import cluster from 'node:cluster';
import { fileURLToPath } from 'node:url';

const index = fileURLToPath(new URL('./index.js', import.meta.url));

if (cluster.isPrimary) {
  cluster.setupPrimary({
    exec: index,
    execArgv: ['--experimental-sqlite'],
  });
  const worker = cluster.fork();
  const stop = () => worker.kill('SIGTERM');
  process.on('SIGTERM', stop);
  process.on('SIGINT', stop);
  cluster.on('exit', (_worker, code, signal) => {
    if (signal) {
      process.kill(process.pid, signal);
      return;
    }
    process.exit(code ?? 1);
  });
}
