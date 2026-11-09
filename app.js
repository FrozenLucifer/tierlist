// ============================================================================
// Тир-лист объектов — полностью клиентская версия (без сервера)
// Все данные хранятся в IndexedDB браузера.
// ============================================================================

/* -------------------- IndexedDB обёртка -------------------- */
const DB_NAME = 'TierListDB';
const DB_VERSION = 1;
let db = null;

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (e) => {
      const d = e.target.result;
      if (!d.objectStoreNames.contains('items')) {
        d.createObjectStore('items', { keyPath: 'id' });
      }
      if (!d.objectStoreNames.contains('interactions')) {
        d.createObjectStore('interactions', { keyPath: 'id', autoIncrement: true });
      }
      if (!d.objectStoreNames.contains('media')) {
        d.createObjectStore('media', { keyPath: 'id' });
      }
    };
    req.onsuccess = (e) => { db = e.target.result; resolve(db); };
    req.onerror = (e) => reject(e.target.error);
  });
}

function dbGet(storeName, id) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readonly');
    const store = tx.objectStore(storeName);
    const req = store.get(id);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function dbGetAll(storeName) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readonly');
    const store = tx.objectStore(storeName);
    const req = store.getAll();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function dbPut(storeName, value) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    const store = tx.objectStore(storeName);
    const req = store.put(value);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function dbDelete(storeName, id) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    const store = tx.objectStore(storeName);
    const req = store.delete(id);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

function dbClear(storeName) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    const store = tx.objectStore(storeName);
    const req = store.clear();
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

/* -------------------- Bradley–Terry -------------------- */
const INITIAL_RATING = 0.0;

function probability(ratingA, ratingB) {
  const delta = Math.max(-35, Math.min(35, ratingA - ratingB));
  return 1.0 / (1.0 + Math.exp(-delta));
}

function recomputeRatings(items, interactions) {
  const ratings = {};
  const games = {};
  const wins = {};
  for (const it of items) {
    ratings[it.id] = INITIAL_RATING;
    games[it.id] = 0;
    wins[it.id] = 0;
  }
  const winsList = interactions.filter(i => i.decision === 'win');
  for (const inter of winsList) {
    const l = inter.left_id, r = inter.right_id, w = inter.winner_id;
    if (!(l in ratings) || !(r in ratings)) continue;
    const pL = probability(ratings[l], ratings[r]);
    const kL = 0.9 / Math.sqrt(1.0 + 0.15 * games[l]);
    const kR = 0.9 / Math.sqrt(1.0 + 0.15 * games[r]);
    const error = (w === l ? 1.0 : 0.0) - pL;
    ratings[l] += kL * error;
    ratings[r] -= kR * error;
    games[l] += 1;
    games[r] += 1;
    wins[w] += 1;
  }
  for (const it of items) {
    it.rating = ratings[it.id];
    it.games = games[it.id];
    it.wins = wins[it.id];
  }
}

/* -------------------- Состояние -------------------- */
let currentPair = null;
let editingItemId = null;
let unsavedChanges = false;
const $ = (id) => document.getElementById(id);

let items = [];      // все объекты
let interactions = []; // журнал сравнений
let mediaStore = {}; // id -> {id, name, type, dataUrl}

/* -------------------- UI helpers -------------------- */
const message = (text, error = false) => {
  const el = $('message');
  if (el) { el.textContent = text; el.style.color = error ? '#ff9bad' : '#c4b5fd'; }
};

const setSummary = () => {
  const active = items.filter(i => i.active).length;
  const comparisons = interactions.filter(i => i.decision === 'win').length;
  const skips = interactions.filter(i => i.decision === 'skip').length;
  const el = $('summary');
  if (el) $('summary').textContent = `Объектов: ${active} · сравнений: ${comparisons} · пропусков: ${skips}`;
};

/* -------------------- Гипертекст -------------------- */
const ALLOWED_TAGS = /^(a|b|i|em|strong|u|br|p|span)$/;
const ALLOWED_ATTRS = ['href', 'target', 'rel', 'style'];

function sanitizeHtml(html) {
  const div = document.createElement('div');
  div.innerHTML = html;
  function walk(node) {
    if (node.nodeType === Node.ELEMENT_NODE) {
      const tag = node.tagName.toLowerCase();
      if (!ALLOWED_TAGS.test(tag)) {
        const replacement = document.createElement('span');
        replacement.textContent = node.textContent || '';
        if (node.parentNode) node.parentNode.replaceChild(replacement, node);
        return;
      }
      for (let i = node.attributes.length - 1; i >= 0; i--) {
        const attr = node.attributes[i];
        if (!ALLOWED_ATTRS.includes(attr.name)) node.removeAttribute(attr.name);
      }
      if (tag === 'a') {
        const href = node.getAttribute('href') || '';
        if (!href.startsWith('http://') && !href.startsWith('https://') && !href.startsWith('mailto:')) {
          node.removeAttribute('href');
        }
        node.setAttribute('target', '_blank');
        node.setAttribute('rel', 'noopener noreferrer');
      }
      node.childNodes.forEach(walk);
    }
  }
  walk(div);
  return div.innerHTML;
}

function escapeHtml(text) {
  if (text == null) return '';
  const d = document.createElement('div');
  d.textContent = text;
  return d.innerHTML;
}

function mediaHtml(item) {
  if (!item) return '<div class="no-media">без картинки</div>';
  const m = mediaStore[item.media_id];
  if (m && m.dataUrl) {
    return `<img src="${m.dataUrl}" alt="${escapeHtml(item.name)}" class="obj-img" loading="lazy">`;
  }
  if (item.media_count > 0) return '<div class="media-missing">медиа недоступно</div>';
  return '<div class="no-media">без картинки</div>';
}

/* -------------------- Отрисовка -------------------- */
function drawItem(side, item) {
  const mediaEl = $(side + '-media');
  const nameEl = $(side + '-name');
  const descEl = $(side + '-desc');
  const infoEl = $(side + '-info');
  const btn = $(side + '-choice');
  if (!mediaEl || !nameEl || !descEl || !infoEl || !btn) return;
  mediaEl.innerHTML = mediaHtml(item);
  nameEl.textContent = item.name;
  descEl.innerHTML = sanitizeHtml(item.description || '');
  infoEl.textContent = `рейтинг ${item.rating.toFixed(3)} · игр ${item.games}`;
  btn.onclick = () => choose(side === 'left' ? 'left' : 'right');
}

async function loadPair() {
  const active = items.filter(i => i.active);
  if (active.length < 2) {
    currentPair = null;
  } else {
    // Выбор пары: близкий рейтинг + мало наблюдений
    let best = null;
    let bestScore = -1;
    const recent = interactions.slice(-20).map(i => [i.left_id, i.right_id].sort().join('|'));
    for (let a = 0; a < active.length; a++) {
      for (let b = a + 1; b < active.length; b++) {
        const l = active[a], r = active[b];
        const pairKey = [l.id, r.id].sort().join('|');
        const p = probability(l.rating, r.rating);
        const closeness = 4 * p * (1 - p);
        const uncertainty = 1 / Math.sqrt(l.games + 1) + 1 / Math.sqrt(r.games + 1);
        let score = (0.12 + 0.88 * closeness) * uncertainty;
        if (recent.includes(pairKey)) score *= 0.08;
        score *= 0.72 + Math.random() * 0.56;
        if (score > bestScore) { bestScore = score; best = { left: l, right: r }; }
      }
    }
    currentPair = best;
  }

  const comparison = $('comparison');
  const controls = $('controls');
  const empty = $('empty');
  if (comparison) comparison.hidden = !currentPair;
  if (controls) controls.hidden = !currentPair;
  if (empty) empty.hidden = !!currentPair;
  if (currentPair) {
    drawItem('left', currentPair.left);
    drawItem('right', currentPair.right);
    message('');
  }
  setSummary();
}

async function choose(choice) {
  if (!currentPair) return;
  const pair = currentPair;
  currentPair = null;
  $('comparison').hidden = true;

  const winner = choice === 'skip' ? null : (choice === 'left' ? pair.left.id : pair.right.id);
  const inter = {
    id: Date.now(),
    left_id: pair.left.id,
    right_id: pair.right.id,
    winner_id: winner,
    decision: winner ? 'win' : 'skip',
    created_at: new Date().toISOString(),
  };
  interactions.push(inter);
  await dbPut('interactions', inter);
  unsavedChanges = true;

  if (winner) recomputeRatings(items, interactions);
  await saveItems();
  await loadPair();
}

/* -------------------- Объекты -------------------- */
async function loadObjects() {
  const list = $('objects-list');
  if (!list) return;
  const active = items.filter(i => i.active).sort((a, b) => b.rating - a.rating || a.name.localeCompare(b.name));
  const inactive = items.filter(i => !i.active);
  list.replaceChildren(...[...active, ...inactive].map((item) => {
    const card = document.createElement('div');
    card.className = 'object-card' + (item.active ? '' : ' object-missing');
    card.innerHTML = `
      <div class="obj-media-small">${mediaHtml(item)}</div>
      <div class="obj-info">
        <div class="obj-name-edit">${escapeHtml(item.name)}</div>
        <div class="obj-desc-small">${sanitizeHtml(item.description || '')}</div>
        <div class="obj-meta">рейтинг ${item.rating.toFixed(3)} · игр ${item.games} ${!item.active ? '· недоступен' : ''}</div>
      </div>
      <div class="obj-actions">
        <button class="edit-item" data-id="${item.id}" title="Редактировать">✎</button>
        <button class="delete-item" data-id="${item.id}" data-available="${item.active}" title="Удалить">✕</button>
      </div>
    `;
    return card;
  }));
  setSummary();
}

async function saveItems() {
  for (const it of items) await dbPut('items', it);
}

async function addItem(name, description, mediaFile) {
  if (!name || !name.trim()) throw new Error('Введите название.');
  const id = 'item_' + Date.now() + '_' + Math.random().toString(36).slice(2);
  let mediaId = null;
  if (mediaFile) {
    mediaId = 'media_' + Date.now() + '_' + Math.random().toString(36).slice(2);
    const dataUrl = await fileToDataUrl(mediaFile);
    mediaStore[mediaId] = { id: mediaId, name: mediaFile.name, type: mediaFile.type, dataUrl };
    await dbPut('media', mediaStore[mediaId]);
  }
  const item = {
    id,
    name: name.trim(),
    description: description || '',
    media_id: mediaId,
    rating: INITIAL_RATING,
    games: 0,
    wins: 0,
    active: 1,
    created_at: new Date().toISOString(),
  };
  items.push(item);
  await dbPut('items', item);
  unsavedChanges = true;
  await loadObjects();
  await loadPair();
  return id;
}

async function updateItem(id, name, description) {
  const it = items.find(i => i.id === id);
  if (!it) throw new Error('Объект не найден.');
  if (name) it.name = name.trim();
  it.description = description || '';
  await dbPut('items', it);
  unsavedChanges = true;
  await loadObjects();
  await loadPair();
}

async function deleteItem(id) {
  const it = items.find(i => i.id === id);
  if (!it) return;
  if (!confirm(`Удалить объект «${it.name}»? Связанные сравнения тоже исчезнут. Это нельзя отменить.`)) return;
  interactions = interactions.filter(i => i.left_id !== id && i.right_id !== id && i.winner_id !== id);
  await dbClear('interactions');
  for (const inter of interactions) await dbPut('interactions', inter);
  if (it.media_id) {
    delete mediaStore[it.media_id];
    await dbDelete('media', it.media_id);
  }
  items = items.filter(i => i.id !== id);
  await dbDelete('items', id);
  recomputeRatings(items, interactions);
  await saveItems();
  unsavedChanges = true;
  await loadObjects();
  await loadPair();
}

/* -------------------- Файлы -------------------- */
function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.onerror = () => reject(r.error);
    r.readAsDataURL(file);
  });
}

async function exportTierlist(includeComparisons) {
  const exportData = {
    version: 1,
    exported_at: new Date().toISOString(),
    include_comparisons: includeComparisons,
    items: items.map(it => ({
      id: it.id,
      name: it.name,
      description: it.description,
      media_id: it.media_id,
      rating: it.rating,
      games: it.games,
      wins: it.wins,
      active: it.active,
    })),
    interactions: includeComparisons ? interactions : [],
    media: Object.values(mediaStore),
  };

  const zip = new JSZip();
  zip.file('data.json', JSON.stringify(exportData, null, 2));
  for (const m of Object.values(mediaStore)) {
    zip.file('media/' + m.id, m.dataUrl.split(',')[1], { base64: true });
  }
  const blob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'tierlist_export.tierl';
  a.click();
  URL.revokeObjectURL(url);
}

async function importTierlist(file) {
  if (unsavedChanges) {
    const answer = confirm(
      'У вас есть несохранённые изменения. Сохранить текущий тир-лист перед открытием нового файла?\n\n' +
      'Нажмите "ОК" — сохранить и открыть файл.\n' +
      'Нажмите "Отмена" — открыть файл без сохранения (текущие изменения будут потеряны).'
    );
    if (answer) {
      await exportTierlist(true);
    }
    unsavedChanges = false;
  }

  const zip = await JSZip.loadAsync(file);
  const dataJson = await zip.file('data.json').async('string');
  const data = JSON.parse(dataJson);

  if (data.version !== 1) throw new Error('Неподдерживаемая версия файла: ' + data.version);

  // Загружаем медиа
  mediaStore = {};
  for (const name of Object.keys(zip.files)) {
    if (name.startsWith('media/') && !name.endsWith('/')) {
      const content = await zip.file(name).async('base64');
      const m = JSON.parse(await zip.file('data.json').async('string')).media.find(mm => mm.id === name.replace('media/', ''));
      // Проще: перебираем media из exportData
    }
  }
  // media из data
  for (const m of (data.media || [])) {
    mediaStore[m.id] = { id: m.id, name: m.name, type: m.type, dataUrl: 'data:' + m.type + ';base64,' + await zip.file('media/' + m.id).async('base64').then(b => b) };
    await dbPut('media', mediaStore[m.id]);
  }

  // Очистка и загрузка объектов
  items = [];
  interactions = [];
  await dbClear('items');
  await dbClear('interactions');
  await dbClear('media');

  const idMap = {};
  for (const it of data.items) {
    const newId = 'item_' + Date.now() + '_' + Math.random().toString(36).slice(2);
    idMap[it.id] = newId;
    const newItem = {
      id: newId,
      name: it.name,
      description: it.description || '',
      media_id: it.media_id,
      rating: it.rating,
      games: it.games,
      wins: it.wins,
      active: it.active,
      created_at: it.created_at || new Date().toISOString(),
    };
    items.push(newItem);
    await dbPut('items', newItem);
  }

  if (data.include_comparisons && data.interactions) {
    for (const inter of data.interactions) {
      const l = idMap[inter.left_id];
      const r = idMap[inter.right_id];
      const w = inter.winner_id ? idMap[inter.winner_id] : null;
      if (l && r) {
        const ni = { id: Date.now(), left_id: l, right_id: r, winner_id: w, decision: inter.decision, created_at: inter.created_at };
        interactions.push(ni);
        await dbPut('interactions', ni);
      }
    }
    recomputeRatings(items, interactions);
    await saveItems();
  }

  unsavedChanges = true;
  await loadObjects();
  await loadPair();
  message(`Тир-лист открыт. Объектов: ${items.length}, сравнений: ${interactions.filter(i => i.decision === 'win').length}.`);
}

/* -------------------- События -------------------- */
$('upload-images-button').addEventListener('click', () => {
  $('media-files').click();
});
$('media-files').addEventListener('change', async (e) => {
  const files = e.target.files;
  if (!files || files.length === 0) return;
  for (const file of files) {
    try {
      await addItem(file.name.replace(/\.[^/.]+$/, ''), '', file);
    } catch (err) { message('Ошибка загрузки «' + file.name + '»: ' + err.message, true); }
  }
  e.target.value = '';
  message(`Загружено картинок: ${files.length}`);
});

$('import-text-button').addEventListener('click', async () => {
  const ta = $('text-import');
  const lines = ta.value.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0);
  if (lines.length === 0) return message('Нет строк для импорта.', true);
  for (const line of lines) {
    try { await addItem(line, ''); } catch (err) { message('Ошибка «' + line + '»: ' + err.message, true); }
  }
  ta.value = '';
  message(`Создано объектов: ${lines.length}`);
});

$('export-with-button').addEventListener('click', () => exportTierlist(true));
$('export-without-button').addEventListener('click', () => exportTierlist(false));

$('open-tierl-button').addEventListener('click', () => {
  $('tierl-import').click();
});
$('tierl-import').addEventListener('change', async (e) => {
  const file = e.target.files && e.target.files[0];
  if (!file) return;
  try {
    await importTierlist(file);
  } catch (err) { message(err.message, true); }
  e.target.value = '';
});

$('add-object-button').addEventListener('click', () => {
  editingItemId = null;
  $('object-form').reset();
  $('obj-save').textContent = 'Сохранить';
  $('object-dialog').showModal();
});
$('obj-cancel').addEventListener('click', () => $('object-dialog').close());

$('object-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const name = $('obj-name').value.trim();
  const description = $('obj-desc').value.trim();
  if (!name) return message('Введите название.', true);
  try {
    if (editingItemId) {
      await updateItem(editingItemId, name, description);
      message('Объект обновлён.');
    } else {
      const file = $('obj-media').files[0];
      await addItem(name, description, file);
      message('Объект создан.');
    }
    $('object-dialog').close();
    $('obj-media').value = '';
  } catch (err) { message(err.message, true); }
});

// Делегирование в списке объектов
$('objects-list').addEventListener('click', async (e) => {
  const editBtn = e.target.closest('.edit-item');
  const delBtn = e.target.closest('.delete-item');
  if (editBtn) {
    const id = editBtn.dataset.id;
    const it = items.find(i => i.id === id);
    if (!it) return;
    editingItemId = id;
    $('obj-name').value = it.name;
    $('obj-desc').value = it.description || '';
    $('obj-media').value = '';
    $('obj-save').textContent = 'Сохранить изменения';
    $('object-dialog').showModal();
    return;
  }
  if (delBtn) {
    await deleteItem(delBtn.dataset.id);
    return;
  }
});

// Переключатель объектов
$('toggle-objects').addEventListener('click', () => {
  const isHidden = $('objects-section').hidden;
  $('objects-section').hidden = !isHidden;
  $('toggle-objects').textContent = isHidden ? 'Свернуть объекты' : 'Развернуть объекты';
});

$('skip-button').addEventListener('click', () => choose('skip'));
$('undo-button').addEventListener('click', async () => {
  if (interactions.length === 0) return message('Отменять пока нечего.');
  interactions.pop();
  await dbClear('interactions');
  for (const inter of interactions) await dbPut('interactions', inter);
  recomputeRatings(items, interactions);
  await saveItems();
  unsavedChanges = true;
  message('Последнее действие отменено.');
  await loadPair();
  await loadObjects();
});
$('ranking-button').addEventListener('click', async () => {
  const data = items.filter(i => i.active).sort((a, b) => b.rating - a.rating || a.name.localeCompare(b.name));
  let rank = 0;
  const tbody = $('ranking-body');
  tbody.replaceChildren(...data.map((it) => {
    rank++;
    const row = document.createElement('tr');
    row.innerHTML = `
      <td>${rank}</td>
      <td>${escapeHtml(it.name)}</td>
      <td>${it.media_id ? `<img src="${mediaStore[it.media_id].dataUrl}" alt="" class="rank-img">` : '—'}</td>
      <td>${sanitizeHtml(it.description || '') || '<span class="hint">—</span>'}</td>
      <td>${it.rating.toFixed(3)}</td>
      <td>${it.wins} / ${it.games}</td>
      <td>${(1 / Math.sqrt(it.games + 1)).toFixed(3)}</td>
      <td><button class="danger delete-item" onclick="deleteItem('${it.id}')">Удалить</button></td>
    `;
    return row;
  }));
  $('ranking').hidden = false;
});
$('close-ranking').addEventListener('click', () => { $('ranking').hidden = true; });
$('reset-button').addEventListener('click', async () => {
  if (!confirm('Сбросить всю историю сравнений? Это нельзя отменить.')) return;
  interactions = [];
  await dbClear('interactions');
  recomputeRatings(items, interactions);
  await saveItems();
  unsavedChanges = true;
  $('ranking').hidden = true;
  message('История сравнений сброшена.');
  await loadPair();
  await loadObjects();
});

document.addEventListener('keydown', (e) => {
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
  if (e.key === 'ArrowLeft') choose('left');
  if (e.key === 'ArrowRight') choose('right');
  if (e.code === 'Space') { e.preventDefault(); choose('skip'); }
  if (e.key.toLowerCase() === 'z') $('undo-button').click();
});

/* -------------------- Инициализация -------------------- */
async function init() {
  await openDB();
  items = await dbGetAll('items');
  interactions = await dbGetAll('interactions');
  const mediaList = await dbGetAll('media');
  for (const m of mediaList) mediaStore[m.id] = m;
  recomputeRatings(items, interactions);
  await loadObjects();
  await loadPair();
}

init().catch(err => { console.error(err); message('Ошибка инициализации: ' + err.message, true); });
