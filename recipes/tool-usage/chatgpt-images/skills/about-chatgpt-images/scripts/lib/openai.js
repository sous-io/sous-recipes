// One call to the OpenAI Images API, returning the image bytes. With reference
// images it calls the edits endpoint, which takes them as input; without, the
// generations endpoint.

import { Buffer } from 'node:buffer';
import fs from 'node:fs/promises';
import path from 'node:path';

const API = `${process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1'}/images`;
const MAX_REFERENCES = 4;
const REF_MIME = { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp' };

export async function generateImage({ apiKey, model, prompt, size, quality, references = [], timeoutMs = 300_000 }) {
  if (references.length > MAX_REFERENCES) throw new Error(`At most ${MAX_REFERENCES} reference images are allowed`);
  const headers = { Authorization: `Bearer ${apiKey}` };
  let url;
  let body;

  if (references.length) {
    url = `${API}/edits`;
    body = new FormData();
    body.append('model', model);
    body.append('prompt', prompt);
    body.append('n', '1');
    if (size) body.append('size', size);
    if (quality) body.append('quality', quality);
    for (const ref of references) {
      const type = REF_MIME[path.extname(ref).toLowerCase()];
      if (!type) throw new Error(`Reference image ${ref} must be a PNG, JPEG or WebP file`);
      body.append('image[]', new Blob([await fs.readFile(ref)], { type }), path.basename(ref));
    }
  } else {
    url = `${API}/generations`;
    headers['Content-Type'] = 'application/json';
    const json = { model, prompt, n: 1 };
    if (size) json.size = size;
    if (quality) json.quality = quality;
    body = JSON.stringify(json);
  }

  const res = await fetch(url, { method: 'POST', headers, body, signal: AbortSignal.timeout(timeoutMs) });
  const json = await res.json().catch(() => null);
  if (!res.ok) {
    throw new Error(json?.error?.message || `OpenAI returned HTTP ${res.status}`);
  }

  const item = json?.data?.[0];
  let buffer;
  if (item?.b64_json) {
    buffer = Buffer.from(item.b64_json, 'base64');
  } else if (item?.url) {
    const img = await fetch(item.url, { signal: AbortSignal.timeout(60_000) });
    if (!img.ok) throw new Error(`Downloading the image failed with HTTP ${img.status}`);
    buffer = Buffer.from(await img.arrayBuffer());
  } else {
    throw new Error('The response held no image');
  }
  return { buffer, ext: sniffExt(buffer), revisedPrompt: item.revised_prompt ?? null, usage: json.usage ?? null };
}

function sniffExt(buf) {
  if (buf[0] === 0xff && buf[1] === 0xd8) return 'jpg';
  if (buf.toString('ascii', 0, 4) === 'RIFF' && buf.toString('ascii', 8, 12) === 'WEBP') return 'webp';
  return 'png';
}
