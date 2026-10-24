// The selection UI. The server pushes the whole state on every change; this
// file keeps one DOM node per set and per image and updates them in place, so
// a comment being typed is never lost to a re-render.

const svg = (body) => `<svg viewBox="0 0 24 24" aria-hidden="true">${body}</svg>`;
const ICON = {
  refresh: svg('<path d="M20 11a8 8 0 1 0-2.3 5.7"/><path d="M20 4v7h-7"/>'),
  close: svg('<path d="M6 6l12 12M18 6L6 18"/>'),
  check: svg('<path d="M5 12.5l4.5 4.5L19 7.5"/>'),
  reject: svg('<path d="M7 7l10 10M17 7L7 17"/>'),
  store: svg('<path d="M4 7h16v12a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1z"/><path d="M3 4h18v3H3zM10 11h4"/>'),
  send: svg('<path d="M4 12l16-8-6 16-2.5-6.5z"/>'),
  retry: svg('<path d="M4 12a8 8 0 0 1 13.7-5.7L20 8.5"/><path d="M20 3.5v5h-5"/><path d="M20 12a8 8 0 0 1-13.7 5.7L4 15.5"/><path d="M4 20.5v-5h5"/>'),
  alert: svg('<circle cx="12" cy="12" r="9"/><path d="M12 7.5v5.5M12 16.5v.01"/>'),
  edit: svg('<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="M13.5 6.5l4 4"/>'),
  expand: svg('<path d="M8 3H3v5M16 3h5v5M8 21H3v-5M16 21h5v-5"/>'),
};

const $ = (sel, root = document) => root.querySelector(sel);
const setsEl = $('#sets');
const closeAccepted = $('#close-accepted');
closeAccepted.checked = localStorage.getItem('closeAccepted') === '1';
const setViews = new Map();
let firstRender = true;

function h(tag, className, html) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (html != null) node.innerHTML = html;
  return node;
}

async function act(body) {
  const res = await fetch('/api/action', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error || `The server answered ${res.status}`);
  return json;
}

// ---------------------------------------------------------------- rendering

function render(state) {
  keepAlive.checked = state.keepAlive;
  $('#empty').hidden = state.sets.length > 0;
  renderStats(state);
  for (const set of state.sets) {
    let view = setViews.get(set.id);
    if (!view) {
      view = createSetView(set);
      setViews.set(set.id, view);
      setsEl.append(view.root);
      if (!firstRender) announceNewSet(view.root);
    }
    updateSetView(view, set);
  }
  firstRender = false;
  lastState = state;
  autoClose();
}

// A closed image is one the user no longer needs to look at: rejected,
// stored, or accepted while "Close Accepted Images" is checked. Closing says
// nothing about the user's intent; the verdicts and comments do. A set closes
// itself once every image in it is closed; one still generating, failed or
// undecided keeps it open.
let lastState = null;
const closing = new Set();
function autoClose() {
  if (!lastState) return;
  for (const set of lastState.sets) {
    if (set.closed || closing.has(set.id)) continue;
    const allClosed = set.images.every(
      (i) => i.verdict === 'rejected' || i.verdict === 'stored' || (i.verdict === 'accepted' && closeAccepted.checked),
    );
    if (!allClosed) continue;
    closing.add(set.id);
    act({ action: 'close', set: set.id, auto: true })
      .then(() => toast(`Set ${set.id} closed: every image in it is closed.`))
      .catch((err) => toast(err.message, 'error'))
      .finally(() => closing.delete(set.id));
  }
}

function renderStats(state) {
  const all = state.sets.flatMap((s) => s.images);
  const busy = all.filter((i) => i.status === 'pending' || i.status === 'generating').length;
  const accepted = all.filter((i) => i.verdict === 'accepted').length;
  const parts = [`${state.sets.length} ${state.sets.length === 1 ? 'set' : 'sets'}`, `${accepted} accepted`];
  if (busy) parts.push(`<span class="busy">${busy} generating</span>`);
  $('#stats').innerHTML = parts.join('<span class="sep"></span>');
}

function createSetView(set) {
  const root = h('section', set.mode === 'spread' ? 'set set-spread' : 'set');
  root.innerHTML = `
    <div class="set-head">
      <div class="set-meta">
        <div class="set-line">
          <span class="set-num">Set ${set.id}</span>
          ${set.mode === 'spread' ? '<span class="tag tag-spread">spread</span>' : ''}
          ${set.refreshOf ? `<span class="tag">refresh of Set ${set.refreshOf}</span>` : ''}
          ${set.editOf ? `<span class="tag tag-edit">edit of ${escapeHtml(set.editOf)}</span>` : ''}
          <span class="set-progress"></span>
        </div>
        <h3 class="set-title"></h3>
        <p class="set-prompt" title="Click to show the whole prompt"></p>
      </div>
      <div class="set-actions">
        <button class="icon-btn refresh" title="Generate this set again, as a new set">${ICON.refresh}</button>
        <button class="icon-btn close" title="Close this set">${ICON.close}</button>
      </div>
    </div>
    <div class="grid"></div>
    <div class="closed-bar">
      <span class="closed-summary"></span>
      <button class="text-btn reopen">Reopen</button>
    </div>`;
  const view = { root, tiles: new Map() };
  $('.set-title', root).textContent = set.title;
  const prompt = $('.set-prompt', root);
  prompt.textContent = set.prompt;
  prompt.addEventListener('click', () => prompt.classList.toggle('open'));

  $('.refresh', root).addEventListener('click', async (e) => {
    const btn = e.currentTarget;
    btn.classList.add('spin');
    try {
      const out = await act({ action: 'refresh', set: set.id });
      toast(`Set ${out.newSet} is generating below.`);
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setTimeout(() => btn.classList.remove('spin'), 600);
    }
  });
  $('.close', root).addEventListener('click', () => act({ action: 'close', set: set.id }).catch((err) => toast(err.message, 'error')));
  $('.reopen', root).addEventListener('click', () => act({ action: 'reopen', set: set.id }).catch((err) => toast(err.message, 'error')));
  return view;
}

function updateSetView(view, set) {
  const { root } = view;
  root.classList.toggle('closed', set.closed);

  const done = set.images.filter((i) => i.status === 'done').length;
  const failed = set.images.filter((i) => i.status === 'failed').length;
  const progress = $('.set-progress', root);
  progress.textContent = done + failed < set.count ? `${done} of ${set.count} ready` : `${set.count} generated${failed ? `, ${failed} failed` : ''}`;
  progress.classList.toggle('working', done + failed < set.count);

  const accepted = set.images.filter((i) => i.verdict === 'accepted').length;
  const rejected = set.images.filter((i) => i.verdict === 'rejected').length;
  const stored = set.images.filter((i) => i.verdict === "stored").length;
  $('.closed-summary', root).innerHTML = `<strong>Set ${set.id}</strong> closed &middot; ${accepted} accepted &middot; ${stored} stored &middot; ${rejected} rejected`;

  const grid = $('.grid', root);
  for (const img of set.images) {
    let tile = view.tiles.get(img.index);
    if (img.verdict === 'rejected') {
      if (tile && !tile.root.classList.contains('leaving')) {
        tile.root.classList.add('leaving');
        setTimeout(() => tile.root.remove(), 260);
        view.tiles.delete(img.index);
      }
      continue;
    }
    if (!tile) {
      tile = createTile(set, img);
      view.tiles.set(img.index, tile);
      const after = [...view.tiles.entries()].filter(([i]) => i < img.index).sort((a, b) => b[0] - a[0])[0];
      if (after) after[1].root.after(tile.root);
      else grid.prepend(tile.root);
    }
    updateTile(tile, set, img);
  }
}

function createTile(set, img) {
  const root = h('article', 'tile');
  root.innerHTML = `
    <div class="frame-wrap">
      <div class="frame"></div>
      <span class="tile-label">#${img.index}</span>
      <span class="tile-status"></span>
    </div>
    <div class="tile-bar">
      <div class="verdicts">
        <button class="v-btn accept" title="Accept: this is what I want">${ICON.check}<span>Accept</span></button>
        <button class="v-btn store" title="Store: not what I'm after, but keep it anyway">${ICON.store}<span>Store</span></button>
        <button class="v-btn reject" title="Reject: discard this image">${ICON.reject}<span>Reject</span></button>
      </div>
    </div>
    <p class="tile-note"></p>
    <ul class="comments"></ul>
    <form class="comment-box">
      <div class="comment-row">
        <textarea rows="1" placeholder="Comment on #${img.index}..."></textarea>
        <button type="submit" class="send" title="Send the comment (Enter)"><span class="icon-send">${ICON.send}</span><span class="icon-edit">${ICON.edit}</span><span class="sent-label">Sent</span></button>
      </div>
      <label class="edit-toggle"><input type="checkbox"><span>Request edit</span></label>
    </form>`;
  const tile = { root, key: null, commentCount: -1 };
  const dims = /^(\d+)x(\d+)$/.exec(set.size || '');
  if (dims) $('.frame', root).style.aspectRatio = `${dims[1]} / ${dims[2]}`;

  // Text left in the comment box goes along with a verdict click.
  const pending = () => {
    const text = $('textarea', root).value.trim();
    return text ? { text, edit: $('.edit-toggle input', root).checked } : {};
  };
  const sentWithVerdict = (sent) => {
    if (!sent.text) return;
    const form = $('.comment-box', root);
    $('.sent-label', form).textContent = 'Sent';
    form.classList.add('sent');
    setTimeout(() => {
      $('textarea', form).value = '';
      form.classList.remove('sent');
    }, 1100);
  };
  for (const [cls, on, off] of [['accept', 'accept', 'unaccept'], ['store', 'store', 'unstore']]) {
    $(`.${cls}`, root).addEventListener('click', (e) => {
      const active = e.currentTarget.classList.contains('active');
      const sent = pending();
      act({ action: active ? off : on, set: set.id, image: img.index, ...sent })
        .then(() => {
          sentWithVerdict(sent);
          if (active) return;
          if (on === 'store') {
            toast(`Stored ${set.id}.${img.index} and closed it.`, 'info', {
              label: 'Undo',
              run: () => act({ action: 'unstore', set: set.id, image: img.index }),
            });
          } else if (closeAccepted.checked) {
            toast(`Accepted ${set.id}.${img.index} and closed it.`);
          }
        })
        .catch((err) => toast(err.message, 'error'));
    });
  }
  $('.reject', root).addEventListener('click', async () => {
    try {
      const sent = pending();
      await act({ action: 'reject', set: set.id, image: img.index, ...sent });
      sentWithVerdict(sent);
      toast(`Rejected ${set.id}.${img.index}.`, 'info', {
        label: 'Undo',
        run: () => act({ action: 'unreject', set: set.id, image: img.index }),
      });
    } catch (err) {
      toast(err.message, 'error');
    }
  });

  const form = $('.comment-box', root);
  const box = $('textarea', form);
  const editBox = $('.edit-toggle input', form);
  editBox.addEventListener('change', () => {
    form.classList.toggle('edit-mode', editBox.checked);
    box.placeholder = editBox.checked ? `Describe the edit to make to #${img.index}...` : `Comment on #${img.index}...`;
    $('.send', form).title = editBox.checked ? 'Request this edit as a new set (Enter)' : 'Send the comment (Enter)';
  });
  const autosize = () => {
    box.style.height = 'auto';
    box.style.height = `${Math.min(box.scrollHeight, 160)}px`;
  };
  box.addEventListener('input', autosize);
  box.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) {
      e.preventDefault();
      form.requestSubmit();
    }
  });
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (form.classList.contains('sending') || form.classList.contains('sent')) return;
    const text = box.value.trim();
    if (!text) return shake(form);
    form.classList.add('sending');
    box.readOnly = true;
    try {
      const edit = editBox.checked;
      await act({ action: 'comment', set: set.id, image: img.index, text, edit });
      $('.sent-label', form).textContent = edit ? 'Requested' : 'Sent';
      if (edit) toast(`Edit of ${set.id}.${img.index} requested. The agent will add it as a new set.`);
      form.classList.replace('sending', 'sent');
      setTimeout(() => {
        box.value = '';
        box.readOnly = false;
        form.classList.remove('sent');
        autosize();
      }, 1100);
    } catch (err) {
      form.classList.remove('sending');
      box.readOnly = false;
      shake(form);
      toast(`The comment was not sent: ${err.message}`, 'error');
    }
  });
  return tile;
}

function updateTile(tile, set, img) {
  const { root } = tile;
  root.dataset.status = img.status;
  root.classList.toggle('accepted', img.verdict === 'accepted');
  root.classList.toggle('stored', img.verdict === 'stored');
  for (const [cls, verdict, idle, done] of [['accept', 'accepted', 'Accept', 'Accepted'], ['store', 'stored', 'Store', 'Stored']]) {
    const btn = $(`.${cls}`, root);
    btn.classList.toggle('active', img.verdict === verdict);
    $('span', btn).textContent = img.verdict === verdict ? done : idle;
    btn.disabled = img.status !== 'done';
  }
  $('.reject', root).disabled = img.status !== 'done' && img.status !== 'failed';

  const note = $('.tile-note', root);
  note.textContent = img.note || '';
  note.title = img.prompt || '';

  const status = $('.tile-status', root);
  status.textContent = img.attempt > 1 && img.status !== 'done' ? `attempt ${img.attempt}` : '';

  const key = `${img.status}|${img.attempt}|${img.file}`;
  if (tile.key !== key) {
    tile.key = key;
    $('.frame', root).replaceChildren(frameContent(set, img));
  }

  if (tile.commentCount !== img.comments.length) {
    tile.commentCount = img.comments.length;
    const list = $('.comments', root);
    list.replaceChildren(
      ...img.comments.map((c) => {
        const li = h('li');
        li.textContent = c.text;
        li.title = new Date(c.at).toLocaleString();
        return li;
      }),
    );
  }
}

function frameContent(set, img) {
  if (img.status === 'done') {
    const wrap = h('div', 'shot');
    const pic = new Image();
    pic.src = img.url;
    pic.alt = `${set.title}, image ${img.index}`;
    pic.decoding = 'async';
    pic.addEventListener('load', () => wrap.classList.add('loaded'));
    wrap.append(pic, h('button', 'zoom', ICON.expand));
    wrap.addEventListener('click', () => openLightbox(img.url, `${set.id}.${img.index} · ${set.title}`));
    return wrap;
  }
  if (img.status === 'failed') {
    const wrap = h('div', 'fail');
    wrap.innerHTML = `${ICON.alert}<p class="fail-title">Generation failed</p><p class="fail-msg"></p><button class="retry">${ICON.retry}<span>Retry</span></button>`;
    $('.fail-msg', wrap).textContent = img.error || 'Unknown error';
    $('.retry', wrap).addEventListener('click', (e) => {
      e.currentTarget.disabled = true;
      act({ action: 'retry', set: set.id, image: img.index }).catch((err) => {
        e.currentTarget.disabled = false;
        toast(err.message, 'error');
      });
    });
    return wrap;
  }
  const wrap = h('div', 'placeholder');
  const label = img.status === 'pending' ? 'Queued' : 'Generating';
  wrap.innerHTML = `<div class="shimmer"></div><div class="ph-body"><span class="spinner"></span><span class="ph-label">${label}</span><span class="elapsed"></span></div>`;
  if (img.startedAt && img.status === 'generating') $('.elapsed', wrap).dataset.start = img.startedAt;
  return wrap;
}

function escapeHtml(text) {
  return String(text).replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
}

function tickElapsed() {
  for (const node of document.querySelectorAll('.elapsed[data-start]')) {
    const s = Math.max(0, Math.floor((Date.now() - Number(node.dataset.start)) / 1000));
    node.textContent = `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  }
}
setInterval(tickElapsed, 1000);

// ---------------------------------------------------------------- extras

function announceNewSet(node) {
  const rect = node.getBoundingClientRect();
  if (rect.top < window.innerHeight) return;
  const pill = $('#new-below');
  pill.hidden = false;
  pill.onclick = () => {
    node.scrollIntoView({ behavior: 'smooth', block: 'start' });
    pill.hidden = true;
  };
  const seen = new IntersectionObserver(([entry]) => {
    if (entry.isIntersecting) {
      pill.hidden = true;
      seen.disconnect();
    }
  });
  seen.observe(node);
}

function toast(message, kind = 'info', action) {
  const node = h('div', `toast toast-${kind}`);
  const text = h('span');
  text.textContent = message;
  node.append(text);
  if (action) {
    const btn = h('button', 'toast-action');
    btn.textContent = action.label;
    btn.addEventListener('click', () => {
      action.run().catch((err) => toast(err.message, 'error'));
      dismiss();
    });
    node.append(btn);
  }
  $('#toasts').append(node);
  const dismiss = () => {
    node.classList.add('out');
    setTimeout(() => node.remove(), 250);
  };
  setTimeout(dismiss, action ? 6000 : 3500);
}

function shake(node) {
  node.classList.remove('shake');
  void node.offsetWidth;
  node.classList.add('shake');
}

function openLightbox(src, caption) {
  const box = $('#lightbox');
  $('img', box).src = src;
  $('.lightbox-caption', box).textContent = caption;
  box.hidden = false;
}
$('#lightbox').addEventListener('click', () => ($('#lightbox').hidden = true));
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') $('#lightbox').hidden = true;
});

// "Close Accepted Images" hides every accepted image, including ones accepted
// before it was checked. It is a view preference, kept in this browser only.
document.body.classList.toggle('close-accepted', closeAccepted.checked);
closeAccepted.addEventListener('change', () => {
  localStorage.setItem('closeAccepted', closeAccepted.checked ? '1' : '0');
  document.body.classList.toggle('close-accepted', closeAccepted.checked);
  autoClose();
});

// "Keep Alive" lives on the server, because it tells the agent not to stop
// the picker when every set is closed.
const keepAlive = $('#keep-alive');
keepAlive.addEventListener('change', () => {
  act({ action: 'keep-alive', value: keepAlive.checked }).catch((err) => {
    keepAlive.checked = !keepAlive.checked;
    toast(err.message, 'error');
  });
});

// ---------------------------------------------------------------- live link

function setLive(ok) {
  const live = $('#live');
  live.classList.toggle('ok', ok);
  $('.label', live).textContent = ok ? 'Live' : 'Reconnecting';
}

const events = new EventSource('/api/events');
events.addEventListener('open', () => setLive(true));
events.addEventListener('error', () => setLive(false));
events.addEventListener('message', (e) => render(JSON.parse(e.data)));
