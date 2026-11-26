using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace MyLibrary.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddOwnedBookTrackingFields : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<decimal>(
                name: "BookCost",
                table: "OwnedBooks",
                type: "TEXT",
                nullable: true);

            migrationBuilder.AddColumn<DateOnly>(
                name: "DateAcquired",
                table: "OwnedBooks",
                type: "TEXT",
                nullable: true);

            migrationBuilder.AddColumn<DateOnly>(
                name: "DateRead",
                table: "OwnedBooks",
                type: "TEXT",
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "IsDnf",
                table: "OwnedBooks",
                type: "INTEGER",
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "WantToSell",
                table: "OwnedBooks",
                type: "INTEGER",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "BookCost",
                table: "OwnedBooks");

            migrationBuilder.DropColumn(
                name: "DateAcquired",
                table: "OwnedBooks");

            migrationBuilder.DropColumn(
                name: "DateRead",
                table: "OwnedBooks");

            migrationBuilder.DropColumn(
                name: "IsDnf",
                table: "OwnedBooks");

            migrationBuilder.DropColumn(
                name: "WantToSell",
                table: "OwnedBooks");
        }
    }
}
