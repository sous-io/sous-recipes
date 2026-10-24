#!/usr/bin/env node
// Command line for the image selection server and the image archive.
//
//   node imagegen.js serve      [--session DIR] [--archive DIR] [--port N] [--model M] [--size S]
//                               [--quality Q] [--count N] [--concurrency N] [--fresh]
//   node imagegen.js add        [--session DIR] (--prompt TEXT | --prompt-file FILE) [--count N]
//                               [--title T] [--request TEXT] [--purpose TEXT] [--project DIR]
//                               [--ref IMAGE]... (up to 4) [--variants-file FILE]
//                               [--mode single|spread] [--model M] [--size S] [--quality Q]
//                               [--edit-of LABEL_OR_FILE]
//   node imagegen.js watch      [--session DIR] [--after SEQ]
//   node imagegen.js events     [--session DIR] [--after SEQ]
//   node imagegen.js wait       [--session DIR] [--after SEQ] [--event TYPE[,TYPE...]] [--set N]
//                               [--timeout SECONDS]
//   node imagegen.js find       [WORD...] [--status STATUS]
//   node imagegen.js crop       --image FILE --cell N [--grid 4x2] [--trim] [--transparent]
//                               [--tolerance N] [--out FILE]
//   node imagegen.js state      [--session DIR]
//   node imagegen.js stop       [--session DIR]
//   node imagegen.js record-use --image FILE --where PATH_OR_URL [--how TEXT]
//   node imagegen.js note       --image FILE --text TEXT
//
// The API key is read from OPENAI_API_KEY, or else from the nearest
// .sous/.env.local or .sous/.env above the current directory, where sous keeps
// the recipe's answer. The archive defaults to generated-images in SOUS_HOME
// (~/.sous). The session directory, which holds the server's state and event
// log, defaults to IMAGEGEN_SESSION, then to one folder per working directory
// under the archive's .sessions folder, so every command run from the same
// project finds the same server.

import { Buffer } from 'node:buffer';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { serve } from './lib/server.js';
import { readRecord, recordPath, updateRecord } from './lib/record.js';
import { crop as cropPng, decodePng, encodePng } from './lib/png.js';

const REPEATABLE = new Set(['ref']);
// Names wait --event accepts for several event types at once.
const EVENT_GROUPS = {
  'any-verdict': ['accept', 'unaccept', 'store', 'unstore', 'reject', 'unreject'],
  'any-user': ['accept', 'unaccept', 'store', 'unstore', 'reject', 'unreject', 'comment', 'edit-request', 'retry', 'refresh', 'close-set', 'reopen-set', 'keep-alive'],
};
const [command, ...rest] = process.argv.slice(2);
const args = parseArgs(rest);
const archiveDir = path.resolve(args.archive || path.join(sousHome(), 'generated-images'));
const sessionDir = path.resolve(args.session || process.env.IMAGEGEN_SESSION || defaultSession());

const commands = {
  async serve() {
    const apiKey = findApiKey();
    if (!apiKey) fail('No OpenAI API key: set OPENAI_API_KEY, or answer the recipe variable with sous vars');
    const running = runningServer();
    if (running) fail(`A server for this session is already running at ${running.url}`);
    // --fresh starts an empty picker; the images already archived are kept.
    if (args.fresh) {
      for (const f of ['state.json', 'events.jsonl', 'server.json']) fs.rmSync(path.join(sessionDir, f), { force: true });
    }
    fs.mkdirSync(sessionDir, { recursive: true });
    const info = await serve({
      sessionDir,
      archiveDir,
      apiKey,
      host: args.host || '127.0.0.1',
      port: Number(args.port ?? 7766),
      concurrency: Number(args.concurrency ?? 4),
      defaults: {
        model: args.model || 'gpt-image-2',
        size: args.size || '1024x1024',
        quality: args.quality || 'auto',
        count: Number(args.count ?? 3),
      },
    });
    console.log(`Image selection UI: ${info.url}`);
    console.log(`Session: ${sessionDir}`);
    console.log(`Archive: ${info.archiveDir}`);
  },

  async add() {
    const prompt = args['prompt-file'] ? fs.readFileSync(args['prompt-file'], 'utf8') : args.prompt;
    if (!prompt && !args['variants-file']) fail('add needs --prompt, --prompt-file or --variants-file');
    const references = (args.ref ?? []).map((r) => path.resolve(r));
    if (references.length > 4) fail('At most 4 reference images are allowed');
    const body = {
      prompt,
      title: args.title,
      request: args.request,
      purpose: args.purpose,
      project: args.project ? path.resolve(args.project) : process.cwd(),
      references,
      mode: args.mode,
      editOf: args['edit-of'],
      model: args.model,
      size: args.size,
      quality: args.quality,
    };
    if (args.count != null) body.count = Number(args.count);
    // A JSON array of { prompt, note }, one per image; it sets the count.
    if (args['variants-file']) body.variants = JSON.parse(fs.readFileSync(args['variants-file'], 'utf8'));
    console.log(JSON.stringify(await api('POST', '/api/sets', body)));
  },

  async state() {
    const state = await api('GET', '/api/state');
    for (const set of state.sets) {
      const imgs = set.images.map((i) => `${set.id}.${i.index}:${i.verdict || i.status}`).join(' ');
      console.log(`set ${set.id}${set.closed ? ' (closed)' : ''} "${set.title}" ${imgs}`);
    }
    console.log(`open sets: ${state.openSets.join(', ') || 'none'}; generating: ${state.generating}`);
  },

  async stop() {
    await api('POST', '/api/shutdown');
    console.log('stopped');
  },

  // Records where an archived image was used, in its markdown record.
  async 'record-use'() {
    if (!args.image || !args.where) fail('record-use needs --image and --where');
    const file = recordPath(path.resolve(args.image));
    updateRecord(file, (m) => {
      m.usedIn = m.usedIn || [];
      m.usedIn.push({ where: args.where, how: args.how || null, at: new Date().toISOString() });
    });
    console.log(file);
  },

  async note() {
    if (!args.image || !args.text) fail('note needs --image and --text');
    const file = recordPath(path.resolve(args.image));
    updateRecord(file, (m) => {
      m.notes = m.notes || [];
      m.notes.push({ text: args.text, at: new Date().toISOString() });
    });
    console.log(file);
  },

  // Prints every event after --after, then follows the file, one JSON line per
  // event, so a monitor can turn each line into a notification.
  async watch() {
    followEvents(Number(args.after ?? 0), (line) => process.stdout.write(line + '\n'));
  },

  // Prints every event after --after and exits: the non-following watch.
  async events() {
    for (const { line } of readEvents(Number(args.after ?? 0))) console.log(line);
  },

  // Blocks until an event matching --event (and --set) arrives after --after,
  // printing every event it passes, then exits. Run in the background, it
  // gives one completion notification where no monitor is available.
  async wait() {
    const after = args.after != null ? Number(args.after) : lastSeq();
    const wanted = new Set(String(args.event || 'any').split(',').flatMap((e) => EVENT_GROUPS[e.trim()] ?? [e.trim()]));
    const set = args.set != null ? Number(args.set) : null;
    const timeout = Number(args.timeout ?? 0);
    if (timeout > 0) {
      setTimeout(() => {
        console.error(`No matching event within ${timeout} seconds; the last event is ${lastSeq()}`);
        process.exit(2);
      }, timeout * 1000);
    }
    followEvents(after, (line, ev) => {
      console.log(line);
      const kind = wanted.has('any') || wanted.has(ev.event);
      const inSet = set == null || ev.set === set || ev.newSet === set;
      if (kind && inSet) process.exit(0);
    });
  },

  // Searches the archive's records; every word must appear in the title,
  // request, purpose, prompt, variation or comments.
  async find() {
    const words = (args._ ?? []).map((w) => w.toLowerCase());
    const hits = [];
    for (const day of safeReaddir(archiveDir).filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d)).sort().reverse()) {
      for (const name of safeReaddir(path.join(archiveDir, day)).filter((f) => f.endsWith('.md')).sort().reverse()) {
        const file = path.join(archiveDir, day, name);
        let m;
        try {
          m = readRecord(file);
        } catch {
          continue;
        }
        if (args.status && m.status !== args.status) continue;
        const text = [m.title, m.request, m.purpose, m.prompt, m.variation, ...(m.comments ?? []).map((c) => c.text)]
          .filter(Boolean).join(' ').toLowerCase();
        if (words.every((w) => text.includes(w))) hits.push(m);
      }
    }
    for (const m of hits) {
      console.log(`${m.status.padEnd(9)} ${m.title}  (${path.dirname(m.id)})`);
      console.log(`          ${path.join(archiveDir, path.dirname(m.id), m.image)}`);
    }
    if (!hits.length) console.log('No archived image matches.');
  },

  // Cuts one cell out of a grid image at full resolution.
  async crop() {
    if (!args.image || !args.cell) fail('crop needs --image and --cell');
    const [cols, rows] = String(args.grid || '4x2').split('x').map(Number);
    const cell = Number(args.cell);
    if (!(cols > 0 && rows > 0) || !(cell >= 1 && cell <= cols * rows)) fail(`--cell must be from 1 to ${cols * rows} for a ${cols}x${rows} grid`);
    const src = path.resolve(args.image);
    const img = decodePng(fs.readFileSync(src));
    const cw = Math.floor(img.width / cols);
    const ch = Math.floor(img.height / rows);
    let out = cropPng(img, ((cell - 1) % cols) * cw, Math.floor((cell - 1) / cols) * ch, cw, ch);
    const tolerance = Number(args.tolerance ?? 24);
    if (args.trim) out = trimToContent(out, tolerance);
    if (args.transparent) clearBackground(out, tolerance);
    const dest = path.resolve(args.out || src.replace(/\.[a-z0-9]+$/i, `-cell${cell}.png`));
    fs.writeFileSync(dest, encodePng(out));
    console.log(dest);
  },
};

if (!commands[command]) fail(`Unknown command "${command ?? ''}". Use ${Object.keys(commands).join(', ')}.`);
if (args._ && command !== 'find') fail(`Unexpected argument ${args._[0]}`);
await commands[command]();

function eventsFile() {
  return path.join(sessionDir, 'events.jsonl');
}

function readEvents(after) {
  let text;
  try {
    text = fs.readFileSync(eventsFile(), 'utf8');
  } catch {
    return [];
  }
  return text.split('\n').filter(Boolean).map((line) => ({ line, ev: JSON.parse(line) })).filter(({ ev }) => ev.seq > after);
}

function lastSeq() {
  const all = readEvents(0);
  return all.length ? all[all.length - 1].ev.seq : 0;
}

// Calls onEvent for every event after `after`, then for each new one, polling
// the log every quarter of a second.
function followEvents(after, onEvent) {
  const file = eventsFile();
  let offset = 0;
  let partial = '';
  const read = () => {
    let size;
    try {
      size = fs.statSync(file).size;
    } catch {
      return;
    }
    if (size < offset) offset = 0;
    if (size === offset) return;
    const fd = fs.openSync(file, 'r');
    const buf = Buffer.alloc(size - offset);
    fs.readSync(fd, buf, 0, buf.length, offset);
    fs.closeSync(fd);
    offset = size;
    const lines = (partial + buf.toString('utf8')).split('\n');
    partial = lines.pop();
    for (const line of lines) {
      if (!line) continue;
      const ev = JSON.parse(line);
      if (ev.seq <= after) continue;
      after = ev.seq;
      onEvent(line, ev);
    }
  };
  read();
  setInterval(read, 250);
}

function safeReaddir(dir) {
  try {
    return fs.readdirSync(dir);
  } catch {
    return [];
  }
}

// The background is the colour of the image's top-left pixel; a pixel within
// `tolerance` of it on every channel counts as background.
function isBackground(img, i, bg, tolerance) {
  const d = img.data;
  return Math.abs(d[i] - bg[0]) <= tolerance && Math.abs(d[i + 1] - bg[1]) <= tolerance && Math.abs(d[i + 2] - bg[2]) <= tolerance;
}

// Keeps the largest band of rows holding content (the concept, not the small
// number under it), cropped to its content with a little margin.
function trimToContent(img, tolerance) {
  const bg = [img.data[0], img.data[1], img.data[2]];
  const rowInk = [];
  for (let y = 0; y < img.height; y++) {
    let ink = 0;
    for (let x = 0; x < img.width; x++) if (!isBackground(img, (y * img.width + x) * 4, bg, tolerance)) ink++;
    rowInk.push(ink);
  }
  let best = null;
  for (let y = 0; y < img.height; ) {
    if (!rowInk[y]) {
      y++;
      continue;
    }
    let end = y;
    let ink = 0;
    while (end < img.height && rowInk[end]) ink += rowInk[end++];
    if (!best || ink > best.ink) best = { top: y, bottom: end, ink };
    y = end;
  }
  if (!best) return img;
  let left = img.width;
  let right = 0;
  for (let y = best.top; y < best.bottom; y++) {
    for (let x = 0; x < img.width; x++) {
      if (!isBackground(img, (y * img.width + x) * 4, bg, tolerance)) {
        left = Math.min(left, x);
        right = Math.max(right, x + 1);
      }
    }
  }
  const pad = Math.round(Math.max(right - left, best.bottom - best.top) * 0.06);
  const x = Math.max(0, left - pad);
  const y = Math.max(0, best.top - pad);
  return cropPng(img, x, y, Math.min(img.width, right + pad) - x, Math.min(img.height, best.bottom + pad) - y);
}

// Makes the background that touches the edges transparent; enclosed areas of
// the same colour, such as the inside of a ring, stay opaque.
function clearBackground(img, tolerance) {
  const bg = [img.data[0], img.data[1], img.data[2]];
  const seen = new Uint8Array(img.width * img.height);
  const stack = [];
  for (let x = 0; x < img.width; x++) stack.push(x, (img.height - 1) * img.width + x);
  for (let y = 0; y < img.height; y++) stack.push(y * img.width, y * img.width + img.width - 1);
  while (stack.length) {
    const p = stack.pop();
    if (seen[p]) continue;
    seen[p] = 1;
    if (!isBackground(img, p * 4, bg, tolerance)) continue;
    img.data[p * 4 + 3] = 0;
    const x = p % img.width;
    if (x > 0) stack.push(p - 1);
    if (x < img.width - 1) stack.push(p + 1);
    if (p >= img.width) stack.push(p - img.width);
    if (p < img.width * (img.height - 1)) stack.push(p + img.width);
  }
}

async function api(method, route, body) {
  let info;
  try {
    info = JSON.parse(fs.readFileSync(path.join(sessionDir, 'server.json'), 'utf8'));
  } catch {
    fail(`No server has started in ${sessionDir}`);
  }
  const res = await fetch(new URL(route, info.url), {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : {},
    body: body ? JSON.stringify(body) : undefined,
  }).catch(() => fail(`The server at ${info.url} is not answering`));
  const json = await res.json();
  if (!res.ok) fail(json.error || `HTTP ${res.status}`);
  return json;
}

function defaultSession() {
  const cwd = process.cwd();
  const slug = path.basename(cwd).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'root';
  const hash = crypto.createHash('sha256').update(cwd).digest('hex').slice(0, 8);
  return path.join(archiveDir, '.sessions', `${slug}-${hash}`);
}

// The server recorded in server.json, if its process is still alive.
function runningServer() {
  try {
    const info = JSON.parse(fs.readFileSync(path.join(sessionDir, 'server.json'), 'utf8'));
    process.kill(info.pid, 0);
    return info;
  } catch {
    return null;
  }
}

function findApiKey() {
  if (process.env.OPENAI_API_KEY) return process.env.OPENAI_API_KEY.trim();
  for (let dir = process.cwd(); ; dir = path.dirname(dir)) {
    for (const name of ['.env.local', '.env']) {
      const value = readEnvValue(path.join(dir, '.sous', name), 'OPENAI_API_KEY');
      if (value) return value;
    }
    if (path.dirname(dir) === dir) return null;
  }
}

// Reads one KEY=value line from a dotenv file, unquoting the value.
function readEnvValue(file, key) {
  let text;
  try {
    text = fs.readFileSync(file, 'utf8');
  } catch {
    return null;
  }
  for (const line of text.split('\n')) {
    const m = /^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/.exec(line);
    if (!m || m[1] !== key) continue;
    let value = m[2].trim();
    const q = value[0];
    if ((q === '"' || q === "'") && value.lastIndexOf(q) > 0) value = value.slice(1, value.lastIndexOf(q));
    else value = value.replace(/\s+#.*$/, '');
    if (q === '"') value = value.replace(/\\n/g, '\n').replace(/\\(["\\])/g, (_, c) => c);
    return value || null;
  }
  return null;
}

// Where sous keeps its per-user files: SOUS_HOME, or ~/.sous.
function sousHome() {
  const value = process.env.SOUS_HOME?.trim();
  if (!value) return path.join(os.homedir(), '.sous');
  if (value === '~') return os.homedir();
  if (value.startsWith('~/')) return path.join(os.homedir(), value.slice(2));
  return path.resolve(value);
}

function parseArgs(list) {
  const out = {};
  for (let i = 0; i < list.length; i++) {
    const a = list[i];
    if (!a.startsWith('--')) {
      (out._ ??= []).push(a);
      continue;
    }
    const key = a.slice(2);
    const next = list[i + 1];
    const value = next === undefined || next.startsWith('--') ? true : list[++i];
    if (REPEATABLE.has(key)) (out[key] ??= []).push(value);
    else out[key] = value;
  }
  return out;
}

function fail(message) {
  console.error(message);
  process.exit(1);
}
