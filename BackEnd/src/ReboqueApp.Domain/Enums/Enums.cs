namespace ReboqueApp.Domain.Enums;

public enum StatusSolicitacao
{
    Aguardando,
    Acionado,
    Chegou,
    Avaliado,
    Cancelado
}

public enum TipoUsuario
{
    Cliente,
    Motorista,
    Central
}

public enum TipoVeiculo
{
    Passeio,
    Suv,
    Moto,
    Utilitario
}

public enum UrgenciaSolicitacao
{
    Normal,
    Prioritario,
    Expresso
}
