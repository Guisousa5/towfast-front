namespace ReboqueApp.Application.DTOs.Responses;

// ─── AUTH / USUARIO ───────────────────────────────────────────
public record UsuarioResponse(
    int Id,
    string Nome,
    string Email,
    string? Telefone,
    string TipoUsuario,
    DateTime DataCriacao
);

public record LoginResponse(
    int Id,
    string Nome,
    string Email,
    string TipoUsuario,
    string Token
);

// ─── VEICULO ──────────────────────────────────────────────────
public record VeiculoResponse(
    int Id,
    int UsuarioId,
    string? Marca,
    string? Modelo,
    string? Placa,
    string? TipoVeiculo
);

// ─── SOLICITAÇÃO ──────────────────────────────────────────────
public record SolicitacaoResponse(
    string Id,          // prefixado "SOL-{id}" para o frontend
    int IdNumerico,
    string Placa,
    string Modelo,
    string? Origem,
    string? Destino,
    string Status,
    string Horario,     // HH:mm
    decimal? DistanciaKm,
    string? TipoVeiculo,
    string? Urgencia,
    decimal? ValorTotal,
    decimal? LatOrigem,
    decimal? LngOrigem,
    int? Eta,
    int? Nota,
    string? Comentario
);

// ─── ATENDIMENTO ──────────────────────────────────────────────
public record AtendimentoResponse(
    int Id,
    string SolicitacaoId,
    int MotoristaId,
    DateTime? HoraInicio,
    DateTime? HoraFim,
    decimal? ValorFinal,
    AvaliacaoResponse? Avaliacao
);

public record AvaliacaoResponse(
    int Id,
    int Nota,
    string? Comentario
);

// ─── MOTORISTA ────────────────────────────────────────────────
public record MotoristaResponse(
    int Id,
    int UsuarioId,
    string Nome,
    string Email,
    string? Cnh,
    bool Disponivel,
    decimal? Latitude,
    decimal? Longitude
);

// ─── FINANCEIRO (Central) ─────────────────────────────────────
public record ResumoFinanceiroResponse(
    decimal FaturamentoTotal,
    int TotalAtendimentos,
    decimal TicketMedio,
    decimal TotalPendente,
    int EmAndamento,
    IEnumerable<FaturamentoPorTipoResponse> PorTipo,
    IEnumerable<FaturamentoPorUrgenciaResponse> PorUrgencia
);

public record FaturamentoPorTipoResponse(string Tipo, decimal Total, int Quantidade);
public record FaturamentoPorUrgenciaResponse(string Urgencia, decimal Total, int Quantidade);

// ─── LOCALIZAÇÃO REAL-TIME ────────────────────────────────────
public record LocalizacaoPayload(
    int SolicitacaoId,
    decimal Lat,
    decimal Lng,
    int EtaMinutos
);
