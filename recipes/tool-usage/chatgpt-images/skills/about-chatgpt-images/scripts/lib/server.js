// The selection server: it generates images, stores each one in the archive
// with its record, serves the selection UI, pushes live state to the browser,
// and appends every event the agent should hear about to events.jsonl in the
// session directory.

import http from 'node:http';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { generateImage } from './openai.js';
import { recordPath, writeRecord, updateRecord } from './record.js';

const UI_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'ui');
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
};

export async function serve(opts) {
  const { sessionDir, archiveDir, apiKey, host, defaults, concurrency } = opts;
  const sessionId = path.basename(sessionDir);
  const trashDir = path.join(sessionDir, 'trash');
  const statePath = path.join(sessionDir, 'state.json');
  const eventsPath = path.join(sessionDir, 'events.jsonl');
  await fsp.mkdir(trashDir, { recursive: true });

  const state = loadState(statePath);
  let seq = countLines(eventsPath);
  const clients = new Set();
  const queue = [];
  let running = 0;

  // Work that was in flight when a previous server stopped cannot resume, and
  // a rejection can no longer be undone once the server that took it is gone.
  for (const set of state.sets) {
    for (const img of set.images) {
      if (img.status === 'pending' || img.status === 'generating') {
        img.status = 'failed';
        img.error = 'Interrupted when the server stopped. Retry to generate it again.';
      }
    }
  }
  purgeTrash();
  save();

  function save() {
    const tmp = `${statePath}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(state, null, 2));
    fs.renameSync(tmp, statePath);
  }

  function changed() {
    save();
    const data = `data: ${JSON.stringify(publicState())}\n\n`;
    for (const res of clients) res.write(data);
  }

  function publicState() {
    return {
      keepAlive: state.keepAlive === true,
      sets: state.sets.map((set) => ({
        ...set,
        images: set.images.map(({ file, ...img }) => ({
          ...img,
          url: file ? `/images/${set.id}/${img.index}?a=${img.attempt}` : null,
        })),
      })),
    };
  }

  function notifyAgent(event, fields) {
    seq += 1;
    const line = { seq, event, ...fields, at: new Date().toISOString() };
    fs.appendFileSync(eventsPath, JSON.stringify(line) + '\n');
  }

  function describe(set, img) {
    return {
      label: `${set.id}.${img.index}`,
      set: set.id,
      image: img.index,
      title: set.title,
      note: img.note ?? null,
      verdict: img.verdict,
      file: img.file,
      record: img.file ? recordPath(img.file) : null,
    };
  }

  function setSummary(set) {
    const pick = (fn) => set.images.filter(fn).map((img) => `${set.id}.${img.index}`);
    return {
      set: set.id,
      title: set.title,
      accepted: pick((i) => i.verdict === 'accepted'),
      stored: pick((i) => i.verdict === 'stored'),
      rejected: pick((i) => i.verdict === 'rejected'),
      undecided: pick((i) => !i.verdict && i.status === 'done'),
      failed: pick((i) => !i.verdict && i.status === 'failed'),
    };
  }

  function findSet(id) {
    const set = state.sets.find((s) => s.id === Number(id));
    if (!set) throw httpError(404, `No set ${id}`);
    return set;
  }

  function findImage(set, index) {
    const img = set.images.find((i) => i.index === Number(index));
    if (!img) throw httpError(404, `No image ${set.id}.${index}`);
    return img;
  }

  function enqueue(set, img) {
    img.status = 'pending';
    img.error = null;
    queue.push([set, img]);
    pump();
  }

  function pump() {
    while (running < concurrency && queue.length) {
      const [set, img] = queue.shift();
      running += 1;
      generate(set, img).finally(() => {
        running -= 1;
        pump();
      });
    }
  }

  async function generate(set, img) {
    img.status = 'generating';
    img.startedAt = Date.now();
    img.finishedAt = null;
    changed();
    try {
      const prompt = img.prompt || set.prompt;
      const out = await generateImage({
        apiKey,
        model: set.model,
        prompt,
        size: set.size,
        quality: set.quality,
        references: set.references,
      });
      img.finishedAt = Date.now();
      img.file = await archivePath(set, img, out.ext);
      await fsp.writeFile(img.file, out.buffer);
      writeRecord(img.file, {
        id: path.relative(archiveDir, img.file).replace(/\.[a-z0-9]+$/i, ''),
        image: path.basename(img.file),
        status: 'undecided',
        title: set.title,
        createdAt: new Date(img.finishedAt).toISOString(),
        request: set.request,
        purpose: set.purpose,
        project: set.project,
        prompt,
        basePrompt: img.prompt && img.prompt !== set.prompt ? set.prompt : undefined,
        variation: img.note || undefined,
        revisedPrompt: out.revisedPrompt || undefined,
        mode: set.mode,
        model: set.model,
        size: set.size,
        quality: set.quality,
        referenceImages: set.references,
        generationSeconds: secs(img),
        usage: out.usage || undefined,
        session: sessionId,
        set: set.id,
        index: img.index,
        attempt: img.attempt,
        refreshOf: set.refreshOf || undefined,
        editOf: set.editOf || undefined,
        comments: [],
        usedIn: [],
      });
      img.status = 'done';
      notifyAgent('image-ready', { ...describe(set, img), seconds: secs(img) });
    } catch (err) {
      img.status = 'failed';
      img.error = err.name === 'TimeoutError' ? 'The request timed out.' : err.message;
      img.finishedAt = Date.now();
      notifyAgent('image-failed', { ...describe(set, img), error: img.error });
    }
    changed();
    if (!set.completedNotified && set.images.every((i) => i.status === 'done' || i.status === 'failed')) {
      set.completedNotified = true;
      notifyAgent('set-generated', setSummary(set));
      save();
    }
  }

  // <archive>/<date>/<time>-<slug>-<set>.<image>[-r<attempt>].<ext>, unique.
  async function archivePath(set, img, ext) {
    const at = new Date(set.createdAt);
    const pad = (n) => String(n).padStart(2, '0');
    const day = `${at.getFullYear()}-${pad(at.getMonth() + 1)}-${pad(at.getDate())}`;
    const time = `${pad(at.getHours())}${pad(at.getMinutes())}${pad(at.getSeconds())}`;
    const slug = set.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 48) || 'image';
    const dir = path.join(archiveDir, day);
    await fsp.mkdir(dir, { recursive: true });
    const stem = `${time}-${slug}-${set.id}.${img.index}${img.attempt > 1 ? `-r${img.attempt}` : ''}`;
    let file = path.join(dir, `${stem}.${ext}`);
    for (let n = 2; fs.existsSync(file); n++) file = path.join(dir, `${stem}-${n}.${ext}`);
    return file;
  }

  function setStatus(img, status) {
    if (img.file && fs.existsSync(recordPath(img.file))) {
      updateRecord(recordPath(img.file), (m) => (m.status = status));
    }
  }

  // A rejected image waits in the session's trash, so a rejection can be
  // undone until its set closes or the server stops.
  function moveFiles(img, toDir) {
    for (const from of [img.file, recordPath(img.file)]) {
      const to = path.join(toDir, path.basename(from));
      if (fs.existsSync(from)) fs.renameSync(from, to);
    }
    img.file = path.join(toDir, path.basename(img.file));
  }

  function purgeTrash(set) {
    const sets = set ? [set] : state.sets;
    for (const s of sets) {
      for (const img of s.images) {
        if (img.verdict === 'rejected' && img.file && path.dirname(img.file) === trashDir) {
          for (const f of [img.file, recordPath(img.file)]) fs.rmSync(f, { force: true });
          img.file = null;
          img.discarded = true;
        }
      }
    }
  }

  function createSet(input, extra = {}) {
    // Variants give each image its own prompt and a short note saying how it
    // differs; without them every image uses the set's prompt. With them, the
    // set's prompt is optional: it heads the set in the picker and is recorded
    // as each image's base prompt, and the first variant stands in for it.
    const variants = Array.isArray(input.variants) && input.variants.length ? input.variants : null;
    const prompt = String(input.prompt ?? variants?.[0]?.prompt ?? '').trim();
    if (!prompt) throw httpError(400, 'A set needs a prompt');
    const count = variants ? Math.min(variants.length, 16) : clampInt(input.count ?? defaults.count, 1, 16);
    const references = (input.references ?? []).map((r) => path.resolve(r));
    if (references.length > 4) throw httpError(400, 'At most 4 reference images are allowed');
    for (const r of references) if (!fs.existsSync(r)) throw httpError(400, `Reference image ${r} does not exist`);
    const set = {
      id: state.nextSet++,
      title: String(input.title ?? '').trim() || prompt.slice(0, 80),
      prompt,
      request: input.request ?? null,
      purpose: input.purpose ?? null,
      project: input.project ?? null,
      references,
      mode: input.mode === 'spread' ? 'spread' : 'single',
      model: input.model || defaults.model,
      size: input.size || defaults.size,
      quality: input.quality || defaults.quality,
      count,
      closed: false,
      refreshOf: extra.refreshOf ?? null,
      editOf: input.editOf ?? null,
      createdAt: Date.now(),
      images: Array.from({ length: count }, (_, i) => ({
        index: i + 1,
        prompt: variants ? String(variants[i].prompt ?? prompt).trim() : null,
        note: variants ? String(variants[i].note ?? '').trim() || null : null,
        status: 'pending',
        attempt: 1,
        verdict: null,
        file: null,
        error: null,
        comments: [],
      })),
    };
    state.sets.push(set);
    for (const img of set.images) enqueue(set, img);
    changed();
    return set;
  }

  function handleAction(body) {
    if (body.action === 'keep-alive') {
      state.keepAlive = body.value === true;
      notifyAgent('keep-alive', activity());
      changed();
      return { ok: true };
    }
    const set = findSet(body.set);
    const img = body.image != null ? findImage(set, body.image) : null;
    // A verdict can carry the text the user had typed in the image's comment
    // box; it is kept as a comment and sent to the agent with the verdict.
    const VERDICTS = ['accept', 'unaccept', 'store', 'unstore', 'reject', 'unreject'];
    let extra = {};
    if (img && VERDICTS.includes(body.action) && String(body.text ?? '').trim()) {
      const edit = body.edit === true;
      const comment = { text: String(body.text).trim(), at: new Date().toISOString(), with: body.action, ...(edit && { editRequest: true }) };
      img.comments.push(comment);
      if (img.file) updateRecord(recordPath(img.file), (m) => m.comments.push(comment));
      extra = { text: comment.text, ...(edit && { editRequest: true, prompt: img.prompt || set.prompt }) };
    }
    const tell = (event) => notifyAgent(event, { ...describe(set, img), ...extra });
    switch (body.action) {
      case 'accept':
      case 'store': {
        need(img, 'done');
        if (img.verdict === 'rejected') throw httpError(409, 'Undo the rejection first');
        img.verdict = body.action === 'accept' ? 'accepted' : 'stored';
        setStatus(img, img.verdict);
        tell(body.action);
        break;
      }
      case 'unaccept':
      case 'unstore':
        need(img, 'done');
        img.verdict = null;
        setStatus(img, 'undecided');
        tell(body.action);
        break;
      case 'reject':
        need(img);
        img.verdict = 'rejected';
        if (img.file) {
          setStatus(img, 'rejected');
          img.archivedAt = img.file;
          moveFiles(img, trashDir);
        }
        tell('reject');
        break;
      case 'unreject':
        need(img);
        if (img.discarded) throw httpError(409, 'That image has already been discarded');
        img.verdict = null;
        if (img.file) {
          moveFiles(img, path.dirname(img.archivedAt));
          setStatus(img, 'undecided');
        }
        tell('unreject');
        break;
      case 'comment': {
        need(img);
        const text = String(body.text ?? '').trim();
        if (!text) throw httpError(400, 'An empty comment was not sent');
        // A comment sent with "Request edit" checked asks the agent for a new
        // set that edits this image, with the image attached as a reference.
        const edit = body.edit === true;
        const comment = { text, at: new Date().toISOString(), ...(edit && { editRequest: true }) };
        img.comments.push(comment);
        if (img.file) updateRecord(recordPath(img.file), (m) => m.comments.push(comment));
        notifyAgent(edit ? 'edit-request' : 'comment', { ...describe(set, img), text, prompt: img.prompt || set.prompt });
        break;
      }
      case 'retry':
        need(img);
        if (img.status !== 'failed') throw httpError(409, 'Only a failed image can be retried');
        img.attempt += 1;
        set.completedNotified = false;
        enqueue(set, img);
        notifyAgent('retry', describe(set, img));
        break;
      case 'refresh': {
        const variants = set.images.some((i) => i.prompt)
          ? set.images.map((i) => ({ prompt: i.prompt || set.prompt, note: i.note }))
          : null;
        const next = createSet({ ...set, variants, editOf: set.editOf }, { refreshOf: set.id });
        notifyAgent('refresh', { set: set.id, title: set.title, newSet: next.id, count: next.count });
        changed();
        return { newSet: next.id };
      }
      case 'close':
        set.closed = true;
        purgeTrash(set);
        notifyAgent('close-set', { ...setSummary(set), auto: body.auto === true, ...activity() });
        break;
      case 'reopen':
        set.closed = false;
        notifyAgent('reopen-set', { set: set.id, title: set.title });
        break;
      default:
        throw httpError(400, `Unknown action ${body.action}`);
    }
    changed();
    return { ok: true };
  }

  // Tells the agent whether the session can end. It may stop the server only
  // when canStop is true: every set closed, nothing generating, and the user
  // has not checked "Keep Alive".
  function activity() {
    const openSets = state.sets.filter((s) => !s.closed).map((s) => s.id);
    const generating = state.sets.flatMap((s) => s.images).filter((i) => i.status === 'pending' || i.status === 'generating').length;
    const allClosed = openSets.length === 0 && generating === 0;
    const keepAlive = state.keepAlive === true;
    return { openSets, generating, allClosed, keepAlive, canStop: allClosed && !keepAlive };
  }

  const server = http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url, 'http://localhost');
      if (req.method === 'GET' && url.pathname === '/api/events') {
        res.writeHead(200, {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          Connection: 'keep-alive',
        });
        res.write(`data: ${JSON.stringify(publicState())}\n\n`);
        clients.add(res);
        const ping = setInterval(() => res.write(': ping\n\n'), 20_000);
        req.on('close', () => {
          clearInterval(ping);
          clients.delete(res);
        });
        return;
      }
      if (req.method === 'GET' && url.pathname === '/api/state') return sendJson(res, 200, { ...publicState(), ...activity() });
      if (req.method === 'POST' && url.pathname === '/api/sets') {
        const set = createSet(await readJson(req));
        notifyAgent('set-added', { set: set.id, title: set.title, count: set.count, mode: set.mode, references: set.references.length });
        return sendJson(res, 200, { set: set.id, count: set.count });
      }
      if (req.method === 'POST' && url.pathname === '/api/action') {
        return sendJson(res, 200, handleAction(await readJson(req)));
      }
      if (req.method === 'POST' && url.pathname === '/api/shutdown') {
        purgeTrash();
        save();
        sendJson(res, 200, { ok: true });
        notifyAgent('server-stopped', {});
        setTimeout(() => process.exit(0), 100);
        return;
      }
      const imageRoute = /^\/images\/(\d+)\/(\d+)$/.exec(url.pathname);
      if (req.method === 'GET' && imageRoute) {
        const img = findImage(findSet(imageRoute[1]), imageRoute[2]);
        if (!img.file) return sendJson(res, 404, { error: 'Not found' });
        return sendFile(res, img.file, 'no-cache');
      }
      if (req.method === 'GET') {
        const name = url.pathname === '/' ? 'index.html' : path.basename(url.pathname);
        return sendFile(res, path.join(UI_DIR, name), 'no-cache');
      }
      sendJson(res, 404, { error: 'Not found' });
    } catch (err) {
      sendJson(res, err.status || 500, { error: err.message });
    }
  });

  const port = await listen(server, host, opts.port);
  const info = { url: `http://${host}:${port}/`, port, host, pid: process.pid, archiveDir, startedAt: new Date().toISOString() };
  fs.writeFileSync(path.join(sessionDir, 'server.json'), JSON.stringify(info, null, 2));
  notifyAgent('server-started', { url: info.url, archiveDir });
  return info;
}

function listen(server, host, port) {
  return new Promise((resolve, reject) => {
    const tryPort = (p, fallback) => {
      server.once('error', (err) => {
        if (err.code === 'EADDRINUSE' && fallback) tryPort(0, false);
        else reject(err);
      });
      server.listen(p, host, () => resolve(server.address().port));
    };
    tryPort(port, port !== 0);
  });
}

function loadState(file) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return { nextSet: 1, sets: [] };
  }
}

function countLines(file) {
  try {
    return fs.readFileSync(file, 'utf8').split('\n').filter(Boolean).length;
  } catch {
    return 0;
  }
}

function need(img, status) {
  if (!img) throw httpError(400, 'This action needs an image');
  if (status && img.status !== status) throw httpError(409, `This action needs an image that is ${status}`);
}

function secs(img) {
  return Math.round((img.finishedAt - img.startedAt) / 1000);
}

function clampInt(v, min, max) {
  const n = Math.round(Number(v));
  if (!Number.isFinite(n)) return min;
  return Math.min(max, Math.max(min, n));
}

function httpError(status, message) {
  return Object.assign(new Error(message), { status });
}

async function readJson(req) {
  let raw = '';
  for await (const chunk of req) raw += chunk;
  try {
    return JSON.parse(raw || '{}');
  } catch {
    throw httpError(400, 'The body was not JSON');
  }
}

function sendJson(res, status, body) {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(body));
}

function sendFile(res, file, cacheControl) {
  fs.readFile(file, (err, data) => {
    if (err) return sendJson(res, 404, { error: 'Not found' });
    res.writeHead(200, {
      'Content-Type': MIME[path.extname(file)] || 'application/octet-stream',
      'Cache-Control': cacheControl,
    });
    res.end(data);
  });
}
