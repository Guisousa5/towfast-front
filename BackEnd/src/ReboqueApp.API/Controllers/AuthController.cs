using FluentValidation;
using Microsoft.AspNetCore.Mvc;
using ReboqueApp.Application.DTOs.Requests;
using ReboqueApp.Application.Interfaces;

namespace ReboqueApp.API.Controllers;

/// <summary>
/// Endpoints para a tela de Login e Cadastro (auth.html).
/// POST /api/clientes       → cadastro de cliente
/// POST /api/clientes/login → login
/// POST /api/motoristas     → cadastro de motorista
/// </summary>
[ApiController]
[Route("api")]
public class AuthController(
    IAuthService authService,
    IValidator<CadastroClienteRequest> cadValidator,
    IValidator<LoginRequest> loginValidator) : ControllerBase
{
    // ─── CADASTRO CLIENTE ─────────────────────────────────────
    [HttpPost("clientes")]
    public async Task<IActionResult> CadastrarCliente([FromBody] CadastroClienteRequest request)
    {
        var validation = await cadValidator.ValidateAsync(request);
        if (!validation.IsValid)
            return BadRequest(validation.Errors.Select(e => e.ErrorMessage));

        var result = await authService.CadastrarClienteAsync(request);
        return StatusCode(201);
    }

    // ─── LOGIN ────────────────────────────────────────────────
    [HttpPost("clientes/login")]
    public async Task<IActionResult> Login([FromBody] LoginRequest request)
    {
        var validation = await loginValidator.ValidateAsync(request);
        if (!validation.IsValid)
            return BadRequest(validation.Errors.Select(e => e.ErrorMessage));

        var result = await authService.LoginAsync(request);
        return Ok(result);
    }

    // ─── CADASTRO MOTORISTA ───────────────────────────────────
    [HttpPost("motoristas/cadastro")]
    public async Task<IActionResult> CadastrarMotorista([FromBody] CriarMotoristaRequest request)
    {
        var result = await authService.CadastrarMotoristaAsync(request);
        return StatusCode(201, result);
    }
}
