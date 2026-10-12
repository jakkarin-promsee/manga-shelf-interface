import { spawn } from 'node:child_process';

const children = [
  spawn(process.execPath, ['server.mjs'], { stdio: 'inherit' }),
  spawn(process.platform === 'win32' ? 'npm.cmd' : 'npm', ['exec', 'vite', '--', '--host', '127.0.0.1'], { stdio: 'inherit', shell: process.platform === 'win32' }),
];

function stop() {
  for (const child of children) child.kill();
}
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
for (const child of children) child.on('exit', (code) => { if (code && code !== 0) { stop(); process.exitCode = code; } });
