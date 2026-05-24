namespace ReboqueApp.Domain.Entities;

public class Atendimento
{
    public int Id { get; set; }
    public int SolicitacaoId { get; set; }
    public int MotoristaId { get; set; }
    public DateTime? HoraInicio { get; set; }
    public DateTime? HoraFim { get; set; }
    public decimal? ValorFinal { get; set; }

    // Navegação
    public Solicitacao Solicitacao { get; set; } = null!;
    public Motorista Motorista { get; set; } = null!;
    public Avaliacao? Avaliacao { get; set; }
}
