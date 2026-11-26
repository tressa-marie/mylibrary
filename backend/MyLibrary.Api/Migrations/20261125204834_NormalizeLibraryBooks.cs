using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace MyLibrary.Api.Migrations;

public partial class NormalizeLibraryBooks : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        // Backfill metadata before replacing the original flat owned-books table.
        // Existing copy IDs also seed book/edition IDs, preserving every record.
        migrationBuilder.Sql("""
            CREATE TABLE Books (
                Id TEXT NOT NULL CONSTRAINT PK_Books PRIMARY KEY,
                Title TEXT NOT NULL, Author TEXT NOT NULL,
                Description TEXT NULL, AuthorGender TEXT NULL);
            CREATE TABLE Editions (
                Id TEXT NOT NULL CONSTRAINT PK_Editions PRIMARY KEY,
                BookId TEXT NOT NULL, SourceBookId TEXT NULL, Isbn TEXT NULL,
                CoverUrl TEXT NULL, Format TEXT NULL, PublicationYear INTEGER NULL,
                Publisher TEXT NULL, EditionName TEXT NULL, PageCount INTEGER NULL,
                CONSTRAINT FK_Editions_Books_BookId FOREIGN KEY (BookId)
                    REFERENCES Books (Id) ON DELETE RESTRICT);
            INSERT INTO Books (Id, Title, Author, Description, AuthorGender)
                SELECT Id, Title, Author, Description, AuthorGender FROM OwnedBooks;
            INSERT INTO Editions (Id, BookId, SourceBookId, Isbn, CoverUrl, Format,
                                  PublicationYear, Publisher, EditionName, PageCount)
                SELECT Id, Id, SourceBookId, Isbn, CoverUrl, Format,
                       PublicationYear, Publisher, Edition, PageCount FROM OwnedBooks;
            CREATE TABLE OwnedBooks_Normalized (
                Id TEXT NOT NULL CONSTRAINT PK_OwnedBooks PRIMARY KEY,
                EditionId TEXT NOT NULL, IsRead INTEGER NOT NULL, Rating REAL NULL,
                PurchaseLocation TEXT NULL, CreatedAtUtc TEXT NOT NULL,
                CONSTRAINT FK_OwnedBooks_Editions_EditionId FOREIGN KEY (EditionId)
                    REFERENCES Editions (Id) ON DELETE RESTRICT);
            INSERT INTO OwnedBooks_Normalized (Id, EditionId, IsRead, Rating, PurchaseLocation, CreatedAtUtc)
                SELECT Id, Id, IsRead, Rating, PurchaseLocation, CreatedAtUtc FROM OwnedBooks;
            DROP TABLE OwnedBooks;
            ALTER TABLE OwnedBooks_Normalized RENAME TO OwnedBooks;
            CREATE INDEX IX_OwnedBooks_EditionId ON OwnedBooks (EditionId);
            CREATE INDEX IX_Editions_BookId ON Editions (BookId);
            CREATE INDEX IX_Editions_Isbn ON Editions (Isbn);
            CREATE INDEX IX_Editions_SourceBookId ON Editions (SourceBookId);
            """);
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.Sql("""
            CREATE TABLE OwnedBooks_Legacy (
                Id TEXT NOT NULL CONSTRAINT PK_OwnedBooks PRIMARY KEY,
                SourceBookId TEXT NULL, Title TEXT NOT NULL, Author TEXT NOT NULL,
                Isbn TEXT NULL, Description TEXT NULL, CoverUrl TEXT NULL,
                Format TEXT NULL, AuthorGender TEXT NULL, IsRead INTEGER NOT NULL,
                Rating REAL NULL, PurchaseLocation TEXT NULL, PublicationYear INTEGER NULL,
                Publisher TEXT NULL, Edition TEXT NULL, PageCount INTEGER NULL,
                CreatedAtUtc TEXT NOT NULL);
            INSERT INTO OwnedBooks_Legacy
                (Id, SourceBookId, Title, Author, Isbn, Description, CoverUrl, Format,
                 AuthorGender, IsRead, Rating, PurchaseLocation, PublicationYear,
                 Publisher, Edition, PageCount, CreatedAtUtc)
                SELECT o.Id, e.SourceBookId, b.Title, b.Author, e.Isbn, b.Description,
                       e.CoverUrl, e.Format, b.AuthorGender, o.IsRead, o.Rating,
                       o.PurchaseLocation, e.PublicationYear, e.Publisher,
                       e.EditionName, e.PageCount, o.CreatedAtUtc
                FROM OwnedBooks o JOIN Editions e ON o.EditionId = e.Id
                JOIN Books b ON e.BookId = b.Id;
            DROP TABLE OwnedBooks;
            DROP TABLE Editions;
            DROP TABLE Books;
            ALTER TABLE OwnedBooks_Legacy RENAME TO OwnedBooks;
            """);
    }
}
