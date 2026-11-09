"""HTTP-интерфейс локального приложения (универсальный тир-лист объектов)."""

from __future__ import annotations

import argparse
import io
import json
import os
import shutil
import zipfile
from contextlib import asynccontextmanager
from pathlib import Path
from uuid import uuid4

import uvicorn
from fastapi import FastAPI, HTTPException, UploadFile, File
from fastapi.responses import FileResponse, StreamingResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

from .core import TierListStore, is_valid_image, SUPPORTED_SUFFIXES, now


def data_directory() -> Path:
    configured = os.environ.get("TIERLIST_DATA_DIR")
    root = Path(configured) if configured else Path(__file__).resolve().parent.parent / "data"
    root.mkdir(parents=True, exist_ok=True)
    return root


store = TierListStore(data_directory() / "tierlist.sqlite3")
uploads_dir = data_directory() / "uploads"
uploads_dir.mkdir(parents=True, exist_ok=True)


@asynccontextmanager
async def lifespan(_: FastAPI):
    yield
    store.close()


app = FastAPI(title="Локальный тир-лист объектов", lifespan=lifespan)
app.mount("/static", StaticFiles(directory=Path(__file__).parent / "static"), name="static")


# ---------------------------------------------------------------- request models

class ChoiceRequest(BaseModel):
    left_id: str
    right_id: str
    choice: str


class ItemCreateRequest(BaseModel):
    name: str
    description: str = ""


class ItemUpdateRequest(BaseModel):
    name: str | None = None
    description: str | None = None


class BatchCreateRequest(BaseModel):
    items: list[ItemCreateRequest] = Field(default_factory=list)


class DeleteItemRequest(BaseModel):
    delete_files: bool = False
    confirmed: bool = False


# ---------------------------------------------------------------- payload helpers

def media_payload(media: dict) -> dict:
    return {
        "media_id": media["media_id"],
        "path": media["path"],
        "kind": media["kind"],
        "filename": media["filename"],
        "exists": media["exists"],
        "image_url": media.get("image_url"),
        "mime_type": media.get("mime_type"),
    }


def item_from_row(row) -> dict:
    """Превращает строку item и медиа в словарь для ответа API."""
    d = dict(row)
    media = store.item_media_rows(row["item_id"])
    primary = media[0] if media else None
    return {
        "item_id": row["item_id"],
        "name": row["name"],
        "description": d.get("description", "") or "",
        "rating": round(row["rating"], 3),
        "games": row["games"],
        "wins": row["wins"],
        "media_count": len(media),
        "primary_media": media_payload(primary) if primary else None,
        "media": [media_payload(m) for m in media],
        "available": bool(row["active"]),
    }


# ---------------------------------------------------------------- pages & state

@app.get("/")
def home():
    return FileResponse(Path(__file__).parent / "static" / "index.html")


@app.get("/api/state")
def state():
    return store.stats()


# ---------------------------------------------------------------- items CRUD

@app.get("/api/items")
def items():
    return {"items": [item_from_row(r) for r in store.list_items()], "stats": store.stats()}


@app.get("/api/item/{item_id}")
def get_item(item_id: str):
    item = store.get_item(item_id)
    if item is None:
        raise HTTPException(404, "Объект не найден")
    return {"item": item_from_row(item), "stats": store.stats()}


@app.post("/api/item")
def create_item(request: ItemCreateRequest):
    try:
        item_id = store.add_item(request.name, request.description)
    except ValueError as exc:
        raise HTTPException(400, str(exc)) from exc
    return {"ok": True, "item_id": item_id, "stats": store.stats()}


@app.post("/api/items/batch")
def batch_create_items(request: BatchCreateRequest):
    """Создаёт несколько объектов за один запрос (для импорта из текста)."""
    created = []
    errors = []
    for item_req in request.items:
        try:
            item_id = store.add_item(item_req.name, item_req.description)
            created.append({"item_id": item_id, "name": item_req.name})
        except ValueError as exc:
            errors.append({"name": item_req.name, "error": str(exc)})
    return {"ok": True, "created": created, "errors": errors, "stats": store.stats()}


@app.put("/api/item/{item_id}")
def update_item(item_id: str, request: ItemUpdateRequest):
    try:
        store.update_item(item_id, request.name, request.description)
    except ValueError as exc:
        raise HTTPException(400, str(exc)) from exc
    return {"ok": True, "stats": store.stats()}


@app.post("/api/media/upload")
async def upload_media(file: UploadFile = File(...), item_id: str | None = None):
    """Прикрепляет загруженный файл к объекту (создаёт новый объект, если item_id не передан)."""
    suffix = Path(file.filename or "").suffix.lower()
    if suffix not in SUPPORTED_SUFFIXES:
        raise HTTPException(400, f"Неподдерживаемый тип файла: {suffix or 'без расширения'}")
    if item_id is None:
        name = Path(file.filename or "").stem or "Объект"
        item_id = store.add_item(name, "")
    if store.get_item(item_id) is None:
        raise HTTPException(404, "Объект не найден")
    dest = uploads_dir / f"{uuid4().hex}{suffix}"
    try:
        with dest.open("wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
    finally:
        file.file.close()
    if not is_valid_image(dest):
        dest.unlink(missing_ok=True)
        raise HTTPException(400, "Файл не является допустимым изображением")
    store._attach_media(item_id, dest, now())
    store.db.commit()
    return {"ok": True, "item_id": item_id, "stats": store.stats()}


@app.delete("/api/item/{item_id}")
def delete_item(item_id: str, request: DeleteItemRequest):
    if not request.confirmed:
        raise HTTPException(400, "Удаление должно быть подтверждено")
    try:
        deleted_files = store.delete_item(item_id, request.delete_files)
    except ValueError as exc:
        raise HTTPException(400, str(exc)) from exc
    return {"ok": True, "deleted_files": deleted_files, "stats": store.stats()}


# ---------------------------------------------------------------- export / import

@app.get("/api/export")
def export_tierlist(include_comparisons: bool = True):
    """Экспорт тир-листа в .zip (расширение .tierl).

    Архив содержит:
      data.json   — метаданные объектов и (опционально) история сравнений
      media/      — файлы картинок объектов
    """
    buf = io.BytesIO()
    items = store.list_items(include_inactive=True)

    interactions = []
    if include_comparisons:
        rows = store.db.execute(
            "SELECT left_id, right_id, winner_id, decision, created_at FROM interactions ORDER BY id"
        ).fetchall()
        interactions = [dict(r) for r in rows]

    export_data = {
        "version": 1,
        "exported_at": now(),
        "include_comparisons": include_comparisons,
        "items": [],
        "interactions": interactions,
    }

    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as zf:
        # Добавляем медиафайлы
        for item in items:
            for m in item.get("media", []):
                if m.get("exists") and m.get("path"):
                    p = Path(m["path"])
                    if p.is_file():
                        zf.write(p, f"media/{p.name}")

        # Сериализуем объекты (без путей к файлам — только имена)
        for item in items:
            item_data = {
                "item_id": item["item_id"],
                "name": item["name"],
                "description": item.get("description", "") or "",
                "media_files": [m["filename"] for m in item.get("media", [])],
            }
            if include_comparisons:
                item_data["rating"] = item["rating"]
                item_data["games"] = item["games"]
                item_data["wins"] = item["wins"]
                item_data["active"] = bool(item["active"])
            export_data["items"].append(item_data)

        zf.writestr("data.json", json.dumps(export_data, ensure_ascii=False, indent=2))

    buf.seek(0)
    filename = "tierlist_export.tierl"
    return StreamingResponse(
        buf,
        media_type="application/zip",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@app.post("/api/import")
async def import_tierlist(replace: bool = True, file: UploadFile = File(...)):
    """Импорт тир-листа из .tierl (.zip) архива.

    Если replace=True (по умолчанию) — удаляет все текущие объекты, медиа и
    сравнения перед загрузкой, то есть работает как «открыть файл».
    """
    content = await file.read()
    buf = io.BytesIO(content)

    try:
        with zipfile.ZipFile(buf) as zf:
            # Читаем data.json
            if "data.json" not in zf.namelist():
                raise HTTPException(400, "Архив не содержит data.json — некорректный файл .tierl")
            data = json.loads(zf.read("data.json").decode("utf-8"))

            if data.get("version") != 1:
                raise HTTPException(400, f"Неподдерживаемая версия файла: {data.get('version')}")

            if replace:
                # Полная зачистка перед загрузкой (как «открыть файл»)
                store.db.execute("DELETE FROM interactions")
                store.db.execute("DELETE FROM item_media")
                store.db.execute("DELETE FROM items")
                store.db.commit()
                # Удаляем старые загруженные файлы
                for f in uploads_dir.iterdir():
                    if f.is_file():
                        try:
                            f.unlink()
                        except OSError:
                            pass

            # Извлекаем медиафайлы в uploads/
            for name in zf.namelist():
                if name.startswith("media/") and not name.endswith("/"):
                    filename = Path(name).name
                    dest = uploads_dir / filename
                    with zf.open(name) as src, dest.open("wb") as dst:
                        shutil.copyfileobj(src, dst)

            # Создаём объекты
            id_map: dict[str, str] = {}
            timestamp = now()
            for item_data in data.get("items", []):
                actual_item_id = store.add_item(
                    item_data["name"],
                    item_data.get("description", ""),
                    content_hash=None,
                )
                id_map[item_data["item_id"]] = actual_item_id
                for mf in item_data.get("media_files", []):
                    src_path = uploads_dir / mf
                    if src_path.exists():
                        store._attach_media(actual_item_id, src_path, timestamp)
                store.db.commit()

            # Восстанавливаем сравнения, если они были в экспорте
            if data.get("include_comparisons") and "interactions" in data:
                for inter in data["interactions"]:
                    left_new = id_map.get(inter["left_id"])
                    right_new = id_map.get(inter["right_id"])
                    winner_new = id_map.get(inter["winner_id"]) if inter.get("winner_id") else None
                    if left_new and right_new:
                        store.db.execute(
                            "INSERT INTO interactions(left_id, right_id, winner_id, decision, created_at) VALUES (?, ?, ?, ?, ?)",
                            (left_new, right_new, winner_new, inter["decision"], inter["created_at"]),
                        )
                store.db.commit()
                store.recompute_ratings()

    except zipfile.BadZipFile:
        raise HTTPException(400, "Файл не является корректным ZIP-архивом (.tierl)")
    except json.JSONDecodeError:
        raise HTTPException(400, "Некорректный data.json внутри архива")

    return {"ok": True, "stats": store.stats()}


# ---------------------------------------------------------------- pairing & decisions

@app.get("/api/pair")
def pair():
    selected = store.choose_pair()
    if selected is None:
        return {"pair": None, "stats": store.stats()}
    left, right = selected
    return {
        "pair": {
            "left": item_from_row(left),
            "right": item_from_row(right),
        },
        "stats": store.stats(),
    }


@app.post("/api/choice")
def choice(request: ChoiceRequest):
    try:
        store.record_decision(request.left_id, request.right_id, request.choice)
    except ValueError as exc:
        raise HTTPException(400, str(exc)) from exc
    return {"ok": True, "stats": store.stats()}


@app.post("/api/undo")
def undo():
    return {"undone": store.undo(), "stats": store.stats()}


@app.post("/api/reset")
def reset():
    store.reset()
    return {"ok": True, "stats": store.stats()}


@app.get("/api/ranking")
def ranking():
    return {"ranking": store.ranking(include_inactive=True), "stats": store.stats()}


@app.get("/api/media/{media_id}")
def media(media_id: str):
    row = store.db.execute(
        "SELECT path, kind FROM item_media WHERE media_id=? AND active=1", (media_id,)
    ).fetchone()
    if row is None:
        raise HTTPException(404, "Медиафайл не найден")
    path = Path(row["path"])
    if not path.is_file():
        raise HTTPException(404, "Файл медиа не найден на диске")
    from .core import MIME_BY_SUFFIX
    media_type = MIME_BY_SUFFIX.get(path.suffix.lower(), "application/octet-stream")
    return FileResponse(path, media_type=media_type, filename=path.name)


def run() -> None:
    parser = argparse.ArgumentParser(description="Локальный тир-лист объектов")
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", default=8000, type=int)
    args = parser.parse_args()
    uvicorn.run(app, host=args.host, port=args.port)


if __name__ == "__main__":
    run()
