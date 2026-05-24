using Dapper;
using ReboqueApp.Domain.Entities;
using ReboqueApp.Domain.Interfaces;
using ReboqueApp.Infrastructure.Persistence;

namespace ReboqueApp.Infrastructure.Repositories;

public class AtendimentoRepository(IDbConnectionFactory db) : IAtendimentoRepository
{
    public async Task<Atendimento?> ObterPorIdAsync(int id)
    {
        using var conn = db.CreateConnection();
        return await conn.QueryFirstOrDefaultAsync<Atendimento>(
            "SELECT * FROM public.atendimentos WHERE id = @Id", new { Id = id });
    }

    public async Task<Atendimento?> ObterPorSolicitacaoAsync(int solicitacaoId)
    {
        using var conn = db.CreateConnection();
        return await conn.QueryFirstOrDefaultAsync<Atendimento>(@"
            SELECT a.*, av.id, av.atendimento_id, av.nota, av.comentario
            FROM public.atendimentos a
            LEFT JOIN public.avaliacoes av ON av.atendimento_id = a.id
            WHERE a.solicitacao_id = @SolicitacaoId",
            new { SolicitacaoId = solicitacaoId });
    }

    public async Task<IEnumerable<Atendimento>> ListarPorMotoristaAsync(int motoristaId)
    {
        using var conn = db.CreateConnection();
        return await conn.QueryAsync<Atendimento>(@"
            SELECT * FROM public.atendimentos
            WHERE motorista_id = @MotoristaId ORDER BY hora_inicio DESC",
            new { MotoristaId = motoristaId });
    }

    public async Task<Atendimento> CriarAsync(Atendimento atendimento)
    {
        using var conn = db.CreateConnection();
        var id = await conn.ExecuteScalarAsync<int>(@"
            INSERT INTO public.atendimentos (solicitacao_id, motorista_id, hora_inicio, valor_final)
            VALUES (@SolicitacaoId, @MotoristaId, @HoraInicio, @ValorFinal)
            RETURNING id",
            new
            {
                atendimento.SolicitacaoId,
                atendimento.MotoristaId,
                HoraInicio = atendimento.HoraInicio ?? DateTime.UtcNow,
                atendimento.ValorFinal
            });
        atendimento.Id = id;
        return atendimento;
    }

    public async Task AtualizarAsync(Atendimento atendimento)
    {
        using var conn = db.CreateConnection();
        await conn.ExecuteAsync(@"
            UPDATE public.atendimentos
            SET hora_fim = @HoraFim, valor_final = @ValorFinal
            WHERE id = @Id",
            new { atendimento.HoraFim, atendimento.ValorFinal, atendimento.Id });
    }
}

public class AvaliacaoRepository(IDbConnectionFactory db) : IAvaliacaoRepository
{
    public async Task<Avaliacao?> ObterPorAtendimentoAsync(int atendimentoId)
    {
        using var conn = db.CreateConnection();
        return await conn.QueryFirstOrDefaultAsync<Avaliacao>(
            "SELECT * FROM public.avaliacoes WHERE atendimento_id = @AtendimentoId",
            new { AtendimentoId = atendimentoId });
    }

    public async Task<Avaliacao> CriarAsync(Avaliacao avaliacao)
    {
        using var conn = db.CreateConnection();
        var id = await conn.ExecuteScalarAsync<int>(@"
            INSERT INTO public.avaliacoes (atendimento_id, nota, comentario)
            VALUES (@AtendimentoId, @Nota, @Comentario)
            RETURNING id",
            new { avaliacao.AtendimentoId, avaliacao.Nota, avaliacao.Comentario });
        avaliacao.Id = id;
        return avaliacao;
    }
}
