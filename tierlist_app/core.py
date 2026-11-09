"""Хранилище, медиа-вложения и онлайн-рейтинг Bradley--Terry.

Универсальное хранилище объектов сравнения: у каждого объекта есть
название, описание (гипертекст) и опциональные медиафайлы (картинки).
Модуль не зависит от FastAPI, поэтому его можно тестировать отдельно.
"""

from __future__ import annotations

import hashlib
import math
import random
import sqlite3
import threading
import uuid
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Iterable

from PIL import Image, UnidentifiedImageError

SUPPORTED_SUFFIXES = {".jpg", ".jpeg", ".png", ".gif", ".webp", ".bmp"}
MIME_BY_SUFFIX = {
    ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png",
    ".gif": "image/gif", ".webp": "image/webp", ".bmp": "image/bmp",
}
INITIAL_RATING = 0.0


def now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def new_id() -> str:
    return uuid.uuid4().hex


def sha256_file(path: Path) -> str:
    """Возвращает SHA-256 содержимого файла, не загружая его целиком в память."""
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for block in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


def is_valid_image(path: Path) -> bool:
    """Проверяет, что файл — декодируемое растровое изображение Pillow."""
    try:
        with Image.open(path) as image:
            image.verify()
        return True
    except (UnidentifiedImageError, OSError, ValueError):
        return False


def probability(rating_a: float, rating_b: float) -> float:
    """Вероятность предпочтения A в модели Bradley--Terry."""
    delta = max(-35.0, min(35.0, rating_a - rating_b))
    return 1.0 / (1.0 + math.exp(-delta))


@dataclass(frozen=True)
class SyncResult:
    folder: str
    found: int
    added: int
    restored: int
    unavailable: int
    ignored: int


class TierListStore:
    """SQLite-хранилище и доменная логика приложения.

    Каждый объект сравнения (item) имеет ``item_id``, ``name``,
    опциональное ``description`` (гипертекст/HTML) и ноль или более
    медиафайлов (``item_media``). Картинка больше не обязательна —
    объект может существовать только как текст.
    """

    def __init__(self, database_path: str | Path):
        self.database_path = str(database_path)
        self.db = sqlite3.connect(self.database_path, check_same_thread=False, timeout=30)
        self.db.row_factory = sqlite3.Row
        self.db.execute("PRAGMA foreign_keys = ON")
        self.db.execute("PRAGMA journal_mode = WAL")
        self._lock = threading.Lock()
        self._create_schema()

    def close(self) -> None:
        self.db.close()

    # ------------------------------------------------------------------ schema

    def _create_schema(self) -> None:
        self.db.executescript(
            """
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
        )
        self.db.commit()

    # ------------------------------------------------------------------ settings

    def _set_setting(self, key: str, value: str) -> None:
        self.db.execute(
            "INSERT INTO settings(key, value) VALUES (?, ?) "
            "ON CONFLICT(key) DO UPDATE SET value=excluded.value", (key, value)
        )

    def setting(self, key: str) -> str | None:
        row = self.db.execute("SELECT value FROM settings WHERE key=?", (key,)).fetchone()
        return row["value"] if row else None

    # ------------------------------------------------------------------ items (CRUD)

    @staticmethod
    def _within(root: Path, path: Path) -> bool:
        try:
            path.resolve().relative_to(root.resolve())
            return True
        except ValueError:
            return False

    def add_item(
        self,
        name: str,
        description: str = "",
        media_paths: Iterable[str | Path] | None = None,
        content_hash: str | None = None,
    ) -> str:
        """Создаёт объект и опционально привязывает к нему медиафайлы.

        Возвращает ``item_id`` нового объекта.
        """
        name = name.strip()
        if not name:
            raise ValueError("Название не может быть пустым")
        timestamp = now()
        item_id = new_id()
        self.db.execute(
            """INSERT INTO items(item_id, content_hash, name, description, first_seen, last_seen,
                                 active, created_at, updated_at)
               VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?)""",
            (item_id, content_hash, name, description, timestamp, timestamp, timestamp, timestamp),
        )
        if media_paths:
            for media_path in media_paths:
                self._attach_media(item_id, media_path, timestamp)
        self.db.commit()
        return item_id

    def _attach_media(self, item_id: str, media_path: str | Path, timestamp: str) -> None:
        resolved = Path(media_path).expanduser().resolve()
        if not resolved.is_file():
            return
        if resolved.suffix.lower() not in MIME_BY_SUFFIX and not is_valid_image(resolved):
            # Неизвестный тип медиа — всё равно фиксируем путь, kind определим ниже
            pass
        stat = resolved.stat()
        suffix = resolved.suffix.lower()
        kind = "image" if suffix in MIME_BY_SUFFIX else "file"
        media_id = new_id()
        self.db.execute(
            """INSERT INTO item_media(media_id, item_id, path, kind, filename, suffix,
                                     size, mtime_ns, last_seen, active)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1)""",
            (media_id, item_id, str(resolved), kind, resolved.name, suffix,
             stat.st_size, stat.st_mtime_ns, timestamp),
        )

    def update_item(self, item_id: str, name: str | None = None,
                    description: str | None = None) -> None:
        """Обновляет название и/или описание объекта."""
        fields = []
        params: list = []
        if name is not None:
            name = name.strip()
            if not name:
                raise ValueError("Название не может быть пустым")
            fields.append("name=?")
            params.append(name)
        if description is not None:
            fields.append("description=?")
            params.append(description)
        if not fields:
            return
        fields.append("updated_at=?")
        params.append(now())
        params.append(item_id)
        self.db.execute(
            f"UPDATE items SET {', '.join(fields)} WHERE item_id=?", params
        )
        if self.db.total_changes == 0:
            raise ValueError("Объект не найден")
        self.db.commit()

    def get_item(self, item_id: str) -> dict | None:
        row = self.db.execute(
            """SELECT i.*,
                      (SELECT count(*) FROM item_media m
                       WHERE m.item_id=i.item_id AND m.active=1) AS media_count
               FROM items i WHERE i.item_id=?""", (item_id,)
        ).fetchone()
        if row is None:
            return None
        media = self.item_media_rows(item_id)
        return {
            "item_id": row["item_id"],
            "name": row["name"],
            "description": row["description"],
            "rating": round(row["rating"], 3),
            "games": row["games"],
            "wins": row["wins"],
            "first_seen": row["first_seen"],
            "last_seen": row["last_seen"],
            "active": bool(row["active"]),
            "media_count": row["media_count"],
            "media": media,
        }

    def item_media_rows(self, item_id: str) -> list[dict]:
        rows = self.db.execute(
            """SELECT * FROM item_media WHERE item_id=? AND active=1 ORDER BY path""",
            (item_id,),
        ).fetchall()
        result = []
        for row in rows:
            path = Path(row["path"])
            entry = {
                "media_id": row["media_id"],
                "path": row["path"],
                "kind": row["kind"],
                "filename": row["filename"],
                "exists": path.is_file(),
            }
            if row["kind"] == "image" and path.is_file() and is_valid_image(path):
                entry["image_url"] = f"/api/media/{row['media_id']}"
                entry["mime_type"] = MIME_BY_SUFFIX.get(path.suffix.lower(), "application/octet-stream")
            result.append(entry)
        return result

    def primary_media(self, item_id: str) -> dict | None:
        """Возвращает первое активное медиа объекта (обычно основную картинку)."""
        rows = self.item_media_rows(item_id)
        for row in rows:
            if row["kind"] == "image" and row["exists"]:
                return row
        return None

    def delete_item(self, item_id: str, delete_files: bool = False) -> int:
        """Удаляет объект и всю связанную историю.

        ``delete_files=True`` также удаляет прикреплённые файлы с диска.
        Для активного объекта с медиа-файлами обязательно требуется
        ``delete_files=True``: так нельзя случайно стереть рейтинг, оставив
        файлы, которые снова появятся при ближайшей синхронизации.
        """
        exists = self.db.execute("SELECT 1 FROM items WHERE item_id=?", (item_id,)).fetchone()
        if exists is None:
            raise ValueError("Объект уже удалён")
        media_rows = self.db.execute(
            "SELECT path FROM item_media WHERE item_id=? AND active=1", (item_id,)
        ).fetchall()
        if media_rows and not delete_files:
            raise ValueError("Файл ещё существует: подтвердите удаление файла вместе с историей")
        if delete_files:
            for row in media_rows:
                path = Path(row["path"])
                try:
                    if path.exists():
                        path.unlink()
                except OSError as exc:
                    raise ValueError(f"Не удалось удалить файл: {path.name}") from exc
        with self.db:
            self.db.execute(
                "DELETE FROM interactions WHERE left_id=? OR right_id=? OR winner_id=?",
                (item_id, item_id, item_id),
            )
            self.db.execute("DELETE FROM item_media WHERE item_id=?", (item_id,))
            self.db.execute("DELETE FROM items WHERE item_id=?", (item_id,))
        self.recompute_ratings()
        return len(media_rows)

    # ------------------------------------------------------------------ sync folder (legacy image folders)

    def sync_folder(self, folder: str | Path) -> SyncResult:
        """Сканирует папку рекурсивно, создавая объекты из изображений.

        Каждый уникальный файл (по SHA-256) становится объектом с именем,
        равным имени файла. Если объект с таким же content_hash уже есть,
        путь добавляется как дополнительное медиа к тому же объекту.
        """
        root = Path(folder).expanduser()
        if not root.is_dir():
            raise ValueError("Папка не существует или недоступна")
        root = root.resolve()
        timestamp = now()
        added = restored = ignored = found = 0
        seen_paths: set[str] = set()

        # content_hash -> item_id для уже известных объектов с медиа
        content_hash_to_item: dict[str, str] = {}
        for row in self.db.execute(
            "SELECT item_id, content_hash FROM items WHERE content_hash IS NOT NULL"
        ).fetchall():
            content_hash_to_item[row["content_hash"]] = row["item_id"]

        for path in root.rglob("*"):
            try:
                if not path.is_file() or path.suffix.lower() not in SUPPORTED_SUFFIXES:
                    continue
                resolved = path.resolve()
                if not self._within(root, resolved):
                    continue
                path_key = str(resolved)
                seen_paths.add(path_key)
                if not is_valid_image(resolved):
                    ignored += 1
                    continue
                stat = resolved.stat()
                content_hash = sha256_file(resolved)
                existing_item_id = content_hash_to_item.get(content_hash)
                if existing_item_id is None:
                    # Создаём новый объект с именем файла
                    item_id = new_id()
                    self.db.execute(
                        """INSERT INTO items(item_id, content_hash, name, description,
                                             first_seen, last_seen, active, created_at, updated_at)
                           VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?)""",
                        (item_id, content_hash, resolved.name, "", timestamp,
                         timestamp, timestamp, timestamp),
                    )
                    added += 1
                else:
                    item_id = existing_item_id
                    restored += 1
                    # Обновляем имя на текущее имя файла (переименование файла
                    # не должно создаватьduplicate объекта)
                    self.db.execute(
                        "UPDATE items SET name=? WHERE item_id=?", (resolved.name, item_id)
                    )
                self.db.execute(
                    """UPDATE items SET active=1, last_seen=?, updated_at=?
                       WHERE item_id=?""", (timestamp, timestamp, item_id)
                )
                self.db.execute(
                    """INSERT INTO item_media(media_id, item_id, path, kind, filename,
                                             suffix, size, mtime_ns, last_seen, active)
                       VALUES (?, ?, ?, 'image', ?, ?, ?, ?, ?, 1)
                       ON CONFLICT(path) DO UPDATE SET item_id=excluded.item_id,
                         kind=excluded.kind, filename=excluded.filename, suffix=excluded.suffix,
                         size=excluded.size, mtime_ns=excluded.mtime_ns,
                         last_seen=excluded.last_seen, active=1""",
                    (new_id(), item_id, path_key, resolved.name, resolved.suffix.lower(),
                     stat.st_size, stat.st_mtime_ns, timestamp),
                )
                found += 1
            except (OSError, PermissionError):
                ignored += 1

        prior_media = self.db.execute("SELECT path FROM item_media WHERE active=1").fetchall()
        for row in prior_media:
            if row["path"] not in seen_paths:
                self.db.execute("UPDATE item_media SET active=0 WHERE path=?", (row["path"],))

        # Объекты без активного медиа становятся недоступными
        self.db.execute(
            """UPDATE items SET active=0 WHERE item_id IN (
                 SELECT i.item_id FROM items i
                 WHERE NOT EXISTS (SELECT 1 FROM item_media m
                                   WHERE m.item_id=i.item_id AND m.active=1)
               )"""
        )
        self._set_setting("folder", str(root))
        self.db.commit()
        unavailable = self.db.execute("SELECT count(*) FROM items WHERE active=0").fetchone()[0]
        return SyncResult(str(root), found, added, restored, unavailable, ignored)

    # ------------------------------------------------------------------ pairing & decisions

    def _active_rows(self) -> list[sqlite3.Row]:
        return self.db.execute(
            """SELECT i.*,
                      (SELECT count(*) FROM item_media m
                       WHERE m.item_id=i.item_id AND m.active=1) AS media_count
               FROM items i WHERE i.active=1"""
        ).fetchall()

    def _recent_pairs(self, limit: int = 20) -> set[frozenset[str]]:
        rows = self.db.execute(
            "SELECT left_id, right_id FROM interactions ORDER BY id DESC LIMIT ?", (limit,)
        ).fetchall()
        return {frozenset((r["left_id"], r["right_id"])) for r in rows}

    def choose_pair(self) -> tuple[sqlite3.Row, sqlite3.Row] | None:
        """Подбирает информативную пару: близкий рейтинг + мало наблюдений."""
        items = self._active_rows()
        if len(items) < 2:
            return None
        recent = self._recent_pairs()
        candidates: Iterable[tuple[sqlite3.Row, sqlite3.Row]]
        if len(items) <= 100:
            candidates = ((items[a], items[b]) for a in range(len(items)) for b in range(a + 1, len(items)))
        else:
            pairs: set[tuple[int, int]] = set()
            while len(pairs) < min(2500, len(items) * 12):
                a, b = random.sample(range(len(items)), 2)
                pairs.add((min(a, b), max(a, b)))
            candidates = ((items[a], items[b]) for a, b in pairs)
        best: tuple[sqlite3.Row, sqlite3.Row] | None = None
        best_score = -1.0
        for left, right in candidates:
            p = probability(left["rating"], right["rating"])
            closeness = 4.0 * p * (1.0 - p)
            uncertainty = 1 / math.sqrt(left["games"] + 1) + 1 / math.sqrt(right["games"] + 1)
            score = (0.12 + 0.88 * closeness) * uncertainty
            if frozenset((left["item_id"], right["item_id"])) in recent:
                score *= 0.08
            score *= random.uniform(0.72, 1.28)
            if score > best_score:
                best, best_score = (left, right), score
        return best

    def record_decision(self, left_id: str, right_id: str, choice: str) -> None:
        if choice not in {"left", "right", "skip"} or left_id == right_id:
            raise ValueError("Некорректный выбор")
        active = {row[0] for row in self.db.execute(
            "SELECT item_id FROM items WHERE active=1 AND item_id IN (?, ?)", (left_id, right_id)
        )}
        if active != {left_id, right_id}:
            raise ValueError("Один из объектов больше недоступен; синхронизируйте данные")
        winner = None if choice == "skip" else (left_id if choice == "left" else right_id)
        self.db.execute(
            "INSERT INTO interactions(left_id, right_id, winner_id, decision, created_at) VALUES (?, ?, ?, ?, ?)",
            (left_id, right_id, winner, "skip" if winner is None else "win", now()),
        )
        self.db.commit()
        if winner:
            self.recompute_ratings()

    def recompute_ratings(self) -> None:
        """Точно восстанавливает рейтинг из журнала; применяется после undo."""
        ratings: dict[str, float] = {}
        games: dict[str, int] = {}
        wins: dict[str, int] = {}
        ids = [r[0] for r in self.db.execute("SELECT item_id FROM items")]
        for item_id in ids:
            ratings[item_id], games[item_id], wins[item_id] = INITIAL_RATING, 0, 0
        rows = self.db.execute(
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
            wins[winner] += 1
        self.db.executemany(
            "UPDATE items SET rating=?, games=?, wins=? WHERE item_id=?",
            [(ratings[h], games[h], wins[h], h) for h in ids],
        )
        self.db.commit()

    def undo(self) -> bool:
        row = self.db.execute("SELECT id FROM interactions ORDER BY id DESC LIMIT 1").fetchone()
        if row is None:
            return False
        self.db.execute("DELETE FROM interactions WHERE id=?", (row["id"],))
        self.db.commit()
        self.recompute_ratings()
        return True

    def reset(self) -> None:
        self.db.execute("DELETE FROM interactions")
        self.db.execute("UPDATE items SET rating=?, games=0, wins=0", (INITIAL_RATING,))
        self.db.commit()

    # ------------------------------------------------------------------ listing / ranking

    def list_items(self, include_inactive: bool = False) -> list[dict]:
        condition = "" if include_inactive else "WHERE i.active=1"
        rows = self.db.execute(
            f"""SELECT i.*,
                      (SELECT count(*) FROM item_media m
                       WHERE m.item_id=i.item_id AND m.active=1) AS media_count
               FROM items i {condition}
               ORDER BY i.name COLLATE NOCASE"""
        ).fetchall()
        result = []
        for row in rows:
            media = self.item_media_rows(row["item_id"])
            result.append({
                "item_id": row["item_id"],
                "name": row["name"],
                "description": row["description"],
                "rating": round(row["rating"], 3),
                "games": row["games"],
                "wins": row["wins"],
                "active": bool(row["active"]),
                "media_count": row["media_count"],
                "media": media,
                "primary_media": media[0] if media else None,
            })
        return result

    def ranking(self, include_inactive: bool = False) -> list[dict]:
        condition = "" if include_inactive else "WHERE i.active=1"
        rows = self.db.execute(
            f"""SELECT i.*,
                      (SELECT count(*) FROM item_media m
                       WHERE m.item_id=i.item_id AND m.active=1) AS media_count
               FROM items i {condition}
            """
        ).fetchall()
        # сортировка: активные сперва, потом по рейтингу убыв., потом по имени
        rows_list = [dict(r) for r in rows]
        rows_list.sort(key=lambda r: (not bool(r["active"]), -r["rating"], (r["name"] or "").lower()))
        active_rank = 0
        result = []
        for row in rows_list:
            if row["active"]:
                active_rank += 1
            media = self.item_media_rows(row["item_id"])
            result.append({
                "rank": active_rank if row["active"] else None,
                "item_id": row["item_id"],
                "name": row["name"],
                "description": row["description"],
                "rating": round(row["rating"], 3),
                "games": row["games"],
                "wins": row["wins"],
                "media_count": row["media_count"],
                "available": bool(row["active"]),
                "uncertainty": round(1 / math.sqrt(row["games"] + 1), 3),
                "primary_media": media[0] if media else None,
            })
        return result

    def stats(self) -> dict:
        active = self.db.execute("SELECT count(*) FROM items WHERE active=1").fetchone()[0]
        total = self.db.execute("SELECT count(*) FROM interactions WHERE decision='win'").fetchone()[0]
        skips = self.db.execute("SELECT count(*) FROM interactions WHERE decision='skip'").fetchone()[0]
        return {
            "active": active,
            "comparisons": total,
            "skips": skips,
            "folder": self.setting("folder"),
        }
