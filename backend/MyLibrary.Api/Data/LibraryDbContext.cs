using Microsoft.EntityFrameworkCore;
using MyLibrary.Api.OwnedBooks;
using MyLibrary.Api.Domain;

namespace MyLibrary.Api.Data;

public sealed class LibraryDbContext(DbContextOptions<LibraryDbContext> options)
    : DbContext(options)
{
    public DbSet<OwnedBook> OwnedBooks => Set<OwnedBook>();
    public DbSet<Book> Books => Set<Book>();
    public DbSet<Edition> Editions => Set<Edition>();
    public DbSet<Shelf> Shelves => Set<Shelf>();
    public DbSet<Goal> Goals => Set<Goal>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<Goal>(goal =>
        {
            goal.Property(x => x.GoalType).HasConversion<string>().HasMaxLength(32);
            goal.Property(x => x.IncludeNonLibraryBooks).HasDefaultValue(false);
            goal.Property(x => x.CompletedCount).HasPrecision(14, 2);
            goal.ToTable("Goals", table =>
            {
                table.HasCheckConstraint("CK_Goals_CompletedCount",
                    "\"CompletedCount\" IS NULL OR (\"CompletedCount\" >= 0 AND \"CompletedCount\" <= 2147483647 AND " +
                    "((\"GoalType\" = 'ReadBookPercentage' AND \"CompletedCount\" <= 100) OR " +
                    "(\"GoalType\" <> 'ReadBookPercentage' AND \"CompletedCount\" = trunc(\"CompletedCount\"))))");
                table.HasCheckConstraint("CK_Goals_Dates", "\"EndDate\" >= \"StartDate\"");
                table.HasCheckConstraint("CK_Goals_Num", "\"Num\" >= 0");
                table.HasCheckConstraint("CK_Goals_GoalType",
                    "\"GoalType\" IN ('BookCount', 'PageCount', 'BuyBookCount', 'ReadBookPercentage')");
                table.HasCheckConstraint("CK_Goals_Percentage",
                    "\"GoalType\" <> 'ReadBookPercentage' OR \"Num\" <= 100");
                table.HasCheckConstraint("CK_Goals_IncludeNonLibraryBooks",
                    "NOT \"IncludeNonLibraryBooks\" OR \"GoalType\" IN ('BookCount', 'PageCount')");
            });
        });
        modelBuilder.Entity<Book>(book =>
        {
            book.Property(x => x.Title).IsRequired().HasMaxLength(500);
            book.Property(x => x.Author).IsRequired().HasMaxLength(500);
            book.Property(x => x.Description).HasMaxLength(20000);
            book.Property(x => x.AuthorGender).HasMaxLength(20);
            book.PrimitiveCollection(x => x.Genres).IsRequired();
        });
        modelBuilder.Entity<Edition>(edition =>
        {
            edition.HasOne(x => x.Book).WithMany().HasForeignKey(x => x.BookId)
                .OnDelete(DeleteBehavior.Restrict);
            edition.Property(x => x.SourceBookId).HasMaxLength(100);
            edition.Property(x => x.Isbn).HasMaxLength(13);
            edition.Property(x => x.Format).HasMaxLength(100);
            edition.Property(x => x.Publisher).HasMaxLength(500);
            edition.Property(x => x.EditionName).HasMaxLength(500);
            edition.HasIndex(x => x.Isbn);
            edition.HasIndex(x => x.SourceBookId);
        });
        modelBuilder.Entity<OwnedBook>(owned =>
        {
            owned.HasOne(x => x.EditionDetails).WithMany().HasForeignKey(x => x.EditionId)
                .OnDelete(DeleteBehavior.Restrict);
            owned.Property(x => x.PurchaseLocation).HasMaxLength(500);
            owned.Property(x => x.ShelfLocation).HasMaxLength(500);
            owned.HasOne(x => x.Shelf).WithMany(x => x.Books).HasForeignKey(x => x.ShelfId)
                .OnDelete(DeleteBehavior.SetNull);
        });
        modelBuilder.Entity<Shelf>(shelf =>
        {
            shelf.Property(x => x.Name).IsRequired().HasMaxLength(200);
            shelf.Property(x => x.Room).HasMaxLength(200);
            shelf.Property(x => x.Description).HasMaxLength(2000);
        });
    }
}
