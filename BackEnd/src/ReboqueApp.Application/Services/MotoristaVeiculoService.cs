using ReboqueApp.Application.DTOs.Requests;
using ReboqueApp.Application.DTOs.Responses;
using ReboqueApp.Application.Interfaces;
using ReboqueApp.Domain.Entities;
using ReboqueApp.Domain.Interfaces;

namespace ReboqueApp.Application.Services;

public class MotoristaService(
    IMotoristaRepository motoristaRepo) : IMotoristaService
{
    public async Task<IEnumerable<MotoristaResponse>> ListarDisponiveisAsync()
    {
        var lista = await motoristaRepo.ListarDisponiveisAsync();
        return lista.Select(Map);
    }

    public async Task<MotoristaResponse?> ObterPorIdAsync(int id)
    {
        var m = await motoristaRepo.ObterPorIdAsync(id);
        return m is null ? null : Map(m);
    }

    public async Task<MotoristaResponse?> ObterPorUsuarioIdAsync(int usuarioId)
    {
        var m = await motoristaRepo.ObterPorUsuarioIdAsync(usuarioId);
        return m is null ? null : Map(m);
    }

    public async Task AtualizarDisponibilidadeAsync(int motoristaId, bool disponivel)
        => await motoristaRepo.AtualizarDisponibilidadeAsync(motoristaId, disponivel);

    public async Task AtualizarLocalizacaoAsync(int motoristaId, decimal lat, decimal lng)
        => await motoristaRepo.AtualizarLocalizacaoAsync(motoristaId, lat, lng);

    private static MotoristaResponse Map(Motorista m) => new(
        m.Id,
        m.UsuarioId,
        m.Usuario?.Nome ?? "",
        m.Usuario?.Email ?? "",
        m.Cnh,
        m.Disponivel,
        m.Latitude,
        m.Longitude
    );
}

public class VeiculoService(
    IVeiculoRepository veiculoRepo) : IVeiculoService
{
    public async Task<IEnumerable<VeiculoResponse>> ListarPorClienteAsync(int usuarioId)
    {
        var lista = await veiculoRepo.ListarPorUsuarioAsync(usuarioId);
        return lista.Select(Map);
    }

    public async Task<VeiculoResponse> CriarAsync(int usuarioId, CriarVeiculoRequest request)
    {
        var veiculo = await veiculoRepo.CriarAsync(new Veiculo
        {
            UsuarioId = usuarioId,
            Placa = request.Placa.ToUpperInvariant(),
            Modelo = request.Modelo,
            Marca = request.Marca,
            TipoVeiculo = request.TipoVeiculo
        });
        return Map(veiculo);
    }

    public async Task<VeiculoResponse?> ObterPorPlacaAsync(string placa)
    {
        var v = await veiculoRepo.ObterPorPlacaAsync(placa.ToUpperInvariant());
        return v is null ? null : Map(v);
    }

    private static VeiculoResponse Map(Veiculo v) => new(
        v.Id, v.UsuarioId, v.Marca, v.Modelo, v.Placa, v.TipoVeiculo
    );
}
