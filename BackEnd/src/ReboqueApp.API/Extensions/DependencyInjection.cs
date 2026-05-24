using System.Text;
using FluentValidation;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.IdentityModel.Tokens;
using ReboqueApp.Application.Interfaces;
using ReboqueApp.Application.Services;
using ReboqueApp.Application.Validators;
using ReboqueApp.Domain.Interfaces;
using ReboqueApp.Infrastructure.Hubs;
using ReboqueApp.Infrastructure.Persistence;
using ReboqueApp.Infrastructure.Repositories;
using ReboqueApp.Infrastructure.Services;

namespace ReboqueApp.API.Extensions;

public static class DependencyInjectionExtensions
{
    public static IServiceCollection AddInfrastructure(
        this IServiceCollection services, IConfiguration config)
    {
        // ─── BANCO ────────────────────────────────────────────
        services.AddSingleton<IDbConnectionFactory, SupabaseConnectionFactory>();

        // ─── REPOSITORIES ─────────────────────────────────────
        services.AddScoped<IUsuarioRepository, UsuarioRepository>();
        services.AddScoped<IMotoristaRepository, MotoristaRepository>();
        services.AddScoped<IVeiculoRepository, VeiculoRepository>();
        services.AddScoped<ISolicitacaoRepository, SolicitacaoRepository>();
        services.AddScoped<IAtendimentoRepository, AtendimentoRepository>();
        services.AddScoped<IAvaliacaoRepository, AvaliacaoRepository>();

        // ─── SERVICES ─────────────────────────────────────────
        services.AddScoped<IAuthService, AuthService>();
        services.AddScoped<ISolicitacaoService, SolicitacaoService>();
        services.AddScoped<IMotoristaService, MotoristaService>();
        services.AddScoped<IVeiculoService, VeiculoService>();
        services.AddScoped<IJwtService, JwtService>();
        services.AddScoped<IReboqueHubService, ReboqueHubService>();

        // ─── SIGNALR ──────────────────────────────────────────
        services.AddSignalR();

        // ─── JWT ──────────────────────────────────────────────
        var secret = config["Jwt:Secret"]
            ?? throw new InvalidOperationException("JWT Secret não configurado.");

        services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
            .AddJwtBearer(opt =>
            {
                opt.TokenValidationParameters = new TokenValidationParameters
                {
                    ValidateIssuer = true,
                    ValidIssuer = config["Jwt:Issuer"] ?? "ReboqueApp",
                    ValidateAudience = false,
                    ValidateLifetime = true,
                    ValidateIssuerSigningKey = true,
                    IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(secret))
                };

                // Suporte JWT no SignalR (query string)
                opt.Events = new JwtBearerEvents
                {
                    OnMessageReceived = ctx =>
                    {
                        var token = ctx.Request.Query["access_token"];
                        var path = ctx.HttpContext.Request.Path;
                        if (!string.IsNullOrEmpty(token) && path.StartsWithSegments("/hubs"))
                            ctx.Token = token;
                        return Task.CompletedTask;
                    }
                };
            });

        services.AddAuthorization();

        // ─── VALIDATORS ───────────────────────────────────────
        services.AddValidatorsFromAssemblyContaining<CadastroClienteValidator>();

        return services;
    }
}
