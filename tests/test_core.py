import shutil
import tempfile
import unittest
from pathlib import Path

from PIL import Image

from tierlist_app.core import TierListStore, probability


class StoreTests(unittest.TestCase):
    def setUp(self):
        self.tmp = Path(tempfile.mkdtemp())
        self.images = self.tmp / "images"
        self.images.mkdir()
        self.store = TierListStore(self.tmp / "state.sqlite3")

    def tearDown(self):
        self.store.close()
        shutil.rmtree(self.tmp)

    def image(self, name, color):
        Image.new("RGB", (12, 12), color).save(self.images / name)

    def test_add_item_with_name_and_description(self):
        item_id = self.store.add_item("Книга А", 'Описание <a href="https://example.com">ссылка</a>')
        item = self.store.get_item(item_id)
        self.assertIsNotNone(item)
        self.assertEqual(item["name"], "Книга А")
        self.assertIn("example.com", item["description"])
        self.assertEqual(item["media_count"], 0)
        self.assertTrue(item["active"])

    def test_add_item_empty_name_raises(self):
        with self.assertRaises(ValueError):
            self.store.add_item("")

    def test_update_item(self):
        item_id = self.store.add_item("Книга А", "")
        self.store.update_item(item_id, name="Книга Б", description="новое описание <b>жирный</b>")
        item = self.store.get_item(item_id)
        self.assertEqual(item["name"], "Книга Б")
        self.assertEqual(item["description"], "новое описание <b>жирный</b>")

    def test_delete_item(self):
        item_id = self.store.add_item("Книга А", "")
        self.store.delete_item(item_id, delete_files=False)
        self.assertIsNone(self.store.get_item(item_id))

    def test_sync_folder_creates_items_from_images(self):
        self.image("first.png", "red")
        self.image("second.png", "blue")
        result = self.store.sync_folder(self.images)
        self.assertEqual(result.added, 2)
        self.assertEqual(result.found, 2)
        items = self.store.list_items()
        self.assertEqual(len(items), 2)
        names = {it["name"] for it in items}
        self.assertEqual(names, {"first.png", "second.png"})
        # Каждый объект получил медиа-запись
        for it in items:
            self.assertEqual(it["media_count"], 1)
            self.assertIsNotNone(it["primary_media"])

    def test_sync_folder_duplicates_by_content(self):
        self.image("first.png", "red")
        self.store.sync_folder(self.images)
        shutil.copy2(self.images / "first.png", self.images / "copy.png")
        result = self.store.sync_folder(self.images)
        self.assertEqual(result.found, 2)
        items = self.store.list_items()
        self.assertEqual(len(items), 1)
        self.assertEqual(items[0]["media_count"], 2)

    def test_sync_folder_rename_preserves_item(self):
        self.image("first.png", "red")
        self.store.sync_folder(self.images)
        item = self.store.list_items()[0]
        original_id = item["item_id"]
        (self.images / "first.png").rename(self.images / "renamed.png")
        self.store.sync_folder(self.images)
        items = self.store.list_items()
        self.assertEqual(len(items), 1)
        self.assertEqual(items[0]["item_id"], original_id)
        self.assertEqual(items[0]["name"], "renamed.png")

    def test_decision_undo_and_reset_replay_history(self):
        self.image("a.png", "red")
        self.image("b.png", "blue")
        self.store.sync_folder(self.images)
        items = self.store.list_items()
        left, right = items[0]["item_id"], items[1]["item_id"]
        self.store.record_decision(left, right, "left")
        ranked = self.store.ranking()
        self.assertGreater(ranked[0]["rating"], ranked[1]["rating"])
        self.assertEqual(self.store.stats()["comparisons"], 1)
        self.assertTrue(self.store.undo())
        self.assertEqual(self.store.stats()["comparisons"], 0)
        self.assertTrue(all(row["rating"] == 0 for row in self.store.ranking()))
        self.store.record_decision(left, right, "skip")
        self.assertEqual(self.store.stats()["skips"], 1)
        self.store.reset()
        self.assertEqual(self.store.stats()["skips"], 0)

    def test_deleted_file_is_inactive_but_history_can_return(self):
        self.image("a.png", "red")
        self.image("b.png", "blue")
        self.store.sync_folder(self.images)
        saved = {row["name"]: row["item_id"] for row in self.store.ranking()}
        (self.images / "b.png").unlink()
        result = self.store.sync_folder(self.images)
        self.assertEqual(result.unavailable, 1)
        self.assertEqual(len(self.store.ranking()), 1)
        self.image("again.png", "blue")
        self.store.sync_folder(self.images)
        restored = {row["name"]: row["item_id"] for row in self.store.ranking()}
        self.assertEqual(restored["again.png"], saved["b.png"])

    def test_remove_missing_item_history_recalculates_remaining_items(self):
        self.image("a.png", "red")
        self.image("b.png", "blue")
        self.store.sync_folder(self.images)
        items = self.store.list_items()
        left, right = items[0]["item_id"], items[1]["item_id"]
        self.store.record_decision(left, right, "left")
        missing_id = right
        (self.images / "b.png").unlink()
        self.store.sync_folder(self.images)
        self.assertEqual(len(self.store.ranking(include_inactive=True)), 2)
        self.assertEqual(self.store.delete_item(missing_id, delete_files=False), 0)
        self.assertEqual(len(self.store.ranking(include_inactive=True)), 1)
        self.assertEqual(self.store.stats()["comparisons"], 0)
        self.assertEqual(self.store.ranking()[0]["rating"], 0)

    def test_remove_available_item_requires_file_deletion(self):
        self.image("a.png", "red")
        self.image("b.png", "blue")
        self.store.sync_folder(self.images)
        hash_a = next(row["item_id"] for row in self.store.ranking() if row["name"] == "a.png")
        with self.assertRaises(ValueError):
            self.store.delete_item(hash_a, delete_files=False)
        self.assertEqual(self.store.delete_item(hash_a, delete_files=True), 1)
        self.assertFalse((self.images / "a.png").exists())
        self.assertEqual(len(self.store.ranking()), 1)

    def test_probability_prefers_equal_ratings_as_informative(self):
        self.assertAlmostEqual(probability(0, 0), 0.5)
        self.assertGreater(probability(2, 0), probability(0, 2))


if __name__ == "__main__":
    unittest.main()
