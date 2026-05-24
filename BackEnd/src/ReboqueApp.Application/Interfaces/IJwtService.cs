using ReboqueApp.Domain.Entities;

namespace ReboqueApp.Application.Interfaces;

public interface IJwtService
{
    string GerarToken(Usuario usuario);
    int? ObterUsuarioId(string token);
}
