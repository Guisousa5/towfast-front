using Dapper;
using ReboqueApp.Domain.Entities;
using ReboqueApp.Domain.Interfaces;
using ReboqueApp.Infrastructure.Persistence;

namespace ReboqueApp.Infrastructure.Repositories;

public class VeiculoRepository(IDbConnectionFactory db) : IVeiculoRepository
{
    public async Task<Veiculo?> ObterPorIdAsync(int id)
    {
        using var conn = db.CreateConnection();
        return await conn.QueryFirstOrDefaultAsync<Veiculo>(
            "SELECT * FROM public.veiculos WHERE id = @Id", new { Id = id });
    }

    public async Task<Veiculo?> ObterPorPlacaAsync(string placa)
    {
        using var conn = db.CreateConnection();
        return await conn.QueryFirstOrDefaultAsync<Veiculo>(
            "SELECT * FROM public.veiculos WHERE placa = @Placa", new { Placa = placa });
    }

    public async Task<IEnumerable<Veiculo>> ListarPorUsuarioAsync(int usuarioId)
    {
        using var conn = db.CreateConnection();
        return await conn.QueryAsync<Veiculo>(
            "SELECT * FROM public.veiculos WHERE usuario_id = @UsuarioId ORDER BY id DESC",
            new { UsuarioId = usuarioId });
    }

    public async Task<Veiculo> CriarAsync(Veiculo veiculo)
    {
        using var conn = db.CreateConnection();
        var id = await conn.ExecuteScalarAsync<int>(@"
            INSERT INTO public.veiculos (usuario_id, marca, modelo, placa, tipo_veiculo)
            VALUES (@UsuarioId, @Marca, @Modelo, @Placa, @TipoVeiculo)
            RETURNING id",
            new { veiculo.UsuarioId, veiculo.Marca, veiculo.Modelo, veiculo.Placa, TipoVeiculo = veiculo.TipoVeiculo });
        veiculo.Id = id;
        return veiculo;
    }

    public async Task AtualizarAsync(Veiculo veiculo)
    {
        using var conn = db.CreateConnection();
        await conn.ExecuteAsync(@"
            UPDATE public.veiculos
            SET marca = @Marca, modelo = @Modelo, tipo_veiculo = @TipoVeiculo
            WHERE id = @Id",
            new { veiculo.Marca, veiculo.Modelo, TipoVeiculo = veiculo.TipoVeiculo, veiculo.Id });
    }

    public async Task RemoverAsync(int id)
    {
        using var conn = db.CreateConnection();
        await conn.ExecuteAsync("DELETE FROM public.veiculos WHERE id = @Id", new { Id = id });
    }
}

public class SolicitacaoRepository(IDbConnectionFactory db) : ISolicitacaoRepository
{
    // Query base com JOIN em veiculo e avaliacao para montar o objeto completo
    private const string SelectBase = @"
        SELECT s.*, 
               v.id, v.usuario_id, v.marca, v.modelo, v.placa, v.tipo_veiculo,
               a.id, a.solicitacao_id, a.motorista_id, a.hora_inicio, a.hora_fim, a.valor_final,
               av.id, av.atendimento_id, av.nota, av.comentario
        FROM public.solicitacoes s
        LEFT JOIN public.veiculos v ON v.id = s.veiculo_id
        LEFT JOIN public.atendimentos a ON a.solicitacao_id = s.id
        LEFT JOIN public.avaliacoes av ON av.atendimento_id = a.id";

    private static Solicitacao MapRow(Solicitacao s, Veiculo v, Atendimento a, Avaliacao av)
    {
        s.Veiculo = v;
        if (a?.Id > 0)
        {
            s.Atendimento = a;
            if (av?.Id > 0) s.Atendimento.Avaliacao = av;
        }
        return s;
    }

    public async Task<Solicitacao?> ObterPorIdAsync(int id)
    {
        using var conn = db.CreateConnection();
        var result = await conn.QueryAsync<Solicitacao, Veiculo, Atendimento, Avaliacao, Solicitacao>(
            $"{SelectBase} WHERE s.id = @Id",
            MapRow, new { Id = id }, splitOn: "id,id,id");
        return result.FirstOrDefault();
    }

    public async Task<IEnumerable<Solicitacao>> ListarAsync()
    {
        using var conn = db.CreateConnection();
        return await conn.QueryAsync<Solicitacao, Veiculo, Atendimento, Avaliacao, Solicitacao>(
            $"{SelectBase} ORDER BY s.data_solicitacao DESC",
            MapRow, splitOn: "id,id,id");
    }

    public async Task<IEnumerable<Solicitacao>> ListarAtivasAsync()
    {
        using var conn = db.CreateConnection();
        return await conn.QueryAsync<Solicitacao, Veiculo, Atendimento, Avaliacao, Solicitacao>(
            $"{SelectBase} WHERE s.status IN ('aguardando','acionado') ORDER BY s.data_solicitacao DESC",
            MapRow, splitOn: "id,id,id");
    }

    public async Task<IEnumerable<Solicitacao>> ListarPorUsuarioAsync(int usuarioId)
    {
        using var conn = db.CreateConnection();
        return await conn.QueryAsync<Solicitacao, Veiculo, Atendimento, Avaliacao, Solicitacao>(
            $"{SelectBase} WHERE s.usuario_id = @UsuarioId ORDER BY s.data_solicitacao DESC",
            MapRow, new { UsuarioId = usuarioId }, splitOn: "id,id,id");
    }

    public async Task<Solicitacao> CriarAsync(Solicitacao sol)
    {
        using var conn = db.CreateConnection();
        var id = await conn.ExecuteScalarAsync<int>(@"
            INSERT INTO public.solicitacoes
                (usuario_id, veiculo_id, origem, destino, distancia_km, valor_estimado,
                 status, data_solicitacao, lat_origem, lng_origem, urgencia, valor_total)
            VALUES
                (@UsuarioId, @VeiculoId, @Origem, @Destino, @DistanciaKm, @ValorEstimado,
                 @Status, @DataSolicitacao, @LatOrigem, @LngOrigem, @Urgencia, @ValorTotal)
            RETURNING id",
            new
            {
                sol.UsuarioId, sol.VeiculoId, sol.Origem, sol.Destino,
                sol.DistanciaKm, sol.ValorEstimado, sol.Status, sol.DataSolicitacao,
                sol.LatOrigem, sol.LngOrigem, sol.Urgencia, sol.ValorTotal
            });
        sol.Id = id;
        return sol;
    }

    public async Task AtualizarAsync(Solicitacao sol)
    {
        using var conn = db.CreateConnection();
        await conn.ExecuteAsync(@"
            UPDATE public.solicitacoes
            SET status = @Status, valor_total = @ValorTotal, eta_minutos = @EtaMinutos
            WHERE id = @Id",
            new { sol.Status, sol.ValorTotal, sol.EtaMinutos, sol.Id });
    }

    public async Task AtualizarStatusAsync(int id, string status)
    {
        using var conn = db.CreateConnection();
        await conn.ExecuteAsync(
            "UPDATE public.solicitacoes SET status = @Status WHERE id = @Id",
            new { Status = status, Id = id });
    }

    public async Task AtualizarEtaAsync(int id, int etaMinutos)
    {
        using var conn = db.CreateConnection();
        await conn.ExecuteAsync(
            "UPDATE public.solicitacoes SET eta_minutos = @Eta WHERE id = @Id",
            new { Eta = etaMinutos, Id = id });
    }

    public async Task<bool> TemSolicitacaoAtivaAsync(int usuarioId)
    {
        using var conn = db.CreateConnection();
        var count = await conn.ExecuteScalarAsync<int>(
            "SELECT COUNT(*) FROM public.solicitacoes WHERE usuario_id = @UsuarioId AND status IN ('aguardando', 'acionado')",
            new { UsuarioId = usuarioId });
        return count > 0;
    }
}
