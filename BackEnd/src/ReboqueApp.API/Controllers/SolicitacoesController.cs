using System.Security.Claims;
using FluentValidation;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using ReboqueApp.Application.DTOs.Requests;
using ReboqueApp.Application.Interfaces;

namespace ReboqueApp.API.Controllers;

/// <summary>
/// Endpoints consumidos pela Central (central.js) e pelo Cliente (cliente.js).
///
/// GET    /api/solicitacoes                  → lista todas (Central)
/// GET    /api/solicitacoes/ativas           → apenas aguardando/acionado (Central)
/// GET    /api/solicitacoes/minha            → solicitações do cliente logado
/// GET    /api/solicitacoes/{id}             → detalhe
/// POST   /api/solicitacoes                  → criar nova (Cliente)
/// POST   /api/solicitacoes/{id}/acionar     → Central aciona reboque
/// POST   /api/solicitacoes/{id}/chegou      → Central/Motorista registra chegada
/// POST   /api/solicitacoes/{id}/cancelar    → cancelar
/// POST   /api/solicitacoes/{id}/avaliar     → cliente avalia (Cliente)
/// POST   /api/solicitacoes/{id}/localizacao → motorista envia GPS (Motorista)
/// GET    /api/financeiro                    → resumo financeiro (Central)
/// </summary>
[ApiController]
[Route("api/solicitacoes")]
public class SolicitacoesController(
    ISolicitacaoService service,
    IValidator<CriarSolicitacaoRequest> criarValidator,
    IValidator<AvaliarRequest> avaliarValidator,
    IValidator<AcionarSolicitacaoRequest> acionarValidator) : ControllerBase
{
    // ─── LISTAGENS ────────────────────────────────────────────

    [HttpGet]
    public async Task<IActionResult> ListarTodas()
        => Ok(await service.ListarTodasAsync());

    [HttpGet("ativas")]
    public async Task<IActionResult> ListarAtivas()
        => Ok(await service.ListarAtivasAsync());

    [HttpGet("minha")]
    [Authorize]
    public async Task<IActionResult> MinhasSolicitacoes()
    {
        var usuarioId = ObterUsuarioId();
        if (usuarioId == 0) return Unauthorized();
        return Ok(await service.ListarPorClienteAsync(usuarioId));
    }

    [HttpGet("{id:int}")]
    public async Task<IActionResult> ObterPorId(int id)
    {
        var sol = await service.ObterPorIdAsync(id);
        return sol is null ? NotFound() : Ok(sol);
    }

    // ─── CRIAR (Cliente) ──────────────────────────────────────

    [HttpPost]
    public async Task<IActionResult> Criar([FromBody] CriarSolicitacaoRequest request)
    {
        var validation = await criarValidator.ValidateAsync(request);
        if (!validation.IsValid)
            return BadRequest(validation.Errors.Select(e => e.ErrorMessage));

        try
        {
            // Se autenticado usa o usuário logado, senão usa ID 1 (demo sem auth)
            var usuarioId = ObterUsuarioId() > 0 ? ObterUsuarioId() : 1;
            var result = await service.CriarAsync(usuarioId, request);
            return StatusCode(201, result);
        }
        catch (InvalidOperationException ex) when (ex.Message.Contains("solicitação ativa"))
        {
            return Conflict(new { message = ex.Message });
        }
    }

    // ─── ACIONAR (Central) ────────────────────────────────────

    [HttpPost("{id:int}/acionar")]
    public async Task<IActionResult> Acionar(int id, [FromBody] AcionarSolicitacaoRequest request)
    {
        var validation = await acionarValidator.ValidateAsync(request);
        if (!validation.IsValid)
            return BadRequest(validation.Errors.Select(e => e.ErrorMessage));

        await service.AcionarAsync(id, request);
        return NoContent();
    }

    // ─── CHEGOU ───────────────────────────────────────────────

    [HttpPost("{id:int}/chegou")]
    public async Task<IActionResult> Chegou(int id)
    {
        await service.RegistrarChegadaAsync(id);
        return NoContent();
    }

    // ─── CANCELAR ─────────────────────────────────────────────

    [HttpPost("{id:int}/cancelar")]
    public async Task<IActionResult> Cancelar(int id)
    {
        await service.CancelarAsync(id);
        return NoContent();
    }

    // ─── AVALIAR (Cliente) ────────────────────────────────────

    [HttpPost("{id:int}/avaliar")]
    public async Task<IActionResult> Avaliar(int id, [FromBody] AvaliarRequest request)
    {
        var validation = await avaliarValidator.ValidateAsync(request);
        if (!validation.IsValid)
            return BadRequest(validation.Errors.Select(e => e.ErrorMessage));

        await service.AvaliarAsync(id, request);
        return NoContent();
    }

    // ─── LOCALIZAÇÃO (Motorista) ──────────────────────────────

    [HttpPost("{id:int}/localizacao")]
    public async Task<IActionResult> AtualizarLocalizacao(int id, [FromBody] AtualizarLocalizacaoRequest request)
    {
        await service.AtualizarLocalizacaoAsync(id, request);
        return NoContent();
    }

    // ─── UTIL ─────────────────────────────────────────────────

    private int ObterUsuarioId()
    {
        var claim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        return int.TryParse(claim, out var id) ? id : 0;
    }
}

// ─── FINANCEIRO (Central) ─────────────────────────────────────
[ApiController]
[Route("api/financeiro")]
public class FinanceiroController(ISolicitacaoService service) : ControllerBase
{
    [HttpGet]
    public async Task<IActionResult> Resumo()
        => Ok(await service.ObterResumoFinanceiroAsync());
}
