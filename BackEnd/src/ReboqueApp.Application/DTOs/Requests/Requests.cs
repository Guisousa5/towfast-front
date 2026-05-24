namespace ReboqueApp.Application.DTOs.Requests;

// ─── AUTH / USUARIO ───────────────────────────────────────────
public record CadastroClienteRequest(
    string Nome,
    string Sobrenome,
    string Email,
    string Cpf,
    string Telefone,
    string Senha
);

public record LoginRequest(
    string Email,
    string Senha
);

// ─── VEÍCULO ──────────────────────────────────────────────────
public record CriarVeiculoRequest(
    string Placa,
    string Modelo,
    string? Marca,
    string TipoVeiculo  // passeio | suv | moto | utilitario
);

// ─── SOLICITAÇÃO ──────────────────────────────────────────────
public record CriarSolicitacaoRequest(
    string Origem,
    string Destino,
    string Placa,
    string Modelo,
    decimal? LatOrigem,
    decimal? LngOrigem,
    decimal DistanciaKm,
    string TipoVeiculo,
    string Urgencia,
    decimal ValorTotal
);

public record AcionarSolicitacaoRequest(
    int EtaMinutos,
    string? MotoristaId = null
);

public record AtualizarLocalizacaoRequest(
    decimal Lat,
    decimal Lng,
    int EtaMinutos
);

public record AtualizarStatusRequest(
    string Status  // a_caminho | no_local | em_reboque | concluido
);

// ─── AVALIAÇÃO ────────────────────────────────────────────────
public record AvaliarRequest(
    int Nota,
    string? Comentario
);

// ─── MOTORISTA ────────────────────────────────────────────────
public record AtualizarDisponibilidadeRequest(
    bool Disponivel
);

public record CriarMotoristaRequest(
    string Nome,
    string Email,
    string Senha,
    string Telefone,
    string Cnh
);
