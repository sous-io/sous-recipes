// The archive record kept beside every stored image: a markdown file of the
// same name whose frontmatter holds the metadata and whose body is written
// from it. Each frontmatter value is one line of JSON, which is valid YAML and
// lets this file read its own records back without a YAML parser.

import fs from 'node:fs';
import path from 'node:path';

const ORDER = [
  'id', 'image', 'status', 'title', 'createdAt', 'updatedAt', 'request', 'purpose', 'project',
  'prompt', 'basePrompt', 'variation', 'revisedPrompt', 'mode', 'model', 'size', 'quality',
  'referenceImages', 'generationSeconds', 'usage', 'session', 'set', 'index', 'attempt',
  'refreshOf', 'editOf', 'comments', 'usedIn', 'notes',
];

export function recordPath(imagePath) {
  return imagePath.replace(/\.[a-z0-9]+$/i, '.md');
}

export function writeRecord(imagePath, meta) {
  meta = { ...meta, updatedAt: new Date().toISOString() };
  const keys = [...ORDER.filter((k) => k in meta), ...Object.keys(meta).filter((k) => !ORDER.includes(k))];
  const front = keys.filter((k) => meta[k] !== undefined).map((k) => `${k}: ${JSON.stringify(meta[k])}`);
  const text = `---\n${front.join('\n')}\n---\n\n${body(meta)}`;
  const file = recordPath(imagePath);
  fs.writeFileSync(`${file}.tmp`, text);
  fs.renameSync(`${file}.tmp`, file);
  return file;
}

export function readRecord(file) {
  const text = fs.readFileSync(file, 'utf8');
  const match = /^---\n([\s\S]*?)\n---\n/.exec(text);
  if (!match) throw new Error(`${file} has no frontmatter`);
  const meta = {};
  for (const line of match[1].split('\n')) {
    const at = line.indexOf(': ');
    if (at > 0) meta[line.slice(0, at)] = JSON.parse(line.slice(at + 2));
  }
  return meta;
}

export function updateRecord(file, change) {
  const meta = readRecord(file);
  change(meta);
  return writeRecord(path.join(path.dirname(file), meta.image), meta);
}

function body(m) {
  const out = [`# ${m.title || m.image}`, ''];
  out.push(`![${m.title || 'image'}](${m.image})`, '');
  out.push(`Status: **${m.status}**. Generated ${m.createdAt} with \`${m.model}\` at ${m.size}.`, '');

  out.push('## Why It Was Generated', '');
  out.push(m.purpose || 'No purpose was recorded.', '');
  if (m.request) out.push(`The user asked for: "${m.request}"`, '');
  if (m.project) out.push(`Requested while working in \`${m.project}\`.`, '');

  out.push('## Prompt', '', '```text', m.prompt, '```', '');
  if (m.variation) out.push(`This image's variation: ${m.variation}.`, '');
  if (m.revisedPrompt && m.revisedPrompt !== m.prompt) out.push('The model revised it to:', '', '```text', m.revisedPrompt, '```', '');
  if (m.referenceImages?.length) out.push('Reference images:', '', ...m.referenceImages.map((r) => `- \`${r}\``), '');

  out.push('## Feedback', '');
  if (m.editOf) out.push(`This image is an edit of \`${m.editOf}\`.`, '');
  if (m.comments?.length) out.push(...m.comments.map((c) => `- ${c.at}${c.editRequest ? ' (edit requested)' : ''}: ${c.text}`), '');
  else out.push('No comments.', '');

  out.push('## Where It Was Used', '');
  if (m.usedIn?.length) out.push(...m.usedIn.map((u) => `- ${u.at}: \`${u.where}\`${u.how ? `, ${u.how}` : ''}`), '');
  else out.push('Not used yet.', '');

  if (m.notes?.length) out.push('## Notes', '', ...m.notes.map((n) => `- ${n.at}: ${n.text}`), '');
  return out.join('\n');
}
