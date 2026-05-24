using ReboqueApp.Domain.Entities;

namespace ReboqueApp.Domain.Interfaces;

public interface IUsuarioRepository
{
    Task<Usuario?> ObterPorIdAsync(int id);
    Task<Usuario?> ObterPorEmailAsync(string email);
    Task<IEnumerable<Usuario>> ListarAsync();
    Task<Usuario> CriarAsync(Usuario usuario);
    Task AtualizarAsync(Usuario usuario);
    Task<bool> EmailExisteAsync(string email);
}

public interface IMotoristaRepository
{
    Task<Motorista?> ObterPorIdAsync(int id);
    Task<Motorista?> ObterPorUsuarioIdAsync(int usuarioId);
    Task<IEnumerable<Motorista>> ListarDisponiveisAsync();
    Task<Motorista> CriarAsync(Motorista motorista);
    Task AtualizarAsync(Motorista motorista);
    Task AtualizarLocalizacaoAsync(int motoristaId, decimal lat, decimal lng);
    Task AtualizarDisponibilidadeAsync(int motoristaId, bool disponivel);
}

public interface IVeiculoRepository
{
    Task<Veiculo?> ObterPorIdAsync(int id);
    Task<Veiculo?> ObterPorPlacaAsync(string placa);
    Task<IEnumerable<Veiculo>> ListarPorUsuarioAsync(int usuarioId);
    Task<Veiculo> CriarAsync(Veiculo veiculo);
    Task AtualizarAsync(Veiculo veiculo);
    Task RemoverAsync(int id);
}

public interface ISolicitacaoRepository
{
    Task<Solicitacao?> ObterPorIdAsync(int id);
    Task<IEnumerable<Solicitacao>> ListarAsync();
    Task<IEnumerable<Solicitacao>> ListarPorUsuarioAsync(int usuarioId);
    Task<IEnumerable<Solicitacao>> ListarAtivasAsync();
    Task<bool> TemSolicitacaoAtivaAsync(int usuarioId);
    Task<Solicitacao> CriarAsync(Solicitacao solicitacao);
    Task AtualizarAsync(Solicitacao solicitacao);
    Task AtualizarStatusAsync(int id, string status);
    Task AtualizarEtaAsync(int id, int etaMinutos);
}

public interface IAtendimentoRepository
{
    Task<Atendimento?> ObterPorIdAsync(int id);
    Task<Atendimento?> ObterPorSolicitacaoAsync(int solicitacaoId);
    Task<IEnumerable<Atendimento>> ListarPorMotoristaAsync(int motoristaId);
    Task<Atendimento> CriarAsync(Atendimento atendimento);
    Task AtualizarAsync(Atendimento atendimento);
}

public interface IAvaliacaoRepository
{
    Task<Avaliacao?> ObterPorAtendimentoAsync(int atendimentoId);
    Task<Avaliacao> CriarAsync(Avaliacao avaliacao);
}
