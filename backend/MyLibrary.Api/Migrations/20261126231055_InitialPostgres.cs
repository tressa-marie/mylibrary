using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace MyLibrary.Api.Migrations
{
    /// <inheritdoc />
    public partial class InitialPostgres : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "Books",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    Title = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: false),
                    Author = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: false),
                    Description = table.Column<string>(type: "character varying(20000)", maxLength: 20000, nullable: true),
                    AuthorGender = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: true),
                    Genres = table.Column<string[]>(type: "text[]", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Books", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "Shelves",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    Name = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    Room = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: true),
                    Description = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Shelves", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "Editions",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    BookId = table.Column<Guid>(type: "uuid", nullable: false),
                    SourceBookId = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: true),
                    Isbn = table.Column<string>(type: "character varying(13)", maxLength: 13, nullable: true),
                    CoverUrl = table.Column<string>(type: "text", nullable: true),
                    Format = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: true),
                    PublicationYear = table.Column<int>(type: "integer", nullable: true),
                    Publisher = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    EditionName = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    PageCount = table.Column<int>(type: "integer", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Editions", x => x.Id);
                    table.ForeignKey(
                        name: "FK_Editions_Books_BookId",
                        column: x => x.BookId,
                        principalTable: "Books",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "OwnedBooks",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    EditionId = table.Column<Guid>(type: "uuid", nullable: false),
                    IsRead = table.Column<bool>(type: "boolean", nullable: false),
                    Rating = table.Column<double>(type: "double precision", nullable: true),
                    IsDnf = table.Column<bool>(type: "boolean", nullable: true),
                    WantToSell = table.Column<bool>(type: "boolean", nullable: true),
                    BookCost = table.Column<decimal>(type: "numeric", nullable: true),
                    DateAcquired = table.Column<DateOnly>(type: "date", nullable: true),
                    DateRead = table.Column<DateOnly>(type: "date", nullable: true),
                    PurchaseLocation = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    ShelfLocation = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    ShelfId = table.Column<Guid>(type: "uuid", nullable: true),
                    CreatedAtUtc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_OwnedBooks", x => x.Id);
                    table.ForeignKey(
                        name: "FK_OwnedBooks_Editions_EditionId",
                        column: x => x.EditionId,
                        principalTable: "Editions",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_OwnedBooks_Shelves_ShelfId",
                        column: x => x.ShelfId,
                        principalTable: "Shelves",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.SetNull);
                });

            migrationBuilder.CreateIndex(
                name: "IX_Editions_BookId",
                table: "Editions",
                column: "BookId");

            migrationBuilder.CreateIndex(
                name: "IX_Editions_Isbn",
                table: "Editions",
                column: "Isbn");

            migrationBuilder.CreateIndex(
                name: "IX_Editions_SourceBookId",
                table: "Editions",
                column: "SourceBookId");

            migrationBuilder.CreateIndex(
                name: "IX_OwnedBooks_EditionId",
                table: "OwnedBooks",
                column: "EditionId");

            migrationBuilder.CreateIndex(
                name: "IX_OwnedBooks_ShelfId",
                table: "OwnedBooks",
                column: "ShelfId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "OwnedBooks");

            migrationBuilder.DropTable(
                name: "Editions");

            migrationBuilder.DropTable(
                name: "Shelves");

            migrationBuilder.DropTable(
                name: "Books");
        }
    }
}
