using Microsoft.AspNetCore.SignalR;

namespace ReboqueApp.Infrastructure.Hubs;

/// <summary>
/// Hub principal: conecta Central, Cliente e Motorista em tempo real.
///
/// Grupos:
///   "central"      → todos os operadores da central
///   "sol-{id}"     → cliente + motorista de uma solicitação específica
///   "motoristas"   → todos os motoristas disponíveis
/// </summary>
public class ReboqueHub : Hub
{
    // ─── CENTRAL ──────────────────────────────────────────────
    public async Task EntrarGrupoCentral()
        => await Groups.AddToGroupAsync(Context.ConnectionId, "central");

    // ─── CLIENTE ──────────────────────────────────────────────
    public async Task EntrarGrupo(string solicitacaoId)
        => await Groups.AddToGroupAsync(Context.ConnectionId, $"sol-{solicitacaoId}");

    public async Task SairGrupo(string solicitacaoId)
        => await Groups.RemoveFromGroupAsync(Context.ConnectionId, $"sol-{solicitacaoId}");

    public async Task CancelarSolicitacao(string solicitacaoId)
    {
        await Clients.Group("central").SendAsync("SolicitacaoCancelada", solicitacaoId);
        await Clients.Group($"sol-{solicitacaoId}").SendAsync("SolicitacaoCancelada", solicitacaoId);
    }

    // ─── MOTORISTA ────────────────────────────────────────────
    public async Task EntrarGrupoMotoristas()
        => await Groups.AddToGroupAsync(Context.ConnectionId, "motoristas");

    public async Task MotoristaDisponivel(object payload)
        => await Clients.Group("central").SendAsync("MotoristaDisponivel", payload);
}
