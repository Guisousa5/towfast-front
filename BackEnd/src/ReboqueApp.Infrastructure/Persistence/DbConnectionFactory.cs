using System.Data;
using Microsoft.Extensions.Configuration;
using Npgsql;

namespace ReboqueApp.Infrastructure.Persistence;

/// <summary>
/// Fábrica de conexões Dapper → Supabase (PostgreSQL).
/// Configure a connection string em appsettings.json:
///   "ConnectionStrings": { "Supabase": "Host=...;Port=5432;Database=postgres;Username=postgres;Password=..." }
/// </summary>
public interface IDbConnectionFactory
{
    IDbConnection CreateConnection();
}

public class SupabaseConnectionFactory(IConfiguration config) : IDbConnectionFactory
{
    private readonly string _cs = config.GetConnectionString("Supabase")
        ?? throw new InvalidOperationException("ConnectionString 'Supabase' não configurada.");

    public IDbConnection CreateConnection()
    {
        var conn = new NpgsqlConnection(_cs);
        conn.Open();
        return conn;
    }
}
