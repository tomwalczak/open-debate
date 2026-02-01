#!/usr/bin/env node
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '..');

// Run tsx with the source file
const args = ['--no-warnings', join(projectRoot, 'src/index.tsx'), ...process.argv.slice(2)];

const child = spawn('npx', ['tsx', ...args], {
  stdio: 'inherit',
  cwd: projectRoot,
  env: { ...process.env }
});

child.on('exit', (code) => {
  process.exit(code ?? 0);
});
