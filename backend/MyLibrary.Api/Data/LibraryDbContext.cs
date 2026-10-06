using Microsoft.EntityFrameworkCore;
using MyLibrary.Api.OwnedBooks;

namespace MyLibrary.Api.Data;

public sealed class LibraryDbContext(DbContextOptions<LibraryDbContext> options)
    : DbContext(options)
{
    public DbSet<OwnedBook> OwnedBooks => Set<OwnedBook>();
}
