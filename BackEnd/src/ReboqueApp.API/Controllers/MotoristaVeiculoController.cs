using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using ReboqueApp.Application.DTOs.Requests;
using ReboqueApp.Application.Interfaces;

namespace ReboqueApp.API.Controllers;

/// <summary>
/// Endpoints para a tela do Motorista (motorista.js).
///
/// GET   /api/motoristas                     → lista disponíveis (Central)
/// GET   /api/motoristas/{id}                → detalhe
/// GET   /api/motoristas/meu                 → perfil do motorista logado
/// PATCH /api/motoristas/{id}/disponibilidade → toggle online/offline
/// POST  /api/motoristas/{id}/localizacao    → atualiza GPS
/// </summary>
[ApiController]
[Route("api/motoristas")]
public class MotoristaController(IMotoristaService motoristaService) : ControllerBase
{
    [HttpGet]
    public async Task<IActionResult> ListarDisponiveis()
        => Ok(await motoristaService.ListarDisponiveisAsync());

    [HttpGet("{id:int}")]
    public async Task<IActionResult> ObterPorId(int id)
    {
        var m = await motoristaService.ObterPorIdAsync(id);
        return m is null ? NotFound() : Ok(m);
    }

    [HttpGet("meu")]
    [Authorize]
    public async Task<IActionResult> MeuPerfil()
    {
        var usuarioId = ObterUsuarioId();
        if (usuarioId == 0) return Unauthorized();
        var m = await motoristaService.ObterPorUsuarioIdAsync(usuarioId);
        return m is null ? NotFound() : Ok(m);
    }

    [HttpPatch("{id:int}/disponibilidade")]
    public async Task<IActionResult> AtualizarDisponibilidade(
        int id, [FromBody] AtualizarDisponibilidadeRequest request)
    {
        await motoristaService.AtualizarDisponibilidadeAsync(id, request.Disponivel);
        return NoContent();
    }

    [HttpPost("{id:int}/localizacao")]
    public async Task<IActionResult> AtualizarLocalizacao(
        int id, [FromBody] AtualizarLocalizacaoRequest request)
    {
        await motoristaService.AtualizarLocalizacaoAsync(id, request.Lat, request.Lng);
        return NoContent();
    }

    private int ObterUsuarioId()
    {
        var claim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        return int.TryParse(claim, out var id) ? id : 0;
    }
}

/// <summary>
/// Endpoints para veículos do cliente (cliente.js).
///
/// GET  /api/veiculos          → lista veículos do usuário logado
/// POST /api/veiculos          → adiciona veículo
/// GET  /api/veiculos/{placa}  → busca por placa
/// </summary>
[ApiController]
[Route("api/veiculos")]
public class VeiculoController(IVeiculoService veiculoService) : ControllerBase
{
    [HttpGet]
    [Authorize]
    public async Task<IActionResult> Listar()
    {
        var usuarioId = ObterUsuarioId();
        if (usuarioId == 0) return Unauthorized();
        return Ok(await veiculoService.ListarPorClienteAsync(usuarioId));
    }

    [HttpPost]
    [Authorize]
    public async Task<IActionResult> Criar([FromBody] CriarVeiculoRequest request)
    {
        var usuarioId = ObterUsuarioId();
        if (usuarioId == 0) return Unauthorized();
        var result = await veiculoService.CriarAsync(usuarioId, request);
        return StatusCode(201, result);
    }

    [HttpGet("{placa}")]
    public async Task<IActionResult> BuscarPorPlaca(string placa)
    {
        var v = await veiculoService.ObterPorPlacaAsync(placa);
        return v is null ? NotFound() : Ok(v);
    }

    private int ObterUsuarioId()
    {
        var claim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        return int.TryParse(claim, out var id) ? id : 0;
    }
}
