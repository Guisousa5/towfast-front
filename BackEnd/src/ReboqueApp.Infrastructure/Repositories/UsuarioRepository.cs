using Dapper;
using ReboqueApp.Domain.Entities;
using ReboqueApp.Domain.Interfaces;
using ReboqueApp.Infrastructure.Persistence;

namespace ReboqueApp.Infrastructure.Repositories;

public class UsuarioRepository(IDbConnectionFactory db) : IUsuarioRepository
{
    public async Task<Usuario?> ObterPorIdAsync(int id)
    {
        using var conn = db.CreateConnection();
        return await conn.QueryFirstOrDefaultAsync<Usuario>(
            "SELECT * FROM public.usuarios WHERE id = @Id", new { Id = id });
    }

    public async Task<Usuario?> ObterPorEmailAsync(string email)
    {
        using var conn = db.CreateConnection();
        return await conn.QueryFirstOrDefaultAsync<Usuario>(
            "SELECT * FROM public.usuarios WHERE email = @Email", new { Email = email });
    }

    public async Task<IEnumerable<Usuario>> ListarAsync()
    {
        using var conn = db.CreateConnection();
        return await conn.QueryAsync<Usuario>("SELECT * FROM public.usuarios ORDER BY data_criacao DESC");
    }

    public async Task<Usuario> CriarAsync(Usuario usuario)
    {
        using var conn = db.CreateConnection();
        var id = await conn.ExecuteScalarAsync<int>(@"
            INSERT INTO public.usuarios (nome, email, senha, telefone, tipo_usuario, data_criacao)
            VALUES (@Nome, @Email, @Senha, @Telefone, @TipoUsuario, @DataCriacao)
            RETURNING id",
            new
            {
                usuario.Nome,
                usuario.Email,
                usuario.Senha,
                usuario.Telefone,
                TipoUsuario = usuario.TipoUsuario,
                DataCriacao = DateTime.UtcNow
            });

        usuario.Id = id;
        return usuario;
    }

    public async Task AtualizarAsync(Usuario usuario)
    {
        using var conn = db.CreateConnection();
        await conn.ExecuteAsync(@"
            UPDATE public.usuarios
            SET nome = @Nome, telefone = @Telefone
            WHERE id = @Id",
            new { usuario.Nome, usuario.Telefone, usuario.Id });
    }

    public async Task<bool> EmailExisteAsync(string email)
    {
        using var conn = db.CreateConnection();
        return await conn.ExecuteScalarAsync<bool>(
            "SELECT EXISTS(SELECT 1 FROM public.usuarios WHERE email = @Email)", new { Email = email });
    }
}
