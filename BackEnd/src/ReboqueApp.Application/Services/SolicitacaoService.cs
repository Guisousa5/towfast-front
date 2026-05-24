using ReboqueApp.Application.DTOs.Requests;
using ReboqueApp.Application.DTOs.Responses;
using ReboqueApp.Application.Interfaces;
using ReboqueApp.Domain.Entities;
using ReboqueApp.Domain.Interfaces;

namespace ReboqueApp.Application.Services;

public class SolicitacaoService(
    ISolicitacaoRepository solicitacaoRepo,
    IVeiculoRepository veiculoRepo,
    IAtendimentoRepository atendimentoRepo,
    IAvaliacaoRepository avaliacaoRepo,
    IMotoristaRepository motoristaRepo,
    IReboqueHubService hub) : ISolicitacaoService
{
    // ─── LISTAGENS ────────────────────────────────────────────
    public async Task<IEnumerable<SolicitacaoResponse>> ListarTodasAsync()
    {
        var lista = await solicitacaoRepo.ListarAsync();
        return lista.Select(Map);
    }

    public async Task<IEnumerable<SolicitacaoResponse>> ListarAtivasAsync()
    {
        var lista = await solicitacaoRepo.ListarAtivasAsync();
        return lista.Select(Map);
    }

    public async Task<IEnumerable<SolicitacaoResponse>> ListarPorClienteAsync(int usuarioId)
    {
        var lista = await solicitacaoRepo.ListarPorUsuarioAsync(usuarioId);
        return lista.Select(Map);
    }

    public async Task<SolicitacaoResponse?> ObterPorIdAsync(int id)
    {
        var sol = await solicitacaoRepo.ObterPorIdAsync(id);
        return sol is null ? null : Map(sol);
    }

    // ─── CRIAR ────────────────────────────────────────────────
    public async Task<SolicitacaoResponse> CriarAsync(int usuarioId, CriarSolicitacaoRequest request)
    {
        // Verifica se o cliente já tem uma solicitação ativa
        var temSolicitacaoAtiva = await solicitacaoRepo.TemSolicitacaoAtivaAsync(usuarioId);
        if (temSolicitacaoAtiva)
            throw new InvalidOperationException("O cliente já possui uma solicitação/chamado ativo.");

        // Garante que o veículo existe ou cria automaticamente
        var veiculo = await veiculoRepo.ObterPorPlacaAsync(request.Placa);
        if (veiculo is null)
        {
            veiculo = await veiculoRepo.CriarAsync(new Veiculo
            {
                UsuarioId = usuarioId,
                Placa = request.Placa.ToUpperInvariant(),
                Modelo = request.Modelo,
                TipoVeiculo = request.TipoVeiculo
            });
        }

        var solicitacao = new Solicitacao
        {
            UsuarioId = usuarioId,
            VeiculoId = veiculo.Id,
            Origem = request.Origem,
            Destino = request.Destino,
            DistanciaKm = request.DistanciaKm,
            ValorEstimado = request.ValorTotal,
            ValorTotal = request.ValorTotal,
            Status = "aguardando",
            LatOrigem = request.LatOrigem,
            LngOrigem = request.LngOrigem,
            Urgencia = request.Urgencia,
            DataSolicitacao = DateTime.UtcNow
        };

        var criada = await solicitacaoRepo.CriarAsync(solicitacao);

        // Popula veiculo para o map
        criada.Veiculo = veiculo;
        var response = Map(criada);

        // Notifica Central via SignalR
        await hub.NotificarNovaSolicitacaoAsync(response);

        return response;
    }

    // ─── ACIONAR (Central → Motorista) ────────────────────────
    public async Task AcionarAsync(int id, AcionarSolicitacaoRequest request)
    {
        var sol = await solicitacaoRepo.ObterPorIdAsync(id)
            ?? throw new KeyNotFoundException($"Solicitação {id} não encontrada.");

        if (sol.Status != "aguardando")
            throw new InvalidOperationException("Solicitação não está em aguardo.");

        await solicitacaoRepo.AtualizarStatusAsync(id, "acionado");
        await solicitacaoRepo.AtualizarEtaAsync(id, request.EtaMinutos);

        // Cria atendimento se houver motorista
        if (!string.IsNullOrEmpty(request.MotoristaId) &&
            int.TryParse(request.MotoristaId.Replace("MTR-", ""), out var motId))
        {
            var motorista = await motoristaRepo.ObterPorIdAsync(motId);
            if (motorista is not null)
            {
                await atendimentoRepo.CriarAsync(new Atendimento
                {
                    SolicitacaoId = id,
                    MotoristaId = motorista.Id,
                    HoraInicio = DateTime.UtcNow,
                    ValorFinal = sol.ValorTotal
                });
                await motoristaRepo.AtualizarDisponibilidadeAsync(motorista.Id, false);
            }
        }

        await hub.NotificarReboqueAcionadoAsync(id, request.EtaMinutos);
    }

    // ─── CHEGOU ───────────────────────────────────────────────
    public async Task RegistrarChegadaAsync(int id)
    {
        var sol = await solicitacaoRepo.ObterPorIdAsync(id)
            ?? throw new KeyNotFoundException($"Solicitação {id} não encontrada.");

        await solicitacaoRepo.AtualizarStatusAsync(id, "chegou");

        var atendimento = await atendimentoRepo.ObterPorSolicitacaoAsync(id);
        if (atendimento is not null)
        {
            atendimento.HoraFim = DateTime.UtcNow;
            await atendimentoRepo.AtualizarAsync(atendimento);
            await motoristaRepo.AtualizarDisponibilidadeAsync(atendimento.MotoristaId, true);
        }

        await hub.NotificarReboqueChegouAsync(id);
    }

    // ─── CANCELAR ─────────────────────────────────────────────
    public async Task CancelarAsync(int id)
    {
        await solicitacaoRepo.AtualizarStatusAsync(id, "cancelado");
        await hub.NotificarSolicitacaoCanceladaAsync(id);
    }

    // ─── AVALIAR ──────────────────────────────────────────────
    public async Task AvaliarAsync(int id, AvaliarRequest request)
    {
        var atendimento = await atendimentoRepo.ObterPorSolicitacaoAsync(id)
            ?? throw new KeyNotFoundException("Atendimento não encontrado.");

        await avaliacaoRepo.CriarAsync(new Avaliacao
        {
            AtendimentoId = atendimento.Id,
            Nota = request.Nota,
            Comentario = request.Comentario
        });

        await solicitacaoRepo.AtualizarStatusAsync(id, "avaliado");
        await hub.NotificarSolicitacaoAvaliadaAsync(id, request.Nota, request.Comentario);
    }

    // ─── LOCALIZAÇÃO ──────────────────────────────────────────
    public async Task AtualizarLocalizacaoAsync(int id, AtualizarLocalizacaoRequest request)
    {
        await solicitacaoRepo.AtualizarEtaAsync(id, request.EtaMinutos);

        var atendimento = await atendimentoRepo.ObterPorSolicitacaoAsync(id);
        if (atendimento is not null)
            await motoristaRepo.AtualizarLocalizacaoAsync(
                atendimento.MotoristaId, request.Lat, request.Lng);

        await hub.NotificarLocalizacaoAsync(id, request.Lat, request.Lng, request.EtaMinutos);
    }

    // ─── FINANCEIRO ───────────────────────────────────────────
    public async Task<ResumoFinanceiroResponse> ObterResumoFinanceiroAsync()
    {
        var todas = (await solicitacaoRepo.ListarAsync()).ToList();

        var concluidas = todas.Where(s => s.Status is "chegou" or "avaliado").ToList();
        var pendentes  = todas.Where(s => s.Status is "aguardando" or "acionado").ToList();

        var totalFat    = concluidas.Sum(s => s.ValorTotal ?? 0);
        var totalPend   = pendentes.Sum(s => s.ValorTotal ?? 0);
        var ticketMedio = concluidas.Count > 0 ? totalFat / concluidas.Count : 0;

        var porTipo = concluidas
            .GroupBy(s => s.Veiculo?.TipoVeiculo ?? "passeio")
            .Select(g => new FaturamentoPorTipoResponse(g.Key, g.Sum(x => x.ValorTotal ?? 0), g.Count()));

        var porUrgencia = concluidas
            .GroupBy(s => s.Urgencia ?? "normal")
            .Select(g => new FaturamentoPorUrgenciaResponse(g.Key, g.Sum(x => x.ValorTotal ?? 0), g.Count()));

        return new ResumoFinanceiroResponse(
            totalFat, concluidas.Count, ticketMedio,
            totalPend, pendentes.Count, porTipo, porUrgencia
        );
    }

    // ─── MAP ──────────────────────────────────────────────────
    private static SolicitacaoResponse Map(Solicitacao s) => new(
        Id:           $"{s.Id}",
        IdNumerico:   s.Id,
        Placa:        s.Veiculo?.Placa ?? "",
        Modelo:       s.Veiculo?.Modelo ?? "",
        Origem:       s.Origem,
        Destino:      s.Destino,
        Status:       s.Status,
        Horario:      s.DataSolicitacao.ToLocalTime().ToString("HH:mm"),
        DistanciaKm:  s.DistanciaKm,
        TipoVeiculo:  s.Veiculo?.TipoVeiculo,
        Urgencia:     s.Urgencia,
        ValorTotal:   s.ValorTotal,
        LatOrigem:    s.LatOrigem,
        LngOrigem:    s.LngOrigem,
        Eta:          s.EtaMinutos,
        Nota:         s.Atendimento?.Avaliacao?.Nota,
        Comentario:   s.Atendimento?.Avaliacao?.Comentario
    );
}
