import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createInterface } from 'node:readline/promises';
import net from 'node:net';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dataDir = path.join(projectRoot, 'data');
const coverDir = path.join(dataDir, 'covers');
const stagingDir = path.join(dataDir, 'cover-staging');
const mangaFile = path.join(dataDir, 'manga.txt');
const configFile = path.join(dataDir, 'config.json');
const emptyConfig = { cardSize: 158, categories: [{ id: 'main', name: 'หมวดหลัก' }] };
const args = process.argv.slice(2);

if (args.length > 1 || (args[0] && !['--dry-run', '--erase-local-data', '--help'].includes(args[0]))) {
  console.error('Usage: node scripts/reset-data.mjs [--dry-run | --erase-local-data | --help]');
  process.exitCode = 1;
} else if (args[0] === '--help') {
  console.log('Preview: node scripts/reset-data.mjs');
  console.log('Reset:   node scripts/reset-data.mjs --erase-local-data');
  console.log('Reset requires an interactive terminal and two typed confirmations.');
} else {
  try {
    const execute = args[0] === '--erase-local-data';
    const plan = await inspectData();
    printPlan(plan);

    if (!execute) {
      console.log('\nPreview only. Nothing was changed.');
      console.log('To reset this collection, stop the app and run: node scripts/reset-data.mjs --erase-local-data');
    } else {
      if (!process.stdin.isTTY || !process.stdout.isTTY) {
        throw new Error('Reset requires an interactive terminal; piped input is not accepted.');
      }
      const port = Number(process.env.PORT || 4174);
      if (Number.isInteger(port) && port > 0 && port < 65536 && await portIsOpen(port)) {
        throw new Error(`Port ${port} is in use. Stop Manga Shelf before resetting its data.`);
      }

      const challenge = `DELETE DATA IN ${path.basename(projectRoot)}`;
      const prompt = createInterface({ input: process.stdin, output: process.stdout });
      let first;
      let second;
      try {
        console.log('\nThis permanently removes every manga, custom category, saved card size, and local cover in the paths above.');
        first = await prompt.question(`Type exactly "${challenge}": `);
        if (first === challenge) second = await prompt.question(`Type the full project path exactly "${projectRoot}": `);
      } finally {
        prompt.close();
      }
      if (first !== challenge || second !== projectRoot) {
        console.log('Confirmation did not match. Nothing was changed.');
        process.exitCode = 1;
      } else {
        // Scan again after confirmation so newly added files or links cannot bypass validation.
        const current = await inspectData();
        if (Number.isInteger(port) && port > 0 && port < 65536 && await portIsOpen(port)) {
          throw new Error(`Port ${port} is in use. Stop Manga Shelf before resetting its data.`);
        }
        await fs.mkdir(dataDir, { recursive: true });
        await fs.mkdir(coverDir, { recursive: true });
        await fs.mkdir(stagingDir, { recursive: true });
        await fs.writeFile(mangaFile, '[]\n', 'utf8');
        await fs.writeFile(configFile, JSON.stringify(emptyConfig, null, 2) + '\n', 'utf8');
        for (const file of [...current.covers, ...current.staging]) await fs.unlink(file);
        console.log('\nCollection reset. Manga Shelf will start with an empty Main category.');
      }
    }
  } catch (error) {
    console.error(`Reset aborted: ${error.message}`);
    process.exitCode = 1;
  }
}

async function inspectData() {
  await expectKind(dataDir, 'directory');
  await expectKind(mangaFile, 'file');
  await expectKind(configFile, 'file');
  await expectKind(coverDir, 'directory');
  await expectKind(stagingDir, 'directory');
  return { covers: await regularFiles(coverDir), staging: await regularFiles(stagingDir) };
}

async function expectKind(target, kind) {
  let stat;
  try { stat = await fs.lstat(target); }
  catch (error) { if (error.code === 'ENOENT') return; throw error; }
  if (kind === 'directory' ? !stat.isDirectory() : !stat.isFile()) {
    throw new Error(`Expected a regular ${kind} at ${target}; no data was changed.`);
  }
}

async function regularFiles(directory) {
  let entries;
  try { entries = await fs.readdir(directory, { withFileTypes: true }); }
  catch (error) { if (error.code === 'ENOENT') return []; throw error; }
  return entries.map(entry => {
    if (!entry.isFile()) throw new Error(`Unexpected directory or link in ${directory}: ${entry.name}; no data was changed.`);
    return path.join(directory, entry.name);
  });
}

function printPlan(plan) {
  console.log(`Project: ${projectRoot}`);
  console.log('Reset targets:');
  console.log(`  ${mangaFile} -> []`);
  console.log(`  ${configFile} -> default Main category and card size`);
  console.log(`  ${coverDir} -> remove ${plan.covers.length} file(s)`);
  console.log(`  ${stagingDir} -> remove ${plan.staging.length} file(s)`);
}

function portIsOpen(port) {
  return new Promise(resolve => {
    const socket = net.connect({ host: '127.0.0.1', port });
    socket.setTimeout(500);
    socket.once('connect', () => { socket.destroy(); resolve(true); });
    socket.once('error', () => resolve(false));
    socket.once('timeout', () => { socket.destroy(); resolve(false); });
  });
}
