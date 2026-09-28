import { spawn } from 'node:child_process';
const children = [];
let stopping = false;
function stop(code = 0) { if (stopping) return; stopping = true; for (const child of children) child.kill(); process.exitCode = code; }
function launch(args, stdio = 'inherit') {
  const child = spawn(process.execPath, args, { stdio, windowsHide: true });
  children.push(child);
  child.on('error', error => { console.error(error.message); stop(1); });
  child.on('exit', code => stop(code || 0));
  return child;
}
const api = launch(['--watch', 'server/index.js'], ['inherit', 'pipe', 'inherit']);
let output = '';
let clientStarted = false;
api.stdout.setEncoding('utf8');
api.stdout.on('data', chunk => {
  process.stdout.write(chunk);
  if (clientStarted || stopping) return;
  output += chunk;
  // Start the frontend only after this API process announces its listener.
  if (output.includes('API ready at http://')) {
    clientStarted = true;
    launch(['node_modules/vite/bin/vite.js', '--config', 'client/vite.config.js']);
  }
  output = output.slice(-1024);
});
process.on('SIGINT', () => stop());
process.on('SIGTERM', () => stop());
