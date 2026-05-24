namespace ReboqueApp.Domain.Entities;

public class Veiculo
{
    public int Id { get; set; }
    public int UsuarioId { get; set; }
    public string? Marca { get; set; }
    public string? Modelo { get; set; }
    public string? Placa { get; set; }
    public string? TipoVeiculo { get; set; }

    // Navegação
    public Usuario Usuario { get; set; } = null!;
    public ICollection<Solicitacao> Solicitacoes { get; set; } = new List<Solicitacao>();
}
