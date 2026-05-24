using BCrypt.Net;
using ReboqueApp.Application.DTOs.Requests;
using ReboqueApp.Application.DTOs.Responses;
using ReboqueApp.Application.Interfaces;
using ReboqueApp.Domain.Entities;
using ReboqueApp.Domain.Interfaces;

namespace ReboqueApp.Application.Services;

public class AuthService(
    IUsuarioRepository usuarioRepo,
    IMotoristaRepository motoristaRepo,
    IJwtService jwtService) : IAuthService
{
    public async Task<UsuarioResponse> CadastrarClienteAsync(CadastroClienteRequest request)
    {
        if (await usuarioRepo.EmailExisteAsync(request.Email))
            throw new InvalidOperationException("E-mail já cadastrado.");

        var usuario = new Usuario
        {
            Nome = $"{request.Nome} {request.Sobrenome}",
            Email = request.Email.ToLowerInvariant(),
            Senha = BCrypt.Net.BCrypt.HashPassword(request.Senha),
            Telefone = request.Telefone,
            TipoUsuario = "cliente"
        };

        var criado = await usuarioRepo.CriarAsync(usuario);
        return MapUsuario(criado);
    }

    public async Task<UsuarioResponse> CadastrarMotoristaAsync(CriarMotoristaRequest request)
    {
        if (await usuarioRepo.EmailExisteAsync(request.Email))
            throw new InvalidOperationException("E-mail já cadastrado.");

        var usuario = new Usuario
        {
            Nome = request.Nome,
            Email = request.Email.ToLowerInvariant(),
            Senha = BCrypt.Net.BCrypt.HashPassword(request.Senha),
            Telefone = request.Telefone,
            TipoUsuario = "motorista"
        };

        var criado = await usuarioRepo.CriarAsync(usuario);

        var motorista = new Motorista
        {
            UsuarioId = criado.Id,
            Cnh = request.Cnh,
            Disponivel = false
        };

        await motoristaRepo.CriarAsync(motorista);
        return MapUsuario(criado);
    }

    public async Task<LoginResponse> LoginAsync(LoginRequest request)
    {
        var usuario = await usuarioRepo.ObterPorEmailAsync(request.Email.ToLowerInvariant())
            ?? throw new UnauthorizedAccessException("Credenciais inválidas.");

        if (!BCrypt.Net.BCrypt.Verify(request.Senha, usuario.Senha))
            throw new UnauthorizedAccessException("Credenciais inválidas.");

        var token = jwtService.GerarToken(usuario);

        return new LoginResponse(
            usuario.Id,
            usuario.Nome,
            usuario.Email,
            usuario.TipoUsuario,
            token
        );
    }

    private static UsuarioResponse MapUsuario(Usuario u) => new(
        u.Id, u.Nome, u.Email, u.Telefone, u.TipoUsuario, u.DataCriacao
    );
}
