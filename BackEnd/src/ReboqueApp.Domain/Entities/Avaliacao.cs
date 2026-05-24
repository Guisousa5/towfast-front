namespace ReboqueApp.Domain.Entities;

public class Avaliacao
{
    public int Id { get; set; }
    public int AtendimentoId { get; set; }
    public int? Nota { get; set; }
    public string? Comentario { get; set; }

    // Navegação
    public Atendimento Atendimento { get; set; } = null!;
}
