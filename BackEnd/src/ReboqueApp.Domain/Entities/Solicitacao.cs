namespace ReboqueApp.Domain.Entities;

public class Solicitacao
{
    public int Id { get; set; }
    public int UsuarioId { get; set; }
    public int VeiculoId { get; set; }
    public string? Origem { get; set; }
    public string? Destino { get; set; }
    public decimal? DistanciaKm { get; set; }
    public decimal? ValorEstimado { get; set; }
    public string Status { get; set; } = "aguardando";
    public DateTime DataSolicitacao { get; set; } = DateTime.UtcNow;

    // Campos extras mapeados como colunas adicionais no Supabase
    public decimal? LatOrigem { get; set; }
    public decimal? LngOrigem { get; set; }
    public string? Urgencia { get; set; }
    public decimal? ValorTotal { get; set; }
    public int? EtaMinutos { get; set; }

    // Navegação
    public Usuario Usuario { get; set; } = null!;
    public Veiculo Veiculo { get; set; } = null!;
    public Atendimento? Atendimento { get; set; }
}
