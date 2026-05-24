using Microsoft.AspNetCore.SignalR;
using ReboqueApp.Application.DTOs.Responses;
using ReboqueApp.Application.Interfaces;
using ReboqueApp.Infrastructure.Hubs;

namespace ReboqueApp.Infrastructure.Services;

/// <summary>
/// Serviço que encapsula envios SignalR para os grupos corretos,
/// conforme os handlers definidos no JS do frontend.
/// </summary>
public class ReboqueHubService(IHubContext<ReboqueHub> hub) : IReboqueHubService
{
    // Central recebe nova solicitação (NovaSolicitacao)
    public async Task NotificarNovaSolicitacaoAsync(SolicitacaoResponse sol)
        => await hub.Clients.Group("central").SendAsync("NovaSolicitacao", sol);

    // Central e cliente recebem cancelamento
    public async Task NotificarSolicitacaoCanceladaAsync(int solicitacaoId)
    {
        await hub.Clients.Group("central").SendAsync("SolicitacaoCancelada", solicitacaoId);
        await hub.Clients.Group($"sol-{solicitacaoId}").SendAsync("SolicitacaoCancelada", solicitacaoId);
    }

    // Central e cliente recebem avaliação
    public async Task NotificarSolicitacaoAvaliadaAsync(int solicitacaoId, int nota, string? comentario)
    {
        var payload = new { id = solicitacaoId, nota, comentario };
        await hub.Clients.Group("central").SendAsync("SolicitacaoAvaliada", payload);
        await hub.Clients.Group($"sol-{solicitacaoId}").SendAsync("SolicitacaoAvaliada", payload);
    }

    // Central e cliente recebem atualização de localização em tempo real
    public async Task NotificarLocalizacaoAsync(int solicitacaoId, decimal lat, decimal lng, int eta)
    {
        var payload = new { solicitacaoId, lat, lng, etaMinutos = eta };
        await hub.Clients.Group("central").SendAsync("AtualizarLocalizacao", payload);
        await hub.Clients.Group($"sol-{solicitacaoId}").SendAsync("AtualizarLocalizacao", payload);
    }

    // Cliente recebe confirmação de acionamento
    public async Task NotificarReboqueAcionadoAsync(int solicitacaoId, int eta)
        => await hub.Clients.Group($"sol-{solicitacaoId}")
            .SendAsync("ReboqueAcionado", new { solicitacaoId, etaMinutos = eta });

    // Cliente recebe confirmação de chegada
    public async Task NotificarReboqueChegouAsync(int solicitacaoId)
        => await hub.Clients.Group($"sol-{solicitacaoId}").SendAsync("ReboqueChegou");
}
