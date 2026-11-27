using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace MyLibrary.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddGoals : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "Goals",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    StartDate = table.Column<DateOnly>(type: "date", nullable: false),
                    EndDate = table.Column<DateOnly>(type: "date", nullable: false),
                    GoalType = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false),
                    Num = table.Column<int>(type: "integer", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Goals", x => x.Id);
                    table.CheckConstraint("CK_Goals_Dates", "\"EndDate\" >= \"StartDate\"");
                    table.CheckConstraint("CK_Goals_GoalType", "\"GoalType\" IN ('BookCount', 'PageCount', 'BuyBookCount', 'ReadBookPercentage')");
                    table.CheckConstraint("CK_Goals_Num", "\"Num\" >= 0");
                    table.CheckConstraint("CK_Goals_Percentage", "\"GoalType\" <> 'ReadBookPercentage' OR \"Num\" <= 100");
                });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "Goals");
        }
    }
}
