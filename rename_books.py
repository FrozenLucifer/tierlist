#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Переименует объекты в текущей БД tierlist_app в формат "Название [Автор]"
и добавит в описание гиперссылку на книгу из author_today_biblioteka.xlsx.

Сопоставление объектов и книг происходит по сходству очищенного имени файла
с названием книги (difflib). Если точное совпадение не найдено — берётся
ближайшее по сходству (> 0.5).

Запуск:
    python rename_books.py
"""

from __future__ import annotations

import re
import sqlite3
import uuid
from difflib import SequenceMatcher
from pathlib import Path

try:
    from openpyxl import load_workbook
except ImportError as exc:
    raise SystemExit(f"Нужен модуль openpyxl: pip install openpyxl ({exc})")

DB_PATH = Path(r"C:\goods\tierlist_app\data\tierlist.sqlite3")
EXCEL_PATH = Path(r"C:\goods\author_today_export\author_today_biblioteka.xlsx")


def clean_name(s: str) -> str:
    """Очищает имя файла: убирает расширение, ведущие цифры, подчёркивания, лишние пробелы."""
    s = Path(s).stem  # убираем расширение
    s = re.sub(r"^\d+[_\-\s]*", "", s)  # убираем ведущие номера вида 001_
    s = re.sub(r"[_\-\s]+", " ", s).strip()
    return s


def similarity(a: str, b: str) -> float:
    return SequenceMatcher(None, a.lower(), b.lower()).ratio()


def read_books(excel_path: Path):
    wb = load_workbook(str(excel_path), read_only=True, data_only=True)
    ws = wb.active
    books = []
    for row in ws.iter_rows(min_row=2, values_only=True):
        if row and row[0] is not None:
            title = str(row[0]).strip()
            author = str(row[1]).strip() if row[1] else ""
            url = str(row[2]).strip() if row[2] else ""
            if title:
                books.append({"title": title, "author": author, "url": url})
    wb.close()
    return books


def main():
    if not DB_PATH.exists():
        raise SystemExit(f"БД не найдена: {DB_PATH}")
    if not EXCEL_PATH.exists():
        raise SystemExit(f"Excel не найден: {EXCEL_PATH}")

    books = read_books(EXCEL_PATH)
    print(f"Книг в Excel: {len(books)}")

    con = sqlite3.connect(str(DB_PATH))
    con.row_factory = sqlite3.Row
    objects = con.execute(
        "SELECT item_id, content_hash, name, description FROM items WHERE active=1 ORDER BY name"
    ).fetchall()
    print(f"Объектов в БД: {len(objects)}")

    updated = 0
    unmatched = []

    for obj in objects:
        item_id = obj["item_id"]
        cur_name = obj["name"]
        clean = clean_name(cur_name)

        # Ищем ближайшую книгу по сходству
        best_book = None
        best_score = 0.0
        for book in books:
            score = similarity(clean, book["title"])
            if score > best_score:
                best_score = score
                best_book = book

        if best_book and best_score > 0.5:
            title = best_book["title"]
            author = best_book["author"]
            url = best_book["url"]
            new_name = f"{title} [{author}]" if author else title
            desc = f'Читать на <a href="{url}">Author.Today</a>' if url else ""
            con.execute(
                "UPDATE items SET name=?, description=? WHERE item_id=?",
                (new_name, desc, item_id),
            )
            updated += 1
            print(f"  OK  {cur_name!r} -> {new_name!r} (similarity={best_score:.2f})")
        else:
            unmatched.append(cur_name)
            print(f"  ??  {cur_name!r} (best similarity={best_score:.2f}) — не сопоставлено")

    con.commit()
    con.close()

    print(f"\nОбновлено объектов: {updated}")
    if unmatched:
        print(f"Не сопоставлено ({len(unmatched)}):")
        for n in unmatched:
            print(f"  - {n}")


if __name__ == "__main__":
    main()
