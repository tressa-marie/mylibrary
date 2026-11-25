// Run after: dotnet build backend/MyLibrary.Api --configuration Verification
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';
import { DatabaseSync } from 'node:sqlite';

const directory = mkdtempSync(join(tmpdir(), 'mylibrary-migration-'));
const database = join(directory, 'library.db');
const initial = '20261006000559_InitialLibrary';
function migrate(target) {
  execFileSync('dotnet', ['ef', 'database', 'update', target,
    '--project', resolve('backend/MyLibrary.Api'), '--configuration', 'Verification',
    '--no-build', '--connection', `Data Source=${database}`],
  { windowsHide: true, stdio: 'pipe' });
}
function inspect(check) {
  const db = new DatabaseSync(database);
  try { check(db); } finally { db.close(); }
}
const original = {
  Id: 'D81FBD37-49A8-47B9-BEFF-77223DA6C40B', SourceBookId: 'test-volume',
  Title: 'Existing book', Author: 'Existing author', Isbn: '9781784702861',
  Description: 'Existing description', CoverUrl: '/api/books/test-volume/cover',
  Format: 'Paperback', AuthorGender: 'other', IsRead: 1, Rating: 8.5,
  PurchaseLocation: 'Bookshop', PublicationYear: 2020, Publisher: 'Publisher',
  Edition: 'First', PageCount: 240, CreatedAtUtc: '2026-10-06 00:00:00+00:00',
};
try {
  migrate(initial);
  inspect(db => {
    const columns = Object.keys(original);
    db.prepare(`INSERT INTO OwnedBooks (${columns.join(',')}) VALUES (${columns.map(() => '?').join(',')})`)
      .run(...Object.values(original));
  });
  migrate('NormalizeLibraryBooks');
  inspect(db => {
    assert.equal(db.prepare('SELECT COUNT(*) AS count FROM Books').get().count, 1);
    assert.equal(db.prepare('SELECT COUNT(*) AS count FROM Editions').get().count, 1);
    const row = db.prepare(`SELECT o.Id, e.SourceBookId, b.Title, b.Author, e.Isbn,
      b.Description, e.CoverUrl, e.Format, b.AuthorGender, o.IsRead, o.Rating,
      o.PurchaseLocation, e.PublicationYear, e.Publisher, e.EditionName AS Edition,
      e.PageCount, o.CreatedAtUtc FROM OwnedBooks o
      JOIN Editions e ON o.EditionId = e.Id JOIN Books b ON e.BookId = b.Id`).get();
    assert.deepEqual({ ...row }, original);
    assert.deepEqual(db.prepare('PRAGMA foreign_key_check').all(), []);
    assert.throws(() => db.prepare('DELETE FROM Books').run(), /FOREIGN KEY/);
    assert.throws(() => db.prepare('DELETE FROM Editions').run(), /FOREIGN KEY/);
  });
  migrate(initial);
  inspect(db => assert.deepEqual({ ...db.prepare('SELECT * FROM OwnedBooks').get() }, original));
  migrate('NormalizeLibraryBooks');
  inspect(db => assert.deepEqual(db.prepare('PRAGMA foreign_key_check').all(), []));
  migrate('AddGenreAndShelfLocation');
  inspect(db => {
    const row = db.prepare(`SELECT b.Title, b.Genre, o.ShelfLocation
      FROM OwnedBooks o JOIN Editions e ON o.EditionId = e.Id
      JOIN Books b ON e.BookId = b.Id`).get();
    assert.deepEqual({ ...row }, { Title: original.Title, Genre: null, ShelfLocation: null });
    assert.deepEqual(db.prepare('PRAGMA foreign_key_check').all(), []);
  });
  console.log('PASS: existing records survive upgrade, rollback, and reapplication; foreign keys protect relationships.');
} finally {
  assert.equal(dirname(resolve(directory)), resolve(tmpdir()));
  assert.ok(basename(directory).startsWith('mylibrary-migration-'));
  rmSync(directory, { recursive: true, force: true });
}
