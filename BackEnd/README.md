# ReboqueApp — Backend .NET 8 (Clean Architecture)

## Estrutura

```
ReboqueApp/
├── src/
│   ├── ReboqueApp.Domain/          # Entidades, Enums, Interfaces de repositório
│   ├── ReboqueApp.Application/     # Services, DTOs, Validators, Interfaces de serviço
│   ├── ReboqueApp.Infrastructure/  # Repositórios Dapper, SignalR Hub, JWT, Supabase
│   └── ReboqueApp.API/             # Controllers, Program.cs, Middlewares
└── migrations/
    └── 001_add_extra_columns.sql   # Execute no Supabase antes de rodar
```

## Pré-requisitos

- .NET 8 SDK
- Projeto no [Supabase](https://supabase.com) com o schema do banco criado

## Configuração

### 1. Connection String (Supabase)

No Supabase: **Settings → Database → Connection string → URI**

Em `src/ReboqueApp.API/appsettings.json`:

```json
{
  "ConnectionStrings": {
    "Supabase": "Host=db.SEUPROJECTID.supabase.co;Port=5432;Database=postgres;Username=postgres;Password=SUASENHA;SSL Mode=Require;Trust Server Certificate=true"
  },
  "Jwt": {
    "Secret": "chave_secreta_com_pelo_menos_64_caracteres_aqui_XXXXXXXXXXXXXXXXXX",
    "Issuer": "ReboqueApp",
    "ExpiresHours": "24"
  }
}
```

### 2. Migration

Execute no **Supabase → SQL Editor**:

```sql
-- arquivo: migrations/001_add_extra_columns.sql
```

### 3. Rodar

```bash
cd src/ReboqueApp.API
dotnet run
```

A API sobe em `http://localhost:5000`.

## Endpoints por tela do frontend

### auth.html (Login / Cadastro)
| Método | Rota | Descrição |
|--------|------|-----------|
| POST | `/api/clientes` | Cadastro de cliente |
| POST | `/api/clientes/login` | Login (retorna JWT) |
| POST | `/api/motoristas/cadastro` | Cadastro de motorista |

### cliente.html (App do Cliente)
| Método | Rota | Descrição |
|--------|------|-----------|
| POST | `/api/solicitacoes` | Criar nova solicitação |
| GET | `/api/solicitacoes/minha` | Minhas solicitações |
| POST | `/api/solicitacoes/{id}/cancelar` | Cancelar |
| POST | `/api/solicitacoes/{id}/avaliar` | Avaliar atendimento |

### central.html (Painel da Central)
| Método | Rota | Descrição |
|--------|------|-----------|
| GET | `/api/solicitacoes` | Todas as solicitações |
| GET | `/api/solicitacoes/ativas` | Apenas aguardando/acionado |
| POST | `/api/solicitacoes/{id}/acionar` | Acionar reboque + ETA |
| POST | `/api/solicitacoes/{id}/chegou` | Registrar chegada |
| GET | `/api/financeiro` | Resumo financeiro |

### motorista.html (App do Motorista)
| Método | Rota | Descrição |
|--------|------|-----------|
| GET | `/api/motoristas/meu` | Perfil do motorista |
| PATCH | `/api/motoristas/{id}/disponibilidade` | Toggle online/offline |
| POST | `/api/solicitacoes/{id}/localizacao` | Enviar GPS + ETA |

## SignalR — Hub `/hubs/reboque`

### Eventos do servidor → cliente
| Evento | Quem recebe | Payload |
|--------|-------------|---------|
| `NovaSolicitacao` | Central | `SolicitacaoResponse` |
| `SolicitacaoCancelada` | Central + Cliente | `solicitacaoId` |
| `SolicitacaoAvaliada` | Central + Cliente | `{ id, nota, comentario }` |
| `AtualizarLocalizacao` | Central + Cliente | `{ solicitacaoId, lat, lng, etaMinutos }` |
| `ReboqueAcionado` | Cliente | `{ solicitacaoId, etaMinutos }` |
| `ReboqueChegou` | Cliente | — |

### Métodos do cliente → servidor
| Método | Uso |
|--------|-----|
| `EntrarGrupoCentral()` | Central ao conectar |
| `EntrarGrupo(solicitacaoId)` | Cliente ao criar solicitação |
| `EntrarGrupoMotoristas()` | Motorista ao ligar |
| `CancelarSolicitacao(id)` | Cliente cancela |
| `MotoristaDisponivel(payload)` | Toggle disponibilidade |

## Swagger

Disponível em `http://localhost:5000/swagger` no ambiente de desenvolvimento.
