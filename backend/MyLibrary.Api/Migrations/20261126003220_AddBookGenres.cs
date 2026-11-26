using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace MyLibrary.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddBookGenres : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("""
                ALTER TABLE Books ADD COLUMN Genres TEXT NOT NULL DEFAULT '[]';
                UPDATE Books SET Genres = CASE
                    WHEN Genre IS NULL OR trim(Genre) = '' THEN '[]'
                    ELSE json_array(trim(Genre)) END;
                ALTER TABLE Books DROP COLUMN Genre;
                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            // Preserve all names as one string when returning to the legacy schema.
            migrationBuilder.Sql("""
                ALTER TABLE Books ADD COLUMN Genre TEXT NULL;
                UPDATE Books SET Genre = (SELECT group_concat(value, ', ') FROM json_each(Books.Genres));
                ALTER TABLE Books DROP COLUMN Genres;
                """);
        }
    }
}
