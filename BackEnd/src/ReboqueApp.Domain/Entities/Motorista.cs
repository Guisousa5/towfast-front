namespace ReboqueApp.Domain.Entities;

public class Motorista
{
    public int Id { get; set; }
    public int UsuarioId { get; set; }
    public string? Cnh { get; set; }
    public bool Disponivel { get; set; } = true;
    public decimal? Latitude { get; set; }
    public decimal? Longitude { get; set; }

    // Navegação
    public Usuario Usuario { get; set; } = null!;
    public ICollection<Atendimento> Atendimentos { get; set; } = new List<Atendimento>();
}
