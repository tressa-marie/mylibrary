using System.Data.Common;
using Microsoft.EntityFrameworkCore.Diagnostics;

// Set the search path on the open connection, rather than relying on startup parameters.
internal sealed class TestSchemaInterceptor(string schema) : DbConnectionInterceptor
{
    public override async Task ConnectionOpenedAsync(DbConnection connection, ConnectionEndEventData eventData, CancellationToken cancellationToken = default)
    {
        await using var command = connection.CreateCommand();
        command.CommandText = $"SET search_path TO \"{schema}\"";
        await command.ExecuteNonQueryAsync(cancellationToken);
    }

    public override void ConnectionOpened(DbConnection connection, ConnectionEndEventData eventData)
    {
        using var command = connection.CreateCommand();
        command.CommandText = $"SET search_path TO \"{schema}\"";
        command.ExecuteNonQuery();
    }
}
