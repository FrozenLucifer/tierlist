// ============================================================================
// Рейтинг сравнений — полностью клиентская версия (без сервера)
// Все данные хранятся в IndexedDB браузера.
// ============================================================================

/* -------------------- Язык / переводы -------------------- */
const LANGUAGES = { ru: '🇷🇺', en: '🇬🇧' };
let lang = 'ru';
try { const saved = localStorage.getItem('cr_lang'); if (saved && LANGUAGES[saved]) lang = saved; } catch (e) {}
const T = {
  ru: {
    appTitle: 'Рейтинг сравнений',
    summaryEmpty: 'Добавьте объекты, чтобы начать сравнивать.',
    summary: 'Объектов: {active} · сравнений: {comparisons} · пропусков: {skips}',
    tabCompare: 'Сравнение',
    tabRanking: 'Рейтинг',
    tabList: 'Список',
    switchLang: 'Язык',
    langRu: 'Русский',
    langEn: 'English',
    versus: 'или',
    selectLeft: 'Выбрать левый объект',
    selectRight: 'Выбрать правый объект',
    pinTooltip: 'Зафиксировать',
    unpinTooltip: 'Снять фиксацию',
    orChooseColor: 'или выберите свой цвет',
    langEn: 'English',
    emptyCompareTitle: 'Нужно хотя бы два объекта',
    emptyCompareText: 'Добавьте объекты во вкладке <b>Список</b>, затем вернитесь сюда для сравнения.',
    skip: 'Пропустить <kbd>Пробел</kbd>',
    undo: '↶ Отменить',
    rankingTitle: 'Рейтинг',
    rankingUncertainty: '«Неопределённость» уменьшается с числом сравнений.',
    thRank: '#',
    thObject: 'Объект',
    thImage: 'Картинка',
    thDescription: 'Описание',
    thRating: 'Рейтинг',
    thWinsComparisons: 'Победы / сравнения',
    thUncertainty: 'Неопределённость',
    resetAll: 'Сбросить все сравнения',
    addObjects: 'Добавить объекты',
    subTabTable: 'Таблица',
    subTabTierlist: 'Тир-лист',
    addTier: '+ Тир',
    removeTier: '- Удалить тир',
    tierName: 'Тир {n}',
    boundary: 'Граница',
    emptyTier: 'Пусто',
    minRating: 'Мин рейтинг',
    maxRating: 'Макс рейтинг',
    editTier: 'Редактировать тир',
    resetTiers: 'Сброс тиров',
    enterTierName: 'Введите название тира',
    expandTier: 'Развернуть',
    collapseTier: 'Свернуть',
    ratingLabel: 'Рейтинг',
    uploadImages: 'Загрузить картинки',
    hintImages: 'Для каждой картинки создастся отдельный объект с её именем.',
    importTextLabel: 'Импорт из текста (каждая строка — отдельный объект)',
    textImportPlaceholder: 'Название объекта 1\nНазвание объекта 2\nНазвание объекта 3',
    importTextBtn: 'Импортировать строки',
    hintEmptyLines: 'Пустые строки пропускаются.',
    addManual: '+ Добавить объект вручную',
    saveLoad: 'Сохранить / загрузить рейтинг',
    exportLabel: 'Экспорт',
    exportWith: 'Сохранить с сравнениями (.tierl)',
    exportWithout: 'Сохранить без сравнений (.tierl)',
    hintExport: 'Сравнения = рейтинги, победы, история выборов.',
    importLabel: 'Импорт',
    openTierl: 'Открыть файл .tierl',
    hintImport: 'При открытии текущий рейтинг заменяется.',
    objectsTitle: 'Объекты',
    objectsHint: 'Каждый объект имеет название, описание (с гиперссылками) и опциональную картинку. Объекты без картинки отображаются как текстовые карточки.',
    deleteAll: 'Удалить все объекты',
    confirmDeleteAll: 'Удалить все объекты и всю историю сравнений? Это нельзя отменить.',
    dialogNameLabel: 'Название <span class="req">*</span>',
    dialogDescLabel: 'Описание (поддерживает гиперссылки)',
    dialogDescPlaceholder: 'Описание объекта…',
    dialogMediaLabel: 'Картинка (опционально)',
    dialogMediaHint: 'Можно загрузить картинку или оставить пустым — тогда объект будет текстовым.',
    dialogCancel: 'Отмена',
    dialogSave: 'Сохранить',
    dialogSaveChanges: 'Сохранить изменения',
    saveConfirmTitle: 'Есть несохранённые изменения. Что сделать?',
    saveConfirmSave: 'Сохранить текущий рейтинг',
    saveConfirmDontSave: 'Не сохранять',
    saveConfirmCancel: 'Отмена',
    footerKeys: 'Клавиши: <kbd>←</kbd> левая, <kbd>→</kbd> правая, <kbd>Пробел</kbd> пропуск, <kbd>Z</kbd> отмена. Данные хранятся в браузере.',
    metaRating: 'рейтинг',
    metaComparisons: 'сравнений',
    metaUnavailable: 'недоступен',
    noImage: 'без картинки',
    noName: 'без названия',
    editTitle: 'Редактировать',
    deleteTitle: 'Удалить',
    pin: 'Зафиксировать',
    unpin: 'Снять фиксацию',
    pinnedOn: 'Объект зафиксирован — он будет всегда слева и сравниваться пока есть противники.',
    pinnedOff: 'Фиксация снята.',
    resetComparisons: 'Сбросить сравнения объекта',
    confirmResetComparisons: 'Удалить все сравнения объекта «{name}»? Рейтинг будет пересчитан.',
    confirmDeleteItem: 'Удалить объект «{name}»? Связанные сравнения тоже исчезнут. Это нельзя отменить.',
    msgObjectCreated: 'Объект создан.',
    msgObjectUpdated: 'Объект обновлён.',
    msgDeleted: 'Объект удалён.',
    msgDeletedAll: 'Все объекты удалены.',
    msgUndo: 'Последнее действие отменено.',
    msgReset: 'История сравнений сброшена.',
    msgSaved: 'Рейтинг сохранён.',
    msgSavedDownloaded: 'Рейтинг сохранён (скачан в папку загрузок).',
    msgSavedCancelled: 'Сохранение отменено.',
    msgLoaded: 'Рейтинг открыт. Объектов: {n}, сравнений: {w}, пропусков: {s}.',
    msgImported: 'Создано объектов: {n}.',
    msgUploaded: 'Загружено картинок: {n}.',
    msgNothingToUndo: 'Отменять пока нечего.',
    msgEnterName: 'Введите название.',
    msgItemNotFound: 'Объект не найден.',
    msgNeedAtLeastOneTier: 'Нужно оставить хотя бы один тир.',
    errUnsupportedVersion: 'Неподдерживаемая версия файла: {v}.'
  },
  en: {
    appTitle: 'Comparison Rating',
    summaryEmpty: 'Add objects to start comparing.',
    summary: 'Objects: {active} · comparisons: {comparisons} · skips: {skips}',
    tabCompare: 'Compare',
    tabRanking: 'Rating',
    tabList: 'List',
    switchLang: 'Language',
    langRu: 'Русский',
    langEn: 'English',
    versus: 'vs',
    selectLeft: 'Select left object',
    selectRight: 'Select right object',
    pinTooltip: 'Pin',
    unpinTooltip: 'Unpin',
    orChooseColor: 'or choose your own color',
    emptyCompareTitle: 'At least two objects needed',
    emptyCompareText: 'Add objects in the <b>List</b> tab, then return here to compare.',
    skip: 'Skip <kbd>Space</kbd>',
    undo: '↶ Undo',
    rankingTitle: 'Rating',
    rankingUncertainty: 'Uncertainty decreases with the number of comparisons.',
    thRank: '#',
    thObject: 'Object',
    thImage: 'Image',
    thDescription: 'Description',
    thRating: 'Rating',
    thWinsComparisons: 'Wins / comparisons',
    thUncertainty: 'Uncertainty',
    resetAll: 'Reset all comparisons',
    addObjects: 'Add objects',
    subTabTable: 'Table',
    subTabTierlist: 'Tier List',
    addTier: '+ Tier',
    removeTier: '- Remove tier',
    tierName: 'Tier {n}',
    boundary: 'Boundary',
    emptyTier: 'Empty',
    minRating: 'Min rating',
    maxRating: 'Max rating',
    editTier: 'Edit tier',
    resetTiers: 'Reset tiers',
    enterTierName: 'Enter tier name',
    expandTier: 'Expand',
    collapseTier: 'Collapse',
    ratingLabel: 'Rating',
    uploadImages: 'Upload images',
    hintImages: 'A separate object is created for each image, using its name.',
    importTextLabel: 'Import from text (each line is a separate object)',
    textImportPlaceholder: 'Object name 1\nObject name 2\nObject name 3',
    importTextBtn: 'Import lines',
    hintEmptyLines: 'Empty lines are skipped.',
    addManual: '+ Add object manually',
    saveLoad: 'Save / load rating',
    exportLabel: 'Export',
    exportWith: 'Save with comparisons (.tierl)',
    exportWithout: 'Save without comparisons (.tierl)',
    hintExport: 'Comparisons = ratings, wins, choice history.',
    importLabel: 'Import',
    openTierl: 'Open .tierl file',
    hintImport: 'Opening replaces the current rating.',
    objectsTitle: 'Objects',
    objectsHint: 'Each object has a name, description (with hyperlinks) and an optional image. Objects without an image are shown as text cards.',
    deleteAll: 'Delete all objects',
    confirmDeleteAll: 'Delete all objects and the entire comparison history? This cannot be undone.',
    dialogNameLabel: 'Name <span class="req">*</span>',
    dialogDescLabel: 'Description (supports hyperlinks)',
    dialogDescPlaceholder: 'Object description…',
    dialogMediaLabel: 'Image (optional)',
    dialogMediaHint: 'You can upload an image or leave it empty — then the object will be text-only.',
    dialogCancel: 'Cancel',
    dialogSave: 'Save',
    dialogSaveChanges: 'Save changes',
    saveConfirmTitle: 'There are unsaved changes. What to do?',
    saveConfirmSave: 'Save current rating',
    saveConfirmDontSave: "Don't save",
    saveConfirmCancel: 'Cancel',
    footerKeys: 'Keys: <kbd>←</kbd> left, <kbd>→</kbd> right, <kbd>Space</kbd> skip, <kbd>Z</kbd> undo. Data stored in browser.',
    metaRating: 'rating',
    metaComparisons: 'comparisons',
    metaUnavailable: 'unavailable',
    noImage: 'no image',
    noName: 'no name',
    editTitle: 'Edit',
    deleteTitle: 'Delete',
    pin: 'Pin',
    unpin: 'Unpin',
    pinnedOn: 'Object pinned — it will always be on the left and compared until no opponents remain.',
    pinnedOff: 'Pin removed.',
    resetComparisons: 'Reset object comparisons',
    confirmResetComparisons: 'Delete all comparisons for object "{name}"? Rating will be recalculated.',
    confirmDeleteItem: 'Delete object "{name}"? Related comparisons will also be removed. This cannot be undone.',
    msgObjectCreated: 'Object created.',
    msgObjectUpdated: 'Object updated.',
    msgDeleted: 'Object deleted.',
    msgDeletedAll: 'All objects deleted.',
    msgUndo: 'Last action undone.',
    msgReset: 'Comparison history reset.',
    msgSaved: 'Rating saved.',
    msgSavedDownloaded: 'Rating saved (downloaded to Downloads).',
    msgSavedCancelled: 'Save cancelled.',
    msgLoaded: 'Rating opened. Objects: {n}, comparisons: {w}, skips: {s}.',
    msgImported: 'Objects created: {n}.',
    msgUploaded: 'Images uploaded: {n}.',
    msgNothingToUndo: 'Nothing to undo yet.',
    msgEnterName: 'Enter a name.',
    msgItemNotFound: 'Object not found.',
    msgNeedAtLeastOneTier: 'Need to keep at least one tier.',
    errUnsupportedVersion: 'Unsupported file version: {v}.'
  }
};

function t(key, params) {
  let s = T[lang][key] || key;
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      s = s.replace(new RegExp('{' + k + '}', 'g'), v);
    }
  }
  return s;
}

function setLang(l) {
  if (!LANGUAGES[l]) return;
  lang = l;
  try { localStorage.setItem('cr_lang', l); } catch (e) {}
  applyLang();
}

function applyLang() {
  document.title = t('appTitle');
  document.querySelectorAll('[data-i18n-text]').forEach((el) => {
    el.textContent = t(el.dataset.i18nText);
  });
  document.querySelectorAll('[data-i18n-html]').forEach((el) => {
    el.innerHTML = t(el.dataset.i18nHtml);
  });
  document.querySelectorAll('[data-i18n-placeholder]').forEach((el) => {
    el.placeholder = t(el.dataset.i18nPlaceholder);
  });
  document.querySelectorAll('[data-i18n-title]').forEach((el) => {
    el.title = t(el.dataset.i18nTitle);
  });
  document.querySelectorAll('[data-i18n-value]').forEach((el) => {
    el.value = t(el.dataset.i18nValue);
  });
  document.querySelectorAll('[data-i18n-aria-label]').forEach((el) => {
    el.setAttribute('aria-label', t(el.dataset.i18nAriaLabel));
  });
  const ruBtn = $('lang-ru');
  const enBtn = $('lang-en');
  [ruBtn, enBtn].forEach((b) => {
    if (b) b.classList.toggle('active', b.dataset.lang === lang);
  });
  showTab(activeTab);
}

/* -------------------- IndexedDB обёртка -------------------- */
const DB_NAME = 'RatingDB';
const DB_VERSION = 2;
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
      if (!d.objectStoreNames.contains('settings')) {
        d.createObjectStore('settings', { keyPath: 'id' });
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

function dbGetSettings() {
  return new Promise((resolve, reject) => {
    const tx = db.transaction('settings', 'readonly');
    const store = tx.objectStore('settings');
    const req = store.get('tiers_config');
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function dbPutSettings(value) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction('settings', 'readwrite');
    const store = tx.objectStore('settings');
    const req = store.put(value);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

/* -------------------- Bradley–Terry -------------------- */
const INITIAL_RATING = 0.0;

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

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
let pendingImportFile = null;
let activeTab = 'compare';
let pinnedId = null; // id зафиксированного объекта (всегда слева в сравнении)
let activeSubTab = 'table'; // подвкладка в рейтинге: table | tierlist
// Глобальное состояние перетаскивания ползунка (одно на всю страницу)
let dragSlider = null; // { handle, sliderWrap, inputWrap, tier }
const $ = (id) => document.getElementById(id);

/* -------------------- Тир-лист -------------------- */
let tiers = [
  { id: 'tier_1', name: 'S', color: '#ffd700', minRating: 2.0 },
  { id: 'tier_2', name: 'A', color: '#c4b5fd', minRating: 1.0 },
  { id: 'tier_3', name: 'B', color: '#8b5cf6', minRating: 0.0 },
  { id: 'tier_4', name: 'C', color: '#6b7280', minRating: -1.0 },
  { id: 'tier_5', name: 'D', color: '#4b5563', minRating: -3.0 }
];

let collapsedTiers = new Set();
let tierEditDialog = null; // какой тир сейчас редактируем в диалоге

// Заранее заданные имена для новых тиров (в порядке добавления)
const extraTierNames = ['E', 'F', 'F-', 'A+', 'A-', 'B+', 'B-', 'C+', 'C-', 'S+', 'S-', 'D+', 'D-'];

function nextAvailableTierName() {
  const used = new Set(tiers.map(t => t.name));
  for (const name of extraTierNames) {
    if (!used.has(name)) return name;
  }
  // Если все из списка использованы — генерируем по номеру
  return 'Tier ' + (tiers.length + 1);
}

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
  if (el) el.textContent = t('summary', { active, comparisons, skips });
};

/* -------------------- Гипертекст -------------------- */
const ALLOWED_TAGS = /^(a|b|i|em|strong|u|br|p|span)$/;
const ALLOWED_ATTRS = ['href', 'target', 'rel', 'style'];

function sanitizeHtml(html) {
  html = html.replace(/(https?:\/\/[^\s<>"'()]+|www\.[^\s<>"'()]+)/g, (match) => {
    let href = match;
    if (!href.startsWith('http://') && !href.startsWith('https://')) {
      href = 'https://' + href;
    }
    return `<a href="${href}" target="_blank" rel="noopener noreferrer">${escapeHtml(match)}</a>`;
  });

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
  if (!item) return `<div class="name-fallback">${t('noImage')}</div>`;
  const m = mediaStore[item.media_id];
  if (m && m.dataUrl) {
    return `<img src="${m.dataUrl}" alt="${escapeHtml(item.name)}" class="obj-img" loading="lazy">`;
  }
  return `<div class="name-fallback">${escapeHtml(item.name || t('noName'))}</div>`;
}

/* -------------------- Фиксация объекта -------------------- */
async function togglePin(id) {
  const it = items.find(i => i.id === id);
  if (!it) return;
  const wasPinned = it.pinned === 1;
  for (const o of items) o.pinned = 0;
  if (!wasPinned) {
    it.pinned = 1;
    pinnedId = id;
  } else {
    pinnedId = null;
  }
  await saveItems();
  message(t(it.pinned ? 'pinnedOn' : 'pinnedOff'));
  showTab(activeTab);
}

/* -------------------- Вкладки -------------------- */
function showTab(tabName) {
  activeTab = tabName;
  document.querySelectorAll('.tab').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.tab === tabName);
  });
  document.querySelectorAll('.tab-content').forEach(sec => {
    const isActive = sec.id === 'tab-' + tabName;
    sec.classList.toggle('active', isActive);
    sec.hidden = !isActive;
  });
  if (tabName === 'compare') {
    loadPair();
  } else if (tabName === 'ranking') {
    if (activeSubTab === 'tierlist') {
      renderTierList();
    } else {
      renderRanking();
    }
  } else if (tabName === 'list') {
    loadObjects();
  }
  setSummary();
}

/* -------------------- Подбор оппонента для зафиксированного объекта -------------------- */
function pickOpponent(pinned, others) {
  let best = null;
  let bestScore = -1;
  const recent = interactions.slice(-20).map(i => [i.left_id, i.right_id].sort().join('|'));
  for (const r of others) {
    const pairKey = [pinned.id, r.id].sort().join('|');
    const p = probability(pinned.rating, r.rating);
    const closeness = 4 * p * (1 - p);
    const uncertainty = 1 / Math.sqrt(pinned.games + 1) + 1 / Math.sqrt(r.games + 1);
    let score = (0.12 + 0.88 * closeness) * uncertainty;
    if (recent.includes(pairKey)) score *= 0.08;
    score *= 0.72 + Math.random() * 0.56;
    if (score > bestScore) { bestScore = score; best = r; }
  }
  return best;
}

/* -------------------- Отрисовка сравнения -------------------- */
function drawItem(side, item) {
  const mediaEl = $(side + '-media');
  const nameEl = $(side + '-name');
  const descEl = $(side + '-desc');
  const infoEl = $(side + '-info');
  const card = $(side + '-card');
  const pinBtn = $(side + '-pin');
  if (!mediaEl || !nameEl || !descEl || !infoEl || !card) return;
  const pinButton = mediaEl.querySelector('[id$="-pin"]');
  mediaEl.innerHTML = mediaHtml(item);
  if (pinButton) mediaEl.appendChild(pinButton);
  nameEl.textContent = item.name;
  descEl.innerHTML = sanitizeHtml(item.description || '');
  infoEl.textContent = `${t('metaRating')} ${item.rating.toFixed(3)} · ${t('metaComparisons')} ${item.games}`;
  const isPinned = item.id === pinnedId;
  card.onclick = () => choose(side === 'left' ? 'left' : 'right');
  if (pinBtn) {
    pinBtn.textContent = isPinned ? '🔒' : '🔓';
    pinBtn.classList.toggle('pinned', isPinned);
    pinBtn.title = isPinned ? t('unpin') : t('pin');
    pinBtn.setAttribute('aria-label', isPinned ? t('unpin') : t('pin'));
    pinBtn.onclick = (e) => { e.stopPropagation(); togglePin(item.id); };
  }
}

async function loadPair() {
  const active = items.filter(i => i.active);
  const comparison = $('comparison');
  const empty = $('empty-compare');
  const controls = $('controls');
  let pair = null;

  if (active.length >= 2) {
    const pinned = items.find(i => i.id === pinnedId && i.active);
    if (pinned) {
      const others = active.filter(i => i.id !== pinned.id);
      if (others.length > 0) {
        const right = pickOpponent(pinned, others);
        if (right) pair = { left: pinned, right };
      }
    } else {
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
      pair = best;
    }
  }

  currentPair = pair;
  if (comparison) comparison.hidden = !currentPair;
  if (empty) empty.hidden = !!currentPair;
  const hasUndo = interactions.length > 0;
  if (controls) controls.hidden = !currentPair && !hasUndo;
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
    id: uid(),
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
    const isPinned = item.pinned === 1;
    card.innerHTML = `
      <div class="obj-media-small">${mediaHtml(item)}</div>
      <div class="obj-info">
        <div class="obj-name-edit">${escapeHtml(item.name)}${isPinned ? ' 🔒' : ''}</div>
        <div class="obj-desc-small">${sanitizeHtml(item.description || '')}</div>
        <div class="obj-meta">${t('metaRating')} ${item.rating.toFixed(3)} · ${t('metaComparisons')} ${item.games} ${!item.active ? '· ' + t('metaUnavailable') : ''}</div>
      </div>
      <div class="obj-actions">
        <button class="pin-toggle" type="button" data-id="${item.id}" title="${isPinned ? t('unpin') : t('pin')}" aria-label="${isPinned ? t('unpin') : t('pin')}">${isPinned ? '🔒' : '🔓'}</button>
        <button class="edit-item" type="button" data-id="${item.id}" title="${t('editTitle')}">${t('editTitle')}</button>
        <button class="reset-item" type="button" data-id="${item.id}" title="${t('resetComparisons')}" aria-label="${t('resetComparisons')}">${t('resetComparisons')}</button>
        <button class="delete-item" type="button" data-id="${item.id}" title="${t('deleteTitle')}">${t('deleteTitle')}</button>
      </div>
    `;
    return card;
  }));

  if (items.length > 0) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'danger delete-all';
    btn.textContent = t('deleteAll');
    btn.onclick = deleteAllItems;
    list.appendChild(btn);
  }
  setSummary();
}

async function saveItems() {
  for (const it of items) await dbPut('items', it);
}

async function addItem(name, description, mediaFile) {
  if (!name || !name.trim()) throw new Error(t('msgEnterName'));
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
    pinned: 0,
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
  if (!it) throw new Error(t('msgItemNotFound'));
  if (name) it.name = name.trim();
  it.description = description || '';
  await dbPut('items', it);
  unsavedChanges = true;
  await loadObjects();
  await loadPair();
}

function editItem(id) {
  const it = items.find(i => i.id === id);
  if (!it) return;
  editingItemId = id;
  $('obj-name').value = it.name;
  $('obj-desc').value = it.description || '';
  $('obj-media').value = '';
  $('obj-save').textContent = t('dialogSaveChanges');
  $('object-dialog').showModal();
}

async function deleteItem(id) {
  const it = items.find(i => i.id === id);
  if (!it) return;
  if (!confirm(t('confirmDeleteItem', { name: it.name }))) return;
  interactions = interactions.filter(i => i.left_id !== id && i.right_id !== id && i.winner_id !== id);
  await dbClear('interactions');
  for (const inter of interactions) await dbPut('interactions', inter);
  if (it.media_id) {
    delete mediaStore[it.media_id];
    await dbDelete('media', it.media_id);
  }
  if (pinnedId === id) pinnedId = null;
  items = items.filter(i => i.id !== id);
  await dbDelete('items', id);
  recomputeRatings(items, interactions);
  await saveItems();
  unsavedChanges = true;
  await loadObjects();
  await loadPair();
}

async function resetItemComparisons(id) {
  const it = items.find(i => i.id === id);
  if (!it) return;
  if (!confirm(t('confirmResetComparisons', { name: it.name }))) return;
  interactions = interactions.filter(i => i.left_id !== id && i.right_id !== id && i.winner_id !== id);
  await dbClear('interactions');
  for (const inter of interactions) await dbPut('interactions', inter);
  recomputeRatings(items, interactions);
  await saveItems();
  unsavedChanges = true;
  await loadObjects();
  await loadPair();
}

async function deleteAllItems() {
  if (items.length === 0) return;
  if (!confirm(t('confirmDeleteAll'))) return;
  interactions = [];
  items = [];
  mediaStore = {};
  pinnedId = null;
  await dbClear('items');
  await dbClear('interactions');
  await dbClear('media');
  recomputeRatings(items, interactions);
  await saveItems();
  unsavedChanges = true;
  message(t('msgDeletedAll'));
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

async function exportRatingToFile(includeComparisons) {
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
      pinned: it.pinned,
    })),
    interactions: includeComparisons ? interactions : [],
    tiers: tiers.map(t => ({ id: t.id, name: t.name, color: t.color, minRating: t.minRating })),
  };

  const zip = new JSZip();
  zip.file('data.json', JSON.stringify(exportData, null, 2));
  for (const m of Object.values(mediaStore)) {
    zip.file('media/' + m.id, m.dataUrl.split(',')[1], { base64: true });
  }
  const blob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE' });

  let saved = false;
  try {
    const handle = await window.showSaveFilePicker({
      suggestedName: 'rating_export.tierl',
      types: [{
        description: 'Rating file (.tierl)',
        accept: { 'application/zip': ['.tierl', '.zip'] },
      }],
    });
    const writable = await handle.createWritable();
    await writable.write(blob);
    await writable.close();
    saved = true;
  } catch (err) {
    if (err.name === 'AbortError') {
      message(t('msgSavedCancelled'));
      return;
    }
  }

  if (saved) {
    message(t('msgSaved'));
    unsavedChanges = false;
    return;
  }

  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'rating_export.tierl';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  message(t('msgSavedDownloaded'));
  unsavedChanges = false;
}

async function importRating(file) {
  const zip = await JSZip.loadAsync(file);
  const dataJson = await zip.file('data.json').async('string');
  const data = JSON.parse(dataJson);

  if (data.version !== 1) throw new Error(t('errUnsupportedVersion', { v: data.version }));

  items = [];
  interactions = [];
  mediaStore = {};
  pinnedId = null;
  await dbClear('items');
  await dbClear('interactions');
  await dbClear('media');

  const mediaNames = Object.keys(zip.files).filter(n => n.startsWith('media/') && !n.endsWith('/'));
  for (const name of mediaNames) {
    const zipEntry = zip.file(name);
    if (!zipEntry) continue;
    const base64 = await zipEntry.async('base64');
    const mediaId = name.replace('media/', '');
    const ext = mediaId.split('.').pop()?.toLowerCase() || '';
    const mimeMap = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', webp: 'image/webp', bmp: 'image/bmp' };
    const mime = mimeMap[ext] || 'application/octet-stream';
    mediaStore[mediaId] = { id: mediaId, name: mediaId, type: mime, dataUrl: 'data:' + mime + ';base64,' + base64 };
    await dbPut('media', mediaStore[mediaId]);
  }

  const idMap = {};
  for (const it of data.items || []) {
    const newId = 'item_' + Date.now() + '_' + Math.random().toString(36).slice(2);
    idMap[it.id] = newId;
    const newItem = {
      id: newId,
      name: it.name,
      description: it.description || '',
      media_id: it.media_id,
      rating: INITIAL_RATING,
      games: 0,
      wins: 0,
      active: it.active ?? 1,
      pinned: it.pinned ?? 0,
      created_at: it.created_at || new Date().toISOString(),
    };
    items.push(newItem);
    await dbPut('items', newItem);
  }

  // Восстанавливаем настройки тиров из импорта, если они есть
  if (data.tiers && Array.isArray(data.tiers)) {
    tiers = data.tiers.map(t => ({
      id: t.id || 'tier_' + Date.now(),
      name: t.name,
      color: t.color,
      minRating: t.minRating
    }));
    sortTiers();
    await saveTiersSettings();
  }

  if (data.include_comparisons && data.interactions) {
    for (const inter of data.interactions) {
      const l = idMap[inter.left_id];
      const r = idMap[inter.right_id];
      const w = inter.winner_id ? idMap[inter.winner_id] : null;
      if (l && r) {
        const ni = { id: uid(), left_id: l, right_id: r, winner_id: w, decision: inter.decision, created_at: inter.created_at };
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
  const wins = interactions.filter(i => i.decision === 'win').length;
  const skips = interactions.filter(i => i.decision === 'skip').length;
  message(t('msgLoaded', { n: items.length, w: wins, s: skips }));
}

/* -------------------- Рейтинг -------------------- */
function renderRanking() {
  const data = items.filter(i => i.active).sort((a, b) => b.rating - a.rating || a.name.localeCompare(b.name));
  let rank = 0;
  const tbody = $('ranking-body');
  tbody.replaceChildren(...data.map((it) => {
    rank++;
    const isPinned = it.pinned === 1;
    const row = document.createElement('tr');
    row.innerHTML = `
      <td>${rank}</td>
      <td>${escapeHtml(it.name)}${isPinned ? ' 🔒' : ''}</td>
      <td>${it.media_id ? `<img src="${mediaStore[it.media_id].dataUrl}" alt="" class="rank-img">` : '—'}</td>
      <td>${sanitizeHtml(it.description || '') || '<span class="hint">—</span>'}</td>
      <td>${it.rating.toFixed(3)}</td>
      <td>${it.wins} / ${it.games}</td>
      <td>${(1 / Math.sqrt(it.games + 1)).toFixed(3)}</td>
      <td class="actions"></td>
    `;
    const actions = row.querySelector('.actions');
    const pinBtn = document.createElement('button');
    pinBtn.type = 'button';
    pinBtn.className = 'pin-toggle';
    pinBtn.dataset.id = it.id;
    pinBtn.title = isPinned ? t('unpin') : t('pin');
    pinBtn.setAttribute('aria-label', isPinned ? t('unpin') : t('pin'));
    pinBtn.textContent = isPinned ? '🔒' : '🔓';
    pinBtn.onclick = (e) => { e.stopPropagation(); togglePin(it.id); };
    actions.appendChild(pinBtn);

    const editBtn = document.createElement('button');
    editBtn.type = 'button';
    editBtn.className = 'edit-item';
    editBtn.dataset.id = it.id;
    editBtn.title = t('editTitle');
    editBtn.textContent = t('editTitle');
    editBtn.onclick = (e) => { e.stopPropagation(); editItem(it.id); };
    actions.appendChild(editBtn);

    const resetBtn = document.createElement('button');
    resetBtn.type = 'button';
    resetBtn.className = 'reset-item';
    resetBtn.dataset.id = it.id;
    resetBtn.title = t('resetComparisons');
    resetBtn.setAttribute('aria-label', t('resetComparisons'));
    resetBtn.textContent = t('resetComparisons');
    resetBtn.onclick = (e) => { e.stopPropagation(); resetItemComparisons(it.id); };
    actions.appendChild(resetBtn);

    const delBtn = document.createElement('button');
    delBtn.type = 'button';
    delBtn.className = 'delete-item';
    delBtn.dataset.id = it.id;
    delBtn.title = t('deleteTitle');
    delBtn.textContent = t('deleteTitle');
    delBtn.onclick = (e) => { e.stopPropagation(); deleteItem(it.id); };
    actions.appendChild(delBtn);

    return row;
  }));
}

/* -------------------- Тир-лист -------------------- */
function getRatingRange() {
  const active = items.filter(i => i.active);
  if (active.length === 0) return { min: -3, max: 3, realMin: 0, realMax: 0 };
  const ratings = active.map(i => i.rating);
  const min = Math.min(...ratings) - 1;
  const max = Math.max(...ratings) + 1;
  return { min, max, realMin: Math.min(...ratings), realMax: Math.max(...ratings) };
}

function positionToValue(pos, rangeMin, rangeMax) {
  return rangeMin + pos * (rangeMax - rangeMin);
}

function valueToPosition(val, rangeMin, rangeMax) {
  const span = rangeMax - rangeMin;
  if (span === 0) return 0;
  return Math.max(0, Math.min(1, (val - rangeMin) / span));
}

function sortTiers() {
  tiers.sort((a, b) => b.minRating - a.minRating);
}

function clampTierBoundary(tierId, value, range) {
  const sorted = [...tiers].sort((a, b) => b.minRating - a.minRating);
  const idx = sorted.findIndex(t => t.id === tierId);

  if (idx < 0 || idx === sorted.length - 1) return value;

  const epsilon = Math.max((range.max - range.min) * 0.001, 0.001);

  const upper = idx > 0
    ? sorted[idx - 1].minRating - epsilon
    : range.max;

  const lower = idx < sorted.length - 1
    ? sorted[idx + 1].minRating + epsilon
    : range.min;

  return Math.max(lower, Math.min(upper, value));
}

function attachTierLabelDrag(label, tier) {
  label.addEventListener('dragstart', e => {
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', tier.id);
    label.classList.add('dragging');
  });

  label.addEventListener('dragend', () => {
    label.classList.remove('dragging');
    document.querySelectorAll('.tier-scale-label.drop-target')
      .forEach(el => el.classList.remove('drop-target'));
  });

  label.addEventListener('dragover', e => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    label.classList.add('drop-target');
  });

  label.addEventListener('dragleave', () => {
    label.classList.remove('drop-target');
  });

  label.addEventListener('drop', e => {
    e.preventDefault();

    const sourceId = e.dataTransfer.getData('text/plain');
    const source = tiers.find(t => t.id === sourceId);

    if (!source || source.id === tier.id) {
      label.classList.remove('drop-target');
      return;
    }

    // Меняем только положение тиров.
    // Название и цвет остаются у своих объектов.
    const tempRating = source.minRating;
    source.minRating = tier.minRating;
    tier.minRating = tempRating;

    unsavedChanges = true;
    saveTiersSettings();
    renderTierList();

    label.classList.remove('drop-target');
  });
}

function renderTierList() {
  const container = $('tier-containers');
  const scaleBar = $('tier-scale-bar');
  const scaleInputs = $('tier-scale-inputs');
  const scaleLabels = $('tier-scale-labels');
  const rangeMinEl = $('tier-range-min');
  const rangeMaxEl = $('tier-range-max');
  if (!container || !scaleBar || !scaleInputs || !scaleLabels) return;

  sortTiers();
  const range = getRatingRange();

  // Значения мин/макс под шкалой
  if (rangeMinEl) rangeMinEl.textContent = range.min.toFixed(2);
  if (rangeMaxEl) rangeMaxEl.textContent = range.max.toFixed(2);

  // Очищаем
  scaleBar.innerHTML = '';
  scaleInputs.innerHTML = '';
  scaleLabels.innerHTML = '';
  container.innerHTML = '';

  const activeItems = items.filter(i => i.active);
  const sorted = [...tiers].sort((a, b) => b.minRating - a.minRating);

  // Сегменты, поля ввода, ползунки и названия тиров
  // Логика: X тиров = X-1 ползунка. Ползунок i находится между tier[i] и tier[i+1].
  // Тир 0 (самый высокий): от ползунка 0 до правого края.
  // Тир X-1 (самый низкий): от левого края до ползунка X-2.
  // Тиры между ними: между ползунками i-1 и i.

    // Рисуем сегменты шкалы и N-1 ползунков для N тиров
    sorted.forEach((tier, idx) => {
      // Шкала идёт слева направо: от минимального рейтинга к максимальному.
      const leftPos = idx === sorted.length - 1
        ? 0
        : valueToPosition(tier.minRating, range.min, range.max);
  
      const rightPos = idx === 0
        ? 1
        : valueToPosition(sorted[idx - 1].minRating, range.min, range.max);
  
      const segment = document.createElement('div');
      segment.className = 'tier-segment';
      segment.style.background = tier.color;
      segment.style.left = `${leftPos * 100}%`;
      segment.style.width = `${Math.max(0, rightPos - leftPos) * 100}%`;
      scaleBar.appendChild(segment);
  
      // Для каждого тира, кроме самого нижнего, создаём границу.
      if (idx < sorted.length - 1) {
        const pos = valueToPosition(tier.minRating, range.min, range.max);
  
        const input = document.createElement('input');
        input.type = 'number';
        input.className = 'tier-boundary-input';
        input.value = tier.minRating.toFixed(2);
        input.dataset.tierId = tier.id;
        input.placeholder = t('boundary');
  
        input.addEventListener('change', () => {
          const value = parseFloat(input.value);
          if (!Number.isFinite(value)) {
            input.value = tier.minRating.toFixed(2);
            return;
          }
  
          tier.minRating = clampTierBoundary(tier.id, value, range);
          unsavedChanges = true;
          saveTiersSettings();
          renderTierList();
        });
  
        input.addEventListener('keydown', e => {
          if (e.key === 'Enter') input.blur();
        });
  
        const inputWrap = document.createElement('div');
        inputWrap.className = 'tier-input-wrap';
        inputWrap.dataset.tierId = tier.id;
        inputWrap.style.left = `${pos * 100}%`;
        inputWrap.appendChild(input);
        scaleInputs.appendChild(inputWrap);
  
        const sliderWrap = document.createElement('div');
        sliderWrap.className = 'tier-slider-wrap';
        sliderWrap.dataset.tierId = tier.id;
        sliderWrap.style.left = `${pos * 100}%`;
  
        const handle = document.createElement('div');
        handle.className = 'tier-slider-handle';
        handle.dataset.tierId = tier.id;
        handle.style.background = tier.color;
  
        sliderWrap.appendChild(handle);
        scaleBar.appendChild(sliderWrap);
      }
  
      // Подпись располагается по центру своего цветного сегмента.
      const label = document.createElement('div');
      label.className = 'tier-scale-label';
      label.textContent = tier.name;
      label.style.color = tier.color;
      label.dataset.tierId = tier.id;
      label.draggable = true;
      label.style.left = `${((leftPos + rightPos) / 2) * 100}%`;
      label.style.transform = 'translateX(-50%)';
  
      scaleLabels.appendChild(label);
      attachTierLabelDrag(label, tier);
    });
    
  // Контейнеры тиров с объектами — простой ряд, перенос по центру
  sorted.forEach((tier, idx) => {
    const tierMin = Number(tier.minRating);
    const tierMax = idx > 0
      ? Number(sorted[idx - 1].minRating)
      : range.max;

    const tierObjs = activeItems.filter(it => {
      const rating = Number(it.rating);
      return rating >= tierMin && rating < tierMax;
    });

    const tierContainer = document.createElement('div');
    tierContainer.className = 'tier-container';

    const tierHeader = document.createElement('div');
    tierHeader.className = 'tier-header';
    tierHeader.style.borderLeft = `4px solid ${tier.color}`;
    const isCollapsed = collapsedTiers.has(tier.id);
    tierHeader.innerHTML = `<span class="tier-name" style="color:${tier.color}">${escapeHtml(tier.name)}</span> <span class="tier-count">(${tierObjs.length})</span> <button class="edit-tier-btn" type="button" data-id="${tier.id}" title="${t('editTier')}">✎</button> <button class="collapse-tier-btn" type="button" data-id="${tier.id}" title="${isCollapsed ? t('expandTier') : t('collapseTier')}">${isCollapsed ? '▶' : '▼'}</button>`;

    const tierItems = document.createElement('div');
    tierItems.className = 'tier-items' + (isCollapsed ? ' collapsed' : '');

    if (tierObjs.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'tier-empty';
      empty.textContent = t('emptyTier');
      tierItems.appendChild(empty);
    } else {
      tierObjs.sort((a, b) => b.rating - a.rating || a.name.localeCompare(b.name));
      tierObjs.forEach(it => {
        const card = document.createElement('div');
        card.className = 'tier-item-card';
        card.title = `${it.name}\n${t('ratingLabel')}: ${it.rating.toFixed(3)}`;
        card.innerHTML = `
          <div class="tier-item-media">${mediaHtml(it)}</div>
          <div class="tier-item-name">${escapeHtml(it.name)}</div>
          <div class="tier-item-rating">${it.rating.toFixed(3)}</div>
        `;
        tierItems.appendChild(card);
      });
    }

    tierContainer.appendChild(tierHeader);
    tierContainer.appendChild(tierItems);
    container.appendChild(tierContainer);

    // Обработчик кнопки редактирования названия и цвета тира
    const editBtn = tierHeader.querySelector('.edit-tier-btn');
    if (editBtn) {
      editBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const id = editBtn.dataset.id;
        const tierEdit = tiers.find(t => t.id === id);
        if (!tierEdit) return;

        // Заполняем диалог
        const nameInput = $('tier-edit-name');
        const colorCustom = $('tier-edit-color-custom');
        nameInput.value = tierEdit.name;
        colorCustom.value = tierEdit.color;

        // Рисуем цветовые сватчи
        const colorsContainer = $('tier-edit-colors');
        colorsContainer.innerHTML = '';
        const presetColors = ['#ffd700', '#c4b5fd', '#8b5cf6', '#6b7280', '#4b5563', '#ef4444', '#10b981', '#f59e0b', '#ff6b6b', '#4ecdc4'];
        presetColors.forEach(c => {
          const swatch = document.createElement('div');
          swatch.className = 'color-swatch';
          swatch.style.backgroundColor = c;
          if (c === tierEdit.color) swatch.classList.add('selected');
          swatch.addEventListener('click', () => {
            colorCustom.value = c;
            document.querySelectorAll('.color-swatch').forEach(s => s.classList.remove('selected'));
            swatch.classList.add('selected');
          });
          colorsContainer.appendChild(swatch);
        });

        // Обработчик изменения цвета через input type="color"
        colorCustom.addEventListener('input', () => {
          document.querySelectorAll('.color-swatch').forEach(s => s.classList.remove('selected'));
        });

        // Показываем диалог
        tierEditDialog = tierEdit;
        $('tier-edit-dialog').showModal();
      });
    }

    // Обработчик кнопки свернуть/развернуть
    const collapseBtn = tierHeader.querySelector('.collapse-tier-btn');
    if (collapseBtn) {
      collapseBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const id = collapseBtn.dataset.id;
        if (collapsedTiers.has(id)) collapsedTiers.delete(id);
        else collapsedTiers.add(id);
        renderTierList();
      });
    }
  });
}

function addTier() {
  const sorted = [...tiers].sort((a, b) => b.minRating - a.minRating);
  let newMin;
  let newColor;

  if (sorted.length === 0) {
    newMin = 0;
    newColor = '#ffd700';
  } else if (sorted.length === 1) {
    // Только один тир — создаём новый справа (с меньшим рейтингом)
    newMin = sorted[0].minRating - 1;
    newColor = '#c4b5fd';
  } else {
    // Создаём новый тир между двумя последними (самыми низкими рейтингами)
    const lowest = sorted[sorted.length - 1];
    const secondLowest = sorted[sorted.length - 2];
    newMin = (lowest.minRating + secondLowest.minRating) / 2;
    const colors = ['#ffd700', '#c4b5fd', '#8b5cf6', '#6b7280', '#4b5563', '#ef4444', '#10b981', '#f59e0b'];
    newColor = colors[sorted.length % colors.length];
  }

  tiers.push({
    id: 'tier_' + Date.now(),
    name: nextAvailableTierName(),
    color: newColor,
    minRating: newMin
  });
  sortTiers();
  unsavedChanges = true;
  saveTiersSettings();
  renderTierList();
}

function removeTier() {
  if (tiers.length <= 1) return message(t('msgNeedAtLeastOneTier'), true);
  const sorted = [...tiers].sort((a, b) => b.minRating - a.minRating);
  const lowestTier = sorted[sorted.length - 1];
  tiers = tiers.filter(t => t.id !== lowestTier.id);
  sortTiers();
  unsavedChanges = true;
  saveTiersSettings();
  renderTierList();
}

function resetTiers() {
  tiers = [
    { id: 'tier_1', name: 'S', color: '#ffd700', minRating: 2.0 },
    { id: 'tier_2', name: 'A', color: '#c4b5fd', minRating: 1.0 },
    { id: 'tier_3', name: 'B', color: '#8b5cf6', minRating: 0.0 },
    { id: 'tier_4', name: 'C', color: '#6b7280', minRating: -1.0 },
    { id: 'tier_5', name: 'D', color: '#4b5563', minRating: -3.0 }
  ];
  collapsedTiers.clear();
  sortTiers();
  unsavedChanges = true;
  saveTiersSettings();
  renderTierList();
}

async function saveTiersSettings() {
  await dbPutSettings({
    id: 'tiers_config',
    tiers: tiers.map(t => ({ id: t.id, name: t.name, color: t.color, minRating: t.minRating })),
    collapsedTiers: Array.from(collapsedTiers)
  });
}

/* -------------------- События подвкладок рейтинга -------------------- */
// Добавляем в существующий блок событий

// Переключение вкладок
document.querySelectorAll('.tab').forEach(btn => {
  btn.addEventListener('click', () => showTab(btn.dataset.tab));
});

// Подвкладки рейтинга (Таблица / Тир-лист)
document.querySelectorAll('.sub-tab').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.sub-tab').forEach(b => b.classList.toggle('active', b === btn));
    document.querySelectorAll('.sub-tab-content').forEach(c => {
      const isActive = c.id === 'view-' + btn.dataset.subtab;
      c.classList.toggle('active', isActive);
      c.hidden = !isActive;
    });
    activeSubTab = btn.dataset.subtab;
    if (activeSubTab === 'tierlist') renderTierList();
    else renderRanking();
  });
});

// Кнопки управления тирами
$('add-tier').addEventListener('click', addTier);
$('remove-tier').addEventListener('click', removeTier);
$('reset-tiers').addEventListener('click', resetTiers);

// Диалог редактирования тира
$('tier-edit-save').addEventListener('click', () => {
  const nameInput = $('tier-edit-name');
  const colorCustom = $('tier-edit-color-custom');
  if (!tierEditDialog) return;
  const newName = nameInput.value.trim() || tierEditDialog.name;
  const newColor = colorCustom.value;
  tierEditDialog.name = newName;
  tierEditDialog.color = newColor;
  unsavedChanges = true;
  saveTiersSettings();
  renderTierList();
  $('tier-edit-dialog').close();
  tierEditDialog = null;
});

$('tier-edit-cancel').addEventListener('click', () => {
  $('tier-edit-dialog').close();
  tierEditDialog = null;
});

// Закрытие диалога при клике вне его
$('tier-edit-dialog').addEventListener('click', (e) => {
  if (e.target === $('tier-edit-dialog')) {
    $('tier-edit-dialog').close();
    tierEditDialog = null;
  }
});

// Переключатель языка
$('lang-ru').addEventListener('click', () => setLang('ru'));
$('lang-en').addEventListener('click', () => setLang('en'));

// Импорт картинок
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
  message(t('msgUploaded', { n: files.length }));
});

// Импорт из текста
$('import-text-button').addEventListener('click', async () => {
  const ta = $('text-import');
  const lines = ta.value.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0);
  if (lines.length === 0) return message(t('msgEnterName'), true);
  for (const line of lines) {
    try { await addItem(line, ''); } catch (err) { message('Ошибка «' + line + '»: ' + err.message, true); }
  }
  ta.value = '';
  message(t('msgImported', { n: lines.length }));
});

// Экспорт
$('export-with-button').addEventListener('click', () => exportRatingToFile(true));
$('export-without-button').addEventListener('click', () => exportRatingToFile(false));

// Импорт .tierl
$('open-tierl-button').addEventListener('click', () => {
  $('tierl-import').click();
});
$('tierl-import').addEventListener('change', async (e) => {
  const file = e.target.files && e.target.files[0];
  if (!file) return;
  if (unsavedChanges) {
    pendingImportFile = file;
    $('save-confirm-dialog').showModal();
    return;
  }
  try {
    await importRating(file);
  } catch (err) { message(err.message, true); }
  e.target.value = '';
});

// Диалог подтверждения сохранения перед открытием файла
$('save-confirm-save').addEventListener('click', async () => {
  $('save-confirm-dialog').close();
  try {
    await exportRatingToFile(true);
    if (pendingImportFile) {
      const file = pendingImportFile;
      pendingImportFile = null;
      await importRating(file);
      $('tierl-import').value = '';
    }
  } catch (err) { message(err.message, true); }
});
$('save-confirm-dont-save').addEventListener('click', async () => {
  $('save-confirm-dialog').close();
  unsavedChanges = false;
  try {
    if (pendingImportFile) {
      const file = pendingImportFile;
      pendingImportFile = null;
      await importRating(file);
      $('tierl-import').value = '';
    }
  } catch (err) { message(err.message, true); }
});
$('save-confirm-cancel').addEventListener('click', () => {
  $('save-confirm-dialog').close();
  pendingImportFile = null;
  $('tierl-import').value = '';
});

// Диалог добавления/редактирования объекта
$('add-object-button').addEventListener('click', () => {
  editingItemId = null;
  $('object-form').reset();
  $('obj-save').textContent = t('dialogSave');
  $('object-dialog').showModal();
});
$('obj-cancel').addEventListener('click', () => $('object-dialog').close());

$('object-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const name = $('obj-name').value.trim();
  const description = $('obj-desc').value.trim();
  if (!name) return message(t('msgEnterName'), true);
  try {
    if (editingItemId) {
      await updateItem(editingItemId, name, description);
      message(t('msgObjectUpdated'));
    } else {
      const file = $('obj-media').files[0];
      await addItem(name, description, file);
      message(t('msgObjectCreated'));
    }
    $('object-dialog').close();
    $('obj-media').value = '';
  } catch (err) { message(err.message, true); }
});

// Делегирование в списке объектов
$('objects-list').addEventListener('click', async (e) => {
  const pinBtn = e.target.closest('.pin-toggle');
  const editBtn = e.target.closest('.edit-item');
  const delBtn = e.target.closest('.delete-item');
  const delAllBtn = e.target.closest('.delete-all');
  if (pinBtn) {
    const id = pinBtn.dataset.id;
    e.stopPropagation();
    togglePin(id);
    return;
  }
  if (editBtn) {
    const id = editBtn.dataset.id;
    e.stopPropagation();
    editItem(id);
    return;
  }
  if (delBtn) {
    await deleteItem(delBtn.dataset.id);
    return;
  }
  const resetBtn = e.target.closest('.reset-item');
  if (resetBtn) {
    await resetItemComparisons(resetBtn.dataset.id);
    return;
  }
  if (delAllBtn) {
    await deleteAllItems();
    return;
  }
});

// Управление сравнением
$('skip-button').addEventListener('click', () => choose('skip'));
$('undo-button').addEventListener('click', async () => {
  if (interactions.length === 0) return message(t('msgNothingToUndo'));
  interactions.pop();
  await dbClear('interactions');
  for (const inter of interactions) await dbPut('interactions', inter);
  recomputeRatings(items, interactions);
  await saveItems();
  unsavedChanges = true;
  message(t('msgUndo'));
  await loadPair();
  await loadObjects();
});
$('reset-button').addEventListener('click', async () => {
  if (!confirm(t('msgReset') + '\n\n' + (lang === 'ru' ? 'Это нельзя отменить.' : 'This cannot be undone.'))) return;
  interactions = [];
  await dbClear('interactions');
  recomputeRatings(items, interactions);
  await saveItems();
  unsavedChanges = true;
  message(t('msgReset'));
  await loadPair();
  await loadObjects();
});

document.addEventListener('keydown', (e) => {
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
  if (e.key === 'ArrowLeft') choose('left');
  if (e.key === 'ArrowRight') choose('right');
  if (e.code === 'Space') { e.preventDefault(); choose('skip'); }
  if (e.key.toLowerCase() === 'z' && interactions.length > 0) {
    $('undo-button').click();
  }
});

// Глобальный обработчик перетаскивания ползунка тир-листа (на document, один на всех)
// Перетаскивание ползунков тир-листа
document.addEventListener('pointerdown', e => {
  const handle = e.target.closest('.tier-slider-handle');
  if (!handle) return;

  e.preventDefault();

  const tier = tiers.find(t => t.id === handle.dataset.tierId);
  if (!tier) return;

  dragSlider = {
    tier,
    range: getRatingRange(),
    pointerId: e.pointerId
  };

  handle.classList.add('dragging');
  handle.setPointerCapture(e.pointerId);
});

document.addEventListener('pointermove', e => {
  if (!dragSlider || e.pointerId !== dragSlider.pointerId) return;

  const scaleBar = document.querySelector('.tier-scale-bar');
  if (!scaleBar) return;

  const rect = scaleBar.getBoundingClientRect();
  const pos = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));

  const { tier, range } = dragSlider;
  const value = positionToValue(pos, range.min, range.max);

  tier.minRating = clampTierBoundary(tier.id, value, range);

  const actualPos = valueToPosition(tier.minRating, range.min, range.max);

  const sliderWrap = document.querySelector(
    `.tier-slider-wrap[data-tier-id="${tier.id}"]`
  );
  const inputWrap = document.querySelector(
    `.tier-input-wrap[data-tier-id="${tier.id}"]`
  );
  const input = inputWrap?.querySelector('input');

  if (sliderWrap) sliderWrap.style.left = `${actualPos * 100}%`;
  if (inputWrap) inputWrap.style.left = `${actualPos * 100}%`;
  if (input) input.value = tier.minRating.toFixed(2);

  // Обновляем ширину цветных сегментов.
  const sorted = [...tiers].sort((a, b) => b.minRating - a.minRating);

  sorted.forEach((currentTier, idx) => {
    const segment = [...scaleBar.querySelectorAll('.tier-segment')][idx];
    if (!segment) return;

    const left = idx === sorted.length - 1
      ? 0
      : valueToPosition(currentTier.minRating, range.min, range.max);

    const right = idx === 0
      ? 1
      : valueToPosition(sorted[idx - 1].minRating, range.min, range.max);

    segment.style.left = `${left * 100}%`;
    segment.style.width = `${Math.max(0, right - left) * 100}%`;

    const label = document.querySelector(
      `.tier-scale-label[data-tier-id="${currentTier.id}"]`
    );
    
    if (label) {
      label.style.left = `${((left + right) / 2) * 100}%`;
    }
  });

  unsavedChanges = true;
});

function finishTierSliderDrag() {
  if (!dragSlider) return;

  const handle = document.querySelector(
    `.tier-slider-handle[data-tier-id="${dragSlider.tier.id}"]`
  );

  if (handle) handle.classList.remove('dragging');

  dragSlider = null;
  saveTiersSettings();
  renderTierList();
}

document.addEventListener('pointerup', finishTierSliderDrag);
document.addEventListener('pointercancel', finishTierSliderDrag);
/* -------------------- Инициализация -------------------- */
async function init() {
  await openDB();
  items = await dbGetAll('items');
  interactions = await dbGetAll('interactions');
  const mediaList = await dbGetAll('media');
  for (const m of mediaList) mediaStore[m.id] = m;
  // Восстанавливаем зафиксированный объект
  pinnedId = items.find(i => i.pinned === 1)?.id || null;
  recomputeRatings(items, interactions);
  // Загружаем настройки тиров (границы, названия, цвета) из IndexedDB
  const settings = await dbGetSettings();
  if (settings && settings.tiers && Array.isArray(settings.tiers)) {
    tiers = settings.tiers.map(t => ({
      id: t.id || 'tier_' + Date.now(),
      name: t.name,
      color: t.color,
      minRating: t.minRating
    }));
    sortTiers();
  }
  if (settings && settings.collapsedTiers && Array.isArray(settings.collapsedTiers)) {
    collapsedTiers = new Set(settings.collapsedTiers);
  }
  // Перевод статического интерфейса и первый показ вкладки
  applyLang();
}

init().catch(err => {
  console.error(err);
  message('Ошибка инициализации: ' + err.message, true);
});