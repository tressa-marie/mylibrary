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

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<Book>(book =>
        {
            book.Property(x => x.Title).IsRequired().HasMaxLength(500);
            book.Property(x => x.Author).IsRequired().HasMaxLength(500);
            book.Property(x => x.Description).HasMaxLength(20000);
            book.Property(x => x.AuthorGender).HasMaxLength(20);
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
        });
    }
}
