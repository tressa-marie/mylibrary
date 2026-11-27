using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace MyLibrary.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddGoalIncludeNonLibraryBooks : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<bool>(
                name: "IncludeNonLibraryBooks",
                table: "Goals",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddCheckConstraint(
                name: "CK_Goals_IncludeNonLibraryBooks",
                table: "Goals",
                sql: "NOT \"IncludeNonLibraryBooks\" OR \"GoalType\" IN ('BookCount', 'PageCount')");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropCheckConstraint(
                name: "CK_Goals_IncludeNonLibraryBooks",
                table: "Goals");

            migrationBuilder.DropColumn(
                name: "IncludeNonLibraryBooks",
                table: "Goals");
        }
    }
}
