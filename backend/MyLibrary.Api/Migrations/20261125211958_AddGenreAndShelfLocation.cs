using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace MyLibrary.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddGenreAndShelfLocation : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "ShelfLocation",
                table: "OwnedBooks",
                type: "TEXT",
                maxLength: 500,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Genre",
                table: "Books",
                type: "TEXT",
                maxLength: 100,
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "ShelfLocation",
                table: "OwnedBooks");

            migrationBuilder.DropColumn(
                name: "Genre",
                table: "Books");
        }
    }
}
