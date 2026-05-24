using FluentValidation;
using ReboqueApp.Application.DTOs.Requests;

namespace ReboqueApp.Application.Validators;

public class CadastroClienteValidator : AbstractValidator<CadastroClienteRequest>
{
    public CadastroClienteValidator()
    {
        RuleFor(x => x.Nome).NotEmpty().WithMessage("Nome é obrigatório.");
        RuleFor(x => x.Sobrenome).NotEmpty().WithMessage("Sobrenome é obrigatório.");
        RuleFor(x => x.Email).EmailAddress().WithMessage("E-mail inválido.");
        RuleFor(x => x.Cpf).Length(11).WithMessage("CPF deve ter 11 dígitos.");
        RuleFor(x => x.Telefone).MinimumLength(10).WithMessage("Telefone inválido.");
        RuleFor(x => x.Senha).MinimumLength(8).WithMessage("Senha deve ter no mínimo 8 caracteres.");
    }
}

public class LoginValidator : AbstractValidator<LoginRequest>
{
    public LoginValidator()
    {
        RuleFor(x => x.Email).EmailAddress().WithMessage("E-mail inválido.");
        RuleFor(x => x.Senha).NotEmpty().WithMessage("Senha é obrigatória.");
    }
}

public class CriarSolicitacaoValidator : AbstractValidator<CriarSolicitacaoRequest>
{
    private static readonly string[] TiposValidos = ["passeio", "suv", "moto", "utilitario"];
    private static readonly string[] UrgenciasValidas = ["normal", "prioritario", "expresso"];

    public CriarSolicitacaoValidator()
    {
        RuleFor(x => x.Placa).NotEmpty().WithMessage("Placa é obrigatória.");
        RuleFor(x => x.Modelo).NotEmpty().WithMessage("Modelo é obrigatório.");
        RuleFor(x => x.Origem).NotEmpty().WithMessage("Origem é obrigatória.");
        RuleFor(x => x.Destino).NotEmpty().WithMessage("Destino é obrigatório.");
        RuleFor(x => x.DistanciaKm).GreaterThan(0).WithMessage("Distância inválida.");
        RuleFor(x => x.ValorTotal).GreaterThan(0).WithMessage("Valor inválido.");
    }
}

public class AvaliarValidator : AbstractValidator<AvaliarRequest>
{
    public AvaliarValidator()
    {
        RuleFor(x => x.Nota).InclusiveBetween(1, 5).WithMessage("Nota deve ser entre 1 e 5.");
    }
}

public class AcionarValidator : AbstractValidator<AcionarSolicitacaoRequest>
{
    public AcionarValidator()
    {
        RuleFor(x => x.EtaMinutos).GreaterThan(0).WithMessage("ETA deve ser maior que zero.");
    }
}
