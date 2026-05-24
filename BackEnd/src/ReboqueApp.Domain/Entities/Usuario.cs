using ReboqueApp.Domain.Enums;

namespace ReboqueApp.Domain.Entities;

public class Usuario
{
    public int Id { get; set; }
    public string Nome { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string Senha { get; set; } = string.Empty;
    public string? Telefone { get; set; }
    public string TipoUsuario { get; set; } = string.Empty;
    public DateTime DataCriacao { get; set; } = DateTime.UtcNow;

    // Navegação
    public Motorista? Motorista { get; set; }
    public ICollection<Veiculo> Veiculos { get; set; } = new List<Veiculo>();
    public ICollection<Solicitacao> Solicitacoes { get; set; } = new List<Solicitacao>();
}
