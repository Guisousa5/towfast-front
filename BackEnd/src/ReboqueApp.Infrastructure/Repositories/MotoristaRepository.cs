using Dapper;
using ReboqueApp.Domain.Entities;
using ReboqueApp.Domain.Interfaces;
using ReboqueApp.Infrastructure.Persistence;

namespace ReboqueApp.Infrastructure.Repositories;

public class MotoristaRepository(IDbConnectionFactory db) : IMotoristaRepository
{
    private const string SelectBase = @"
        SELECT m.*, u.id, u.nome, u.email, u.telefone, u.tipo_usuario, u.data_criacao
        FROM public.motoristas m
        INNER JOIN public.usuarios u ON u.id = m.usuario_id";

    public async Task<Motorista?> ObterPorIdAsync(int id)
    {
        using var conn = db.CreateConnection();
        var result = await conn.QueryAsync<Motorista, Usuario, Motorista>(
            $"{SelectBase} WHERE m.id = @Id",
            (m, u) => { m.Usuario = u; return m; },
            new { Id = id }, splitOn: "id");
        return result.FirstOrDefault();
    }

    public async Task<Motorista?> ObterPorUsuarioIdAsync(int usuarioId)
    {
        using var conn = db.CreateConnection();
        var result = await conn.QueryAsync<Motorista, Usuario, Motorista>(
            $"{SelectBase} WHERE m.usuario_id = @UsuarioId",
            (m, u) => { m.Usuario = u; return m; },
            new { UsuarioId = usuarioId }, splitOn: "id");
        return result.FirstOrDefault();
    }

    public async Task<IEnumerable<Motorista>> ListarDisponiveisAsync()
    {
        using var conn = db.CreateConnection();
        return await conn.QueryAsync<Motorista, Usuario, Motorista>(
            $"{SelectBase} WHERE m.disponivel = true",
            (m, u) => { m.Usuario = u; return m; },
            splitOn: "id");
    }

    public async Task<Motorista> CriarAsync(Motorista motorista)
    {
        using var conn = db.CreateConnection();
        var id = await conn.ExecuteScalarAsync<int>(@"
            INSERT INTO public.motoristas (usuario_id, cnh, disponivel)
            VALUES (@UsuarioId, @Cnh, @Disponivel)
            RETURNING id",
            new { motorista.UsuarioId, motorista.Cnh, motorista.Disponivel });
        motorista.Id = id;
        return motorista;
    }

    public async Task AtualizarAsync(Motorista motorista)
    {
        using var conn = db.CreateConnection();
        await conn.ExecuteAsync(@"
            UPDATE public.motoristas
            SET cnh = @Cnh, disponivel = @Disponivel, latitude = @Latitude, longitude = @Longitude
            WHERE id = @Id",
            new { motorista.Cnh, motorista.Disponivel, motorista.Latitude, motorista.Longitude, motorista.Id });
    }

    public async Task AtualizarLocalizacaoAsync(int motoristaId, decimal lat, decimal lng)
    {
        using var conn = db.CreateConnection();
        await conn.ExecuteAsync(@"
            UPDATE public.motoristas SET latitude = @Lat, longitude = @Lng WHERE id = @Id",
            new { Lat = lat, Lng = lng, Id = motoristaId });
    }

    public async Task AtualizarDisponibilidadeAsync(int motoristaId, bool disponivel)
    {
        using var conn = db.CreateConnection();
        await conn.ExecuteAsync(@"
            UPDATE public.motoristas SET disponivel = @Disponivel WHERE id = @Id",
            new { Disponivel = disponivel, Id = motoristaId });
    }
}
