using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace MyLibrary.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddShelves : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<Guid>(
                name: "ShelfId",
                table: "OwnedBooks",
                type: "TEXT",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "Shelves",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "TEXT", nullable: false),
                    Name = table.Column<string>(type: "TEXT", maxLength: 200, nullable: false),
                    Room = table.Column<string>(type: "TEXT", maxLength: 200, nullable: true),
                    Description = table.Column<string>(type: "TEXT", maxLength: 2000, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Shelves", x => x.Id);
                });

            migrationBuilder.CreateIndex(
                name: "IX_OwnedBooks_ShelfId",
                table: "OwnedBooks",
                column: "ShelfId");

            migrationBuilder.AddForeignKey(
                name: "FK_OwnedBooks_Shelves_ShelfId",
                table: "OwnedBooks",
                column: "ShelfId",
                principalTable: "Shelves",
                principalColumn: "Id",
                onDelete: ReferentialAction.SetNull);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_OwnedBooks_Shelves_ShelfId",
                table: "OwnedBooks");

            migrationBuilder.DropTable(
                name: "Shelves");

            migrationBuilder.DropIndex(
                name: "IX_OwnedBooks_ShelfId",
                table: "OwnedBooks");

            migrationBuilder.DropColumn(
                name: "ShelfId",
                table: "OwnedBooks");
        }
    }
}
