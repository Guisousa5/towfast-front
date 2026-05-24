using ReboqueApp.Application.DTOs.Requests;
using ReboqueApp.Application.DTOs.Responses;

namespace ReboqueApp.Application.Interfaces;

public interface IAuthService
{
    Task<LoginResponse> LoginAsync(LoginRequest request);
    Task<UsuarioResponse> CadastrarClienteAsync(CadastroClienteRequest request);
    Task<UsuarioResponse> CadastrarMotoristaAsync(CriarMotoristaRequest request);
}

public interface ISolicitacaoService
{
    Task<IEnumerable<SolicitacaoResponse>> ListarTodasAsync();
    Task<IEnumerable<SolicitacaoResponse>> ListarAtivasAsync();
    Task<IEnumerable<SolicitacaoResponse>> ListarPorClienteAsync(int usuarioId);
    Task<SolicitacaoResponse?> ObterPorIdAsync(int id);
    Task<SolicitacaoResponse> CriarAsync(int usuarioId, CriarSolicitacaoRequest request);
    Task AcionarAsync(int id, AcionarSolicitacaoRequest request);
    Task RegistrarChegadaAsync(int id);
    Task CancelarAsync(int id);
    Task AvaliarAsync(int id, AvaliarRequest request);
    Task AtualizarLocalizacaoAsync(int id, AtualizarLocalizacaoRequest request);
    Task<ResumoFinanceiroResponse> ObterResumoFinanceiroAsync();
}

public interface IMotoristaService
{
    Task<IEnumerable<MotoristaResponse>> ListarDisponiveisAsync();
    Task<MotoristaResponse?> ObterPorIdAsync(int id);
    Task<MotoristaResponse?> ObterPorUsuarioIdAsync(int usuarioId);
    Task AtualizarDisponibilidadeAsync(int usuarioId, bool disponivel);
    Task AtualizarLocalizacaoAsync(int usuarioId, decimal lat, decimal lng);
}

public interface IVeiculoService
{
    Task<IEnumerable<VeiculoResponse>> ListarPorClienteAsync(int usuarioId);
    Task<VeiculoResponse> CriarAsync(int usuarioId, CriarVeiculoRequest request);
    Task<VeiculoResponse?> ObterPorPlacaAsync(string placa);
}

public interface IReboqueHubService
{
    Task NotificarNovaSolicitacaoAsync(SolicitacaoResponse solicitacao);
    Task NotificarSolicitacaoCanceladaAsync(int solicitacaoId);
    Task NotificarSolicitacaoAvaliadaAsync(int solicitacaoId, int nota, string? comentario);
    Task NotificarLocalizacaoAsync(int solicitacaoId, decimal lat, decimal lng, int eta);
    Task NotificarReboqueAcionadoAsync(int solicitacaoId, int eta);
    Task NotificarReboqueChegouAsync(int solicitacaoId);
}
