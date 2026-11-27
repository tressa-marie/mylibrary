using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace MyLibrary.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddGoalCompletedCount : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<decimal>(
                name: "CompletedCount",
                table: "Goals",
                type: "numeric(14,2)",
                precision: 14,
                scale: 2,
                nullable: true);

            migrationBuilder.AddCheckConstraint(
                name: "CK_Goals_CompletedCount",
                table: "Goals",
                sql: "\"CompletedCount\" IS NULL OR (\"CompletedCount\" >= 0 AND \"CompletedCount\" <= 2147483647 AND ((\"GoalType\" = 'ReadBookPercentage' AND \"CompletedCount\" <= 100) OR (\"GoalType\" <> 'ReadBookPercentage' AND \"CompletedCount\" = trunc(\"CompletedCount\"))))");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropCheckConstraint(
                name: "CK_Goals_CompletedCount",
                table: "Goals");

            migrationBuilder.DropColumn(
                name: "CompletedCount",
                table: "Goals");
        }
    }
}
