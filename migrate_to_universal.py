#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Миграция tierlist_app со старой версии (только изображения, content_hash)
на универсальную версию (объекты с названием, описанием, опциональным медиа).

Что делает скрипт:
  1. Делает бэкап старой БД tierlist.sqlite3.
  2. Читает старую схему: items(content_hash, ...), item_paths(...), interactions(...).
  3. Читает названия из C:\goods\author_today_export\author_today_biblioteka.xlsx
     (столбец A, пропуская заголовок).
  4. Для каждого старого объекта подбирает название:
       - точное совпадение имени файла (без расширения) с названием из Excel;
       - иначе частичное совпадение;
       - иначе оставляет исходное имя файла.
  5. Создаёт новую БД с универсальной схемой, переносит объекты, медиа-пути
     и всю историю сравнений (журнал interactions), сопоставляя старые
     content_hash с новыми item_id.
  6. Пересчитывает рейтинги в новой БД.

Запуск:
    python migrate_to_universal.py
"""

from __future__ import annotations

import os
import shutil
import sqlite3
import sys
import uuid
from datetime import datetime, timezone
from pathlib import Path

try:
    from openpyxl import load_workbook
except ImportError as exc:
    sys.exit(f"Ошибка: не установлен модуль openpyxl. Установите: pip install openpyxl ({exc})")

# ---------------------------------------------------------------- пути

APP_DIR = Path(r"C:\goods\tierlist_app")
DATA_DIR = APP_DIR / "data"
OLD_DB = DATA_DIR / "tierlist.sqlite3"
NEW_DB = DATA_DIR / "tierlist.sqlite3"  # перезаписывается после бэкапа
BACKUP_DIR = DATA_DIR / "migration_backups"

EXCEL_FILE = Path(r"C:\goods\author_today_export\author_today_biblioteka.xlsx")

INITIAL_RATING = 0.0


def now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


# ---------------------------------------------------------------- чтение Excel

def read_book_titles(excel_path: Path) -> list[str]:
    """Возвращает список названий из первого столбца Excel (без заголовка)."""
    if not excel_path.exists():
        print(f"ВНИМАНИЕ: файл не найден: {excel_path}. Названия будут взяны из имён файлов.")
        return []
    wb = load_workbook(excel_path, read_only=True, data_only=True)
    ws = wb.active
    titles = []
    for row in ws.iter_rows(min_row=2, values_only=True):  # пропускаем заголовок
        if row and row[0] is not None:
            title = str(row[0]).strip()
            if title:
                titles.append(title)
    wb.close()
    print(f"Прочитано названий из Excel: {len(titles)}")
    return titles


def match_title(filename_no_ext: str, titles: list[str]) -> str | None:
    """Подбирает название из Excel по имени файла без расширения."""
    key = filename_no_ext.strip().lower()
    if not key:
        return None
    # 1) точное совпадение (без учёта регистра)
    for t in titles:
        if t.strip().lower() == key:
            return t.strip()
    # 2) частичное: одно содержит другое
    for t in titles:
        tl = t.strip().lower()
        if key in tl or tl in key:
            return t.strip()
    return None


# ---------------------------------------------------------------- чтение старой БД

def read_old_state(db_path: Path):
    """Читает объекты, медиа-пути и взаимодействия из старой БД.

    Возвращает:
      items: list of dict(content_hash, filename, active, path, size, mtime_ns)
      interactions: list of dict(left_hash, right_hash, winner_hash, decision, created_at)
    """
    if not db_path.exists():
        sys.exit(f"Старая БД не найдена: {db_path}")
    con = sqlite3.connect(str(db_path))
    con.row_factory = sqlite3.Row

    # Проверяем, есть ли хотя бы таблица items (существует ли старая схема)
    tables = {r["name"] for r in con.execute("SELECT name FROM sqlite_master WHERE type='table'")}
    if "items" not in tables:
        con.close()
        sys.exit("В старой БД не найдена таблица items — похоже, уже новая схема.")

    # items: берём content_hash + активность
    items = []
    for r in con.execute("SELECT content_hash, active FROM items").fetchall():
        items.append({
            "content_hash": r["content_hash"],
            "active": bool(r["active"]),
        })

    # filename + путь к файлу для каждого content_hash
    hash_to_file = {}
    for r in con.execute(
        "SELECT content_hash, filename, path, size, mtime_ns, active FROM item_paths ORDER BY active DESC, last_seen DESC"
    ).fetchall():
        ch = r["content_hash"]
        if ch not in hash_to_file:
            hash_to_file[ch] = {
                "filename": r["filename"],
                "path": r["path"],
                "size": r["size"],
                "mtime_ns": r["mtime_ns"],
                "active": bool(r["active"]),
            }
    for it in items:
        f = hash_to_file.get(it["content_hash"], {})
        it["filename"] = f.get("filename", it["content_hash"][:8])
        it["path"] = f.get("path")
        it["size"] = f.get("size")
        it["mtime_ns"] = f.get("mtime_ns")

    # взаимодействия
    interactions = []
    for r in con.execute(
        "SELECT left_hash, right_hash, winner_hash, decision, created_at FROM interactions ORDER BY id"
    ).fetchall():
        interactions.append({
            "left_hash": r["left_hash"],
            "right_hash": r["right_hash"],
            "winner_hash": r["winner_hash"],
            "decision": r["decision"],
            "created_at": r["created_at"],
        })

    con.close()
    return items, interactions


# ---------------------------------------------------------------- новая схема

NEW_SCHEMA = """
CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS items (
  item_id TEXT PRIMARY KEY,
  content_hash TEXT,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  rating REAL NOT NULL DEFAULT 0,
  games INTEGER NOT NULL DEFAULT 0,
  wins INTEGER NOT NULL DEFAULT 0,
  first_seen TEXT NOT NULL,
  last_seen TEXT NOT NULL,
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS item_media (
  media_id TEXT PRIMARY KEY,
  item_id TEXT NOT NULL REFERENCES items(item_id) ON DELETE CASCADE,
  path TEXT NOT NULL UNIQUE,
  kind TEXT NOT NULL DEFAULT 'image',
  filename TEXT NOT NULL,
  suffix TEXT NOT NULL,
  size INTEGER NOT NULL,
  mtime_ns INTEGER NOT NULL,
  last_seen TEXT NOT NULL,
  active INTEGER NOT NULL DEFAULT 1
);
CREATE INDEX IF NOT EXISTS idx_item_media_item ON item_media(item_id);
CREATE INDEX IF NOT EXISTS idx_item_media_path ON item_media(path);
CREATE TABLE IF NOT EXISTS interactions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  left_id TEXT NOT NULL REFERENCES items(item_id),
  right_id TEXT NOT NULL REFERENCES items(item_id),
  winner_id TEXT REFERENCES items(item_id),
  decision TEXT NOT NULL CHECK(decision IN ('win', 'skip')),
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_interactions_created ON interactions(id DESC);
"""


def migrate():
    # 0. бэкап
    BACKUP_DIR.mkdir(parents=True, exist_ok=True)
    if OLD_DB.exists():
        stamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        backup_path = BACKUP_DIR / f"tierlist.sqlite3.{stamp}.bak"
        shutil.copy2(OLD_DB, backup_path)
        print(f"Бэкап старой БД: {backup_path}")

    titles = read_book_titles(EXCEL_FILE)

    # 1. читаем старое
    old_items, old_interactions = read_old_state(OLD_DB)
    print(f"Старых объектов: {len(old_items)}, взаимодействий: {len(old_interactions)}")

    # 2. создаём новую БД
    if NEW_DB.exists():
        NEW_DB.unlink()  # начинаем с чистого листа (бэкап уже сделан)
    con = sqlite3.connect(str(NEW_DB))
    con.row_factory = sqlite3.Row
    con.execute("PRAGMA foreign_keys = ON")
    con.executescript(NEW_SCHEMA)
    con.commit()

    hash_to_new_id: dict[str, str] = {}
    timestamp = now()

    # 3. переносим объекты + медиа
    for it in old_items:
        ch = it["content_hash"]
        filename = it["filename"]
        name = match_title(Path(filename).stem, titles) or filename
        item_id = uuid.uuid4().hex
        con.execute(
            """INSERT INTO items(item_id, content_hash, name, description,
                                 first_seen, last_seen, active, created_at, updated_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (item_id, ch, name, "", timestamp, timestamp, 1 if it["active"] else 0, timestamp, timestamp),
        )
        # привязываем медиа-путь (ссылка на файл, не копируем сам файл)
        media_path = it.get("path")
        if media_path:
            p = Path(media_path)
            media_id = uuid.uuid4().hex
            suffix = p.suffix.lower()
            con.execute(
                """INSERT INTO item_media(media_id, item_id, path, kind, filename,
                                         suffix, size, mtime_ns, last_seen, active)
                   VALUES (?, ?, ?, 'image', ?, ?, ?, ?, ?, 1)""",
                (media_id, item_id, str(p.resolve()), p.name, suffix,
                 it.get("size") or 0, it.get("mtime_ns") or 0, timestamp),
            )
        hash_to_new_id[ch] = item_id

    con.commit()
    print(f"Перенесено объектов: {len(hash_to_new_id)}")

    # 4. переносим взаимодействия
    transferred = 0
    skipped = 0
    for inter in old_interactions:
        left_id = hash_to_new_id.get(inter["left_hash"])
        right_id = hash_to_new_id.get(inter["right_hash"])
        winner_id = hash_to_new_id.get(inter["winner_hash"]) if inter["winner_hash"] else None
        if not left_id or not right_id:
            skipped += 1
            continue
        con.execute(
            """INSERT INTO interactions(left_id, right_id, winner_id, decision, created_at)
               VALUES (?, ?, ?, ?, ?)""",
            (left_id, right_id, winner_id, inter["decision"], inter["created_at"]),
        )
        transferred += 1
    con.commit()
    print(f"Перенесено взаимодействий: {transferred}, пропущено (объект не найден): {skipped}")

    # 5. пересчитываем рейтинги
    ids = [r[0] for r in con.execute("SELECT item_id FROM items").fetchall()]
    ratings = {i: INITIAL_RATING for i in ids}
    games = {i: 0 for i in ids}
    wins = {i: 0 for i in ids}

    import math

    def probability(a, b):
        delta = max(-35.0, min(35.0, a - b))
        return 1.0 / (1.0 + math.exp(-delta))

    rows = con.execute(
        "SELECT left_id, right_id, winner_id FROM interactions WHERE decision='win' ORDER BY id"
    ).fetchall()
    for row in rows:
        left, right, winner = row["left_id"], row["right_id"], row["winner_id"]
        if left not in ratings or right not in ratings:
            continue
        p_left = probability(ratings[left], ratings[right])
        k_left = 0.9 / math.sqrt(1.0 + 0.15 * games[left])
        k_right = 0.9 / math.sqrt(1.0 + 0.15 * games[right])
        error = (1.0 if winner == left else 0.0) - p_left
        ratings[left] += k_left * error
        ratings[right] -= k_right * error
        games[left] += 1
        games[right] += 1
        if winner:
            wins[winner] += 1

    con.executemany(
        "UPDATE items SET rating=?, games=?, wins=? WHERE item_id=?",
        [(ratings[i], games[i], wins[i], i) for i in ids],
    )
    con.commit()
    con.close()

    print("Миграция завершена. Новая БД:", NEW_DB)
    print("Теперь можно запускать приложение: python -m tierlist_app")


if __name__ == "__main__":
    migrate()
