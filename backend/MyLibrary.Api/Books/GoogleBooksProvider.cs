using System.Net;
using System.Text.Json;
using System.Text.RegularExpressions;

namespace MyLibrary.Api.Books;

// Provider response types stay inside this adapter; endpoints return only My Library books.
public sealed class GoogleBooksProvider(HttpClient http, IConfiguration configuration) : IBookProvider
{
    private string WithKey(string path) => string.IsNullOrWhiteSpace(configuration["Books:ApiKey"])
        ? path : path + (path.Contains('?') ? "&" : "?") + "key=" + Uri.EscapeDataString(configuration["Books:ApiKey"]!);

    public async Task<Book[]> SearchAsync(string query, string field, CancellationToken cancellationToken)
    {
        var prefix = field switch { "title" => "intitle:", "author" => "inauthor:", "isbn" => "isbn:", _ => "" };
        if (field == "isbn") query = Regex.Replace(query, @"[\s-]", "");
        var result = await http.GetFromJsonAsync<SearchResponse>(WithKey(
            "volumes?q=" + Uri.EscapeDataString(prefix + query) + "&maxResults=20&printType=books"), cancellationToken)
            ?? throw new JsonException("Missing search response.");
        return (result.Items ?? []).Where(v => !string.IsNullOrWhiteSpace(v.Id) && v.VolumeInfo is not null)
            .DistinctBy(v => v.Id).Select(Map).ToArray();
    }

    private async Task<Volume?> GetVolumeAsync(string id, CancellationToken cancellationToken)
    {
        using var response = await http.GetAsync(WithKey("volumes/" + Uri.EscapeDataString(id)), cancellationToken);
        if (response.StatusCode == HttpStatusCode.NotFound) return null;
        response.EnsureSuccessStatusCode();
        var volume = await response.Content.ReadFromJsonAsync<Volume>(cancellationToken)
            ?? throw new JsonException("Missing book response.");
        if (string.IsNullOrWhiteSpace(volume.Id) || volume.VolumeInfo is null) throw new JsonException("Invalid book response.");
        return volume;
    }

    public async Task<Book?> GetAsync(string id, CancellationToken cancellationToken)
    {
        var volume = await GetVolumeAsync(id, cancellationToken);
        return volume is null ? null : Map(volume);
    }

    public async Task<byte[]?> GetCoverAsync(string id, CancellationToken cancellationToken)
    {
        var volume = await GetVolumeAsync(id, cancellationToken);
        var url = volume?.VolumeInfo?.ImageLinks?.Thumbnail ?? volume?.VolumeInfo?.ImageLinks?.SmallThumbnail;
        // Never proxy arbitrary URLs or follow redirects to untrusted hosts.
        if (!Uri.TryCreate(url, UriKind.Absolute, out var uri) || uri.Host != "books.google.com"
            || (uri.Scheme != "https" && uri.Scheme != "http") || !uri.IsDefaultPort) return null;
        using var response = await http.GetAsync(new UriBuilder(uri) { Scheme = "https", Port = -1 }.Uri, cancellationToken);
        if (response.StatusCode == HttpStatusCode.NotFound) return null;
        response.EnsureSuccessStatusCode();
        if (response.Content.Headers.ContentType?.MediaType != "image/jpeg") return null;
        return await response.Content.ReadAsByteArrayAsync(cancellationToken);
    }

    private static Book Map(Volume volume)
    {
        var info = volume.VolumeInfo!;
        int? year = info.PublishedDate is { Length: >= 4 } date && int.TryParse(date[..4], out var parsed) ? parsed : null;
        var hasCover = info.ImageLinks?.Thumbnail is not null || info.ImageLinks?.SmallThumbnail is not null;
        return new(volume.Id!, info.Title ?? "Untitled", info.Subtitle, info.Authors ?? [], year,
            (info.IndustryIdentifiers ?? []).Where(i => i.Type is "ISBN_10" or "ISBN_13")
                .Select(i => i.Identifier).OfType<string>().Distinct().ToArray(),
            volume.SaleInfo?.IsEbook == true ? "eBook" : info.PrintType == "BOOK" ? "Book (binding unspecified)" : null,
            hasCover ? $"/api/books/{Uri.EscapeDataString(volume.Id!)}/cover" : null,
            info.Publisher, info.Description is null ? null : WebUtility.HtmlDecode(Regex.Replace(info.Description, "<[^>]*>", " ")),
            info.PageCount, info.Language);
    }

    private sealed record SearchResponse(Volume[]? Items);
    private sealed record Volume(string? Id, VolumeInfo? VolumeInfo, SaleInfo? SaleInfo);
    private sealed record SaleInfo(bool? IsEbook);
    private sealed record VolumeInfo(string? Title, string? Subtitle, string[]? Authors, string? PublishedDate,
        IndustryIdentifier[]? IndustryIdentifiers, string? PrintType, ImageLinks? ImageLinks, string? Publisher,
        string? Description, int? PageCount, string? Language);
    private sealed record IndustryIdentifier(string? Type, string? Identifier);
    private sealed record ImageLinks(string? Thumbnail, string? SmallThumbnail);
}
