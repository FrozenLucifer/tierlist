let currentPair = null;
let editingItemId = null;
let unsavedChanges = false;
const $ = (id) => document.getElementById(id);
const message = (text, error = false) => {
  const el = $("message");
  if (el) { el.textContent = text; el.style.color = error ? "#ff9bad" : "#c4b5fd"; }
};

async function api(url, options = {}) {
  const response = await fetch(url, { headers: { "Content-Type": "application/json" }, ...options });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.detail || "Не удалось выполнить запрос");
  return data;
}
function setSummary(stats) {
  const bits = [`Объектов: ${stats.active}`, `сравнений: ${stats.comparisons}`, `пропусков: ${stats.skips}`];
  const el = $("summary");
  if (el) $("summary").textContent = bits.join(" · ");
}

// --- санитизация базового гипертекста (разрешённые теги) ---
const ALLOWED_TAGS = /^(a|b|i|em|strong|u|br|p|span)$/;
const ALLOWED_ATTRS = ["href", "target", "rel", "style"];
function sanitizeHtml(html) {
  const div = document.createElement("div");
  div.innerHTML = html;
  function walk(node) {
    if (node.nodeType === Node.ELEMENT_NODE) {
      const tag = node.tagName.toLowerCase();
      if (!ALLOWED_TAGS.test(tag)) {
        const replacement = document.createElement("span");
        replacement.textContent = node.textContent || "";
        if (node.parentNode) node.parentNode.replaceChild(replacement, node);
        return;
      }
      for (let i = node.attributes.length - 1; i >= 0; i--) {
        const attr = node.attributes[i];
        if (!ALLOWED_ATTRS.includes(attr.name)) node.removeAttribute(attr.name);
      }
      if (tag === "a") {
        const href = node.getAttribute("href") || "";
        if (!href.startsWith("http://") && !href.startsWith("https://") && !href.startsWith("mailto:")) {
          node.removeAttribute("href");
        }
        node.setAttribute("target", "_blank");
        node.setAttribute("rel", "noopener noreferrer");
      }
      node.childNodes.forEach(walk);
    }
  }
  walk(div);
  return div.innerHTML;
}

function mediaHtml(item) {
  const pm = item && item.primary_media;
  if (pm && pm.image_url && pm.exists) {
    return `<img src="${pm.image_url}" alt="${escapeHtml(item.name)}" class="obj-img" loading="lazy">`;
  }
  if (item && item.media_count > 0) {
    return `<div class="media-missing">медиа недоступно</div>`;
  }
  return `<div class="no-media">без картинки</div>`;
}

function escapeHtml(text) {
  if (text == null) return "";
  const d = document.createElement("div");
  d.textContent = text;
  return d.innerHTML;
}

function drawItem(side, item) {
  const mediaEl = $(side + "-media");
  const nameEl = $(side + "-name");
  const descEl = $(side + "-desc");
  const infoEl = $(side + "-info");
  const btn = $(side + "-choice");
  if (!mediaEl || !nameEl || !descEl || !infoEl || !btn) return;
  mediaEl.innerHTML = mediaHtml(item);
  nameEl.textContent = item.name;
  descEl.innerHTML = sanitizeHtml(item.description || "");
  infoEl.textContent = `рейтинг ${item.rating} · игр ${item.games}`;
  btn.onclick = () => choose(side === "left" ? "left" : "right");
}

async function loadPair() {
  try {
    const data = await api("/api/pair");
    setSummary(data.stats);
    currentPair = data.pair;
  } catch (error) {
    message(error.message, true);
    currentPair = null;
  }
  const ready = Boolean(currentPair);
  const comparison = $("comparison");
  const controls = $("controls");
  const empty = $("empty");
  if (comparison) comparison.hidden = !ready;
  if (controls) controls.hidden = !ready;
  if (empty) empty.hidden = ready;
  if (ready) { drawItem("left", currentPair.left); drawItem("right", currentPair.right); message(""); }
}
async function choose(choice) {
  if (!currentPair) return;
  const pair = currentPair; currentPair = null;
  const comparison = $("comparison");
  if (comparison) comparison.hidden = true;
  try {
    const data = await api("/api/choice", { method: "POST", body: JSON.stringify({ left_id: pair.left.item_id, right_id: pair.right.item_id, choice }) });
    setSummary(data.stats);
    await loadPair();
  } catch (error) { message(error.message, true); await loadPair(); }
}

// --- объекты (список, добавление, редактирование, удаление) ---
async function loadObjects() {
  try {
    const data = await api("/api/items");
    setSummary(data.stats);
    const list = $("objects-list");
    if (!list) return;
    list.replaceChildren(...data.items.map((item) => {
      const card = document.createElement("div");
      card.className = "object-card" + (item.available ? "" : " object-missing");
      card.innerHTML = `
        <div class="obj-media-small">${mediaHtml(item)}</div>
        <div class="obj-info">
          <div class="obj-name-edit">${escapeHtml(item.name)}</div>
          <div class="obj-desc-small">${sanitizeHtml(item.description || "")}</div>
          <div class="obj-meta">рейтинг ${item.rating} · игр ${item.games} ${!item.available ? "· недоступен" : ""}</div>
        </div>
        <div class="obj-actions">
          <button class="edit-item" data-id="${item.item_id}" title="Редактировать">✎</button>
          <button class="delete-item" data-id="${item.item_id}" data-available="${item.available}" title="Удалить">✕</button>
        </div>
      `;
      return card;
    }));
  } catch (error) { message(error.message, true); }
}

async function deleteItem(itemId, available) {
  const itemsData = await api("/api/items");
  const item = itemsData.items.find(i => i.item_id === itemId);
  if (!item) return;
  if (!confirm(`Удалить объект «${item.name}»? Связанные сравнения тоже исчезнут. Это нельзя отменить.`)) return;
  try {
    const data = await api(`/api/item/${itemId}`, { method: "DELETE", body: JSON.stringify({ delete_files: available, confirmed: true }) });
    message(available ? `Удалено файлов: ${data.deleted_files}; история очищена.` : "История объекта очищена.");
    unsavedChanges = true;
    await loadObjects(); await loadPair();
  } catch (error) { message(error.message, true); }
}

// --- импорт картинок (множественный выбор) ---
const mediaFilesInput = $("media-files");
if ($("upload-images-button") && mediaFilesInput) {
  $("upload-images-button").addEventListener("click", () => {
    mediaFilesInput.click();
  });
  mediaFilesInput.addEventListener("change", async (event) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;
    let created = 0;
    for (const file of files) {
      try {
        const fd = new FormData();
        fd.append("file", file);
        await api("/api/media/upload", { method: "POST", body: fd, headers: {} });
        created++;
      } catch (error) { message("Ошибка загрузки «" + file.name + "»: " + error.message, true); }
    }
    mediaFilesInput.value = "";
    unsavedChanges = true;
    message(`Загружено картинок: ${created}`);
    await loadObjects(); await loadPair();
  });
}

// --- импорт из текста (каждая строка — объект) ---
if ($("import-text-button")) {
  $("import-text-button").addEventListener("click", async () => {
    const ta = $("text-import");
    const text = ta ? ta.value : "";
    const lines = text.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0);
    if (lines.length === 0) return message("Нет строк для импорта.", true);
    let created = 0;
    for (const line of lines) {
      try {
        await api("/api/item", { method: "POST", body: JSON.stringify({ name: line, description: "" }) });
        created++;
      } catch (error) { message("Ошибка создания «" + line + "»: " + error.message, true); }
    }
    if (ta) ta.value = "";
    unsavedChanges = true;
    message(`Создано объектов из текста: ${created}`);
    await loadObjects(); await loadPair();
  });
}

// --- проверка несохранённых изменений перед destruктивными действиями ---
async function confirmSaveBeforeReplace() {
  if (!unsavedChanges) return true;
  const answer = confirm(
    "У вас есть несохранённые изменения. Сохранить текущий тир-лист перед открытием нового файла?\n\n" +
    "Нажмите 'ОК' — сохранить и открыть файл.\n" +
    "Нажмите 'Отмена' — открыть файл без сохранения (текущие изменения будут потеряны)."
  );
  if (answer) {
    // Сохраняем перед открытием
    try {
      location.href = "/api/export?include_comparisons=true";
      // Небольшая пауза, чтобы браузер начал скачивание
      await new Promise(r => setTimeout(r, 500));
    } catch (e) { message("Не удалось сохранить файл.", true); }
  }
  // В любом случае сбрасываем флаг, так как пользователь принял решение
  unsavedChanges = false;
  return true;
}

// --- экспорт тир-листа (.tierl) ---
if ($("export-with-button")) {
  $("export-with-button").addEventListener("click", () => {
    location.href = "/api/export?include_comparisons=true";
  });
}
if ($("export-without-button")) {
  $("export-without-button").addEventListener("click", () => {
    location.href = "/api/export?include_comparisons=false";
  });
}

// --- импорт тир-листа (.tierl / .zip) — открытие файла (заменяет всё) ---
const tierlInput = $("tierl-import");
if ($("open-tierl-button") && tierlInput) {
  $("open-tierl-button").addEventListener("click", () => {
    tierlInput.click();
  });
  tierlInput.addEventListener("change", async () => {
    const file = tierlInput.files && tierlInput.files[0];
    if (!file) return;
    if (!(await confirmSaveBeforeReplace())) return;
    const fd = new FormData();
    fd.append("file", file);
    try {
      message("Открываю тир-лист…");
      const data = await api("/api/import?replace=true", { method: "POST", body: fd, headers: {} });
      tierlInput.value = "";
      unsavedChanges = false;
      message(`Тир-лист открыт. Объектов: ${data.stats.active}, сравнений: ${data.stats.comparisons}.`);
      await loadObjects(); await loadPair();
    } catch (error) { message(error.message, true); }
  });
}

// --- диалог добавления/редактирования объекта ---
const dialog = $("object-dialog");
const form = $("object-form");
const objName = $("obj-name");
const objDesc = $("obj-desc");
const objMedia = $("obj-media");
const objSave = $("obj-save");
const objCancel = $("obj-cancel");

$("add-object-button").addEventListener("click", () => {
  editingItemId = null;
  if (form) form.reset();
  if (objSave) objSave.textContent = "Сохранить";
  if (dialog) dialog.showModal();
});
if (objCancel) objCancel.addEventListener("click", () => { if (dialog) dialog.close(); });

if (form) form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const name = objName ? objName.value.trim() : "";
  const description = objDesc ? objDesc.value.trim() : "";
  if (!name) return message("Введите название.", true);
  try {
    if (editingItemId) {
      await api(`/api/item/${editingItemId}`, { method: "PUT", body: JSON.stringify({ name, description }) });
      message("Объект обновлён.");
    } else {
      const data = await api("/api/item", { method: "POST", body: JSON.stringify({ name, description }) });
      editingItemId = data.item_id;
      if (objMedia && objMedia.files.length > 0) {
        const fd = new FormData();
        fd.append("file", objMedia.files[0]);
        await api("/api/media/upload", { method: "POST", body: fd, headers: {} });
      }
      message("Объект создан.");
    }
    if (dialog) dialog.close();
    unsavedChanges = true;
    await loadObjects(); await loadPair();
  } catch (error) { message(error.message, true); }
});

// делегирование событий для кнопок редактирования/удаления в списке объектов
if ($("objects-list")) {
  $("objects-list").addEventListener("click", async (event) => {
    const editBtn = event.target.closest(".edit-item");
    const delBtn = event.target.closest(".delete-item");
    if (editBtn) {
      const id = editBtn.dataset.id;
      try {
        const itemsData = await api("/api/items");
        const item = itemsData.items.find(i => i.item_id === id);
        if (!item) return;
        editingItemId = id;
        if (objName) objName.value = item.name;
        if (objDesc) objDesc.value = item.description || "";
        if (objMedia) objMedia.value = "";
        if (objSave) objSave.textContent = "Сохранить изменения";
        if (dialog) dialog.showModal();
      } catch (error) { message(error.message, true); }
      return;
    }
    if (delBtn) {
      const id = delBtn.dataset.id;
      const available = delBtn.dataset.available === "true";
      deleteItem(id, available);
      return;
    }
  });
}

async function showRanking(scroll = true) {
  try {
    const data = await api("/api/ranking");
    setSummary(data.stats);
    const rankingBody = $("ranking-body");
    if (!rankingBody) { message("Элемент рейтинга не найден на странице.", true); return; }
    rankingBody.replaceChildren(...data.ranking.map((item) => {
      const row = document.createElement("tr");
      const rankCell = document.createElement("td"); rankCell.textContent = item.rank ?? "—";
      if (!item.available) { const marker = document.createElement("span"); marker.className = "file-missing"; marker.textContent = " объект недоступен"; rankCell.append(marker); }
      const nameCell = document.createElement("td"); nameCell.textContent = item.name;
      const mediaCell = document.createElement("td");
      if (item.primary_media && item.primary_media.image_url && item.primary_media.exists) {
        mediaCell.innerHTML = `<img src="${item.primary_media.image_url}" alt="${escapeHtml(item.name)}" class="rank-img">`;
      } else {
        mediaCell.textContent = item.media_count > 0 ? "медиа недоступно" : "—";
      }
      const descCell = document.createElement("td"); descCell.innerHTML = sanitizeHtml(item.description || "") || '<span class="hint">—</span>';
      const ratingCell = document.createElement("td"); ratingCell.textContent = item.rating;
      const gamesCell = document.createElement("td"); gamesCell.textContent = `${item.wins} / ${item.games}`;
      const uncertCell = document.createElement("td"); uncertCell.textContent = item.uncertainty;
      [rankCell, nameCell, mediaCell, descCell, ratingCell, gamesCell, uncertCell].forEach(c => row.appendChild(c));
      const action = document.createElement("td");
      const button = document.createElement("button");
      button.className = "danger delete-item";
      button.textContent = item.available ? "Удалить медиа и историю" : "Удалить историю";
      button.addEventListener("click", () => deleteItem(item.item_id, item.available));
      action.appendChild(button);
      row.appendChild(action);
      return row;
    }));
    const rankingSection = $("ranking");
    if (rankingSection) rankingSection.hidden = false;
    if (scroll && rankingSection) rankingSection.scrollIntoView({ behavior: "smooth" });
  } catch (error) { message(error.message, true); }
}

// переключатель объектов: свернуть / развернуть
if ($("toggle-objects")) {
  const toggleBtn = $("toggle-objects");
  const objectsSection = $("objects-section");
  toggleBtn.addEventListener("click", () => {
    const isHidden = objectsSection.hidden;
    objectsSection.hidden = !isHidden;
    toggleBtn.textContent = isHidden ? "Свернуть" : "Развернуть";
  });
}

if ($("skip-button")) $("skip-button").addEventListener("click", () => choose("skip"));
if ($("undo-button")) $("undo-button").addEventListener("click", async () => {
  try {
    const data = await api("/api/undo", { method: "POST" });
    setSummary(data.stats);
    message(data.undone ? "Последнее действие отменено." : "Отменять пока нечего.");
    await loadPair(); await loadObjects();
  } catch (error) { message(error.message, true); }
});
if ($("ranking-button")) $("ranking-button").addEventListener("click", showRanking);
if ($("close-ranking")) $("close-ranking").addEventListener("click", () => { const r = $("ranking"); if (r) r.hidden = true; });
if ($("reset-button")) $("reset-button").addEventListener("click", async () => {
  if (!confirm("Сбросить всю историю сравнений? Это нельзя отменить.")) return;
  await api("/api/reset", { method: "POST" });
  const r = $("ranking"); if (r) r.hidden = true;
  message("История сравнений сброшена.");
  await loadPair(); await loadObjects();
});
document.addEventListener("keydown", (event) => {
  if (event.target.tagName === "INPUT" || event.target.tagName === "TEXTAREA") return;
  if (event.key === "ArrowLeft") choose("left");
  if (event.key === "ArrowRight") choose("right");
  if (event.code === "Space") { event.preventDefault(); choose("skip"); }
  if (event.key.toLowerCase() === "z") { const b = $("undo-button"); if (b) b.click(); }
});

api("/api/state").then(data => { setSummary(data); loadPair(); loadObjects(); }).catch(error => message(error.message, true));
