// ============================================================
// CONFIG
// ============================================================
const API_BASE = "http://localhost:5000";
window.GOOGLE_MAPS_KEY = "";

// ============================================================
// STATE
// ============================================================
const state = {
  token: localStorage.getItem("token") || null,
  perfil: localStorage.getItem("perfil") || null,
  user: JSON.parse(localStorage.getItem("user") || "null"),
  motoristaId: localStorage.getItem("motoristaId") || null,
  solicitacaoAtual: null,
  atendimentoAtivo: null,
  polling: null,
  clientePolling: null,
};

// ============================================================
// HTTP / API SERVICES
// ============================================================
async function http(path, { method = "GET", body, auth = true } = {}) {
  const headers = { "Content-Type": "application/json" };
  if (auth && state.token) headers["Authorization"] = `Bearer ${state.token}`;
  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  if (!res.ok) {
    const msg = (data && (data.message || data.title)) || `Erro ${res.status}`;
    throw new Error(msg);
  }
  return data;
}

const AuthService = {
  cadastrarCliente: (b) => http("/api/clientes", { method: "POST", body: b, auth: false }),
  loginCliente: (b) => http("/api/clientes/login", { method: "POST", body: b, auth: false }),
  cadastrarMotorista: (b) => http("/api/motoristas/cadastro", { method: "POST", body: b, auth: false }),
};

const MotoristaService = {
  listar: () => http("/api/motoristas"),
  buscar: (id) => http(`/api/motoristas/${id}`),
  meu: () => http("/api/motoristas/meu"),
  disponibilidade: (id, disponivel) => http(`/api/motoristas/${id}/disponibilidade`, { method: "PATCH", body: { disponivel } }),
  atualizarLocalizacao: (id, b) => http(`/api/motoristas/${id}/localizacao`, { method: "POST", body: b }),
};

const SolicitacaoService = {
  listar: () => http("/api/solicitacoes"),
  criar: (b) => http("/api/solicitacoes", { method: "POST", body: b }),
  ativas: () => http("/api/solicitacoes/ativas"),
  minhas: () => http("/api/solicitacoes/minha"),
  buscar: (id) => http(`/api/solicitacoes/${id}`),
  acionar: (id, b) => http(`/api/solicitacoes/${id}/acionar`, { method: "POST", body: b }),
  chegou: (id) => http(`/api/solicitacoes/${id}/chegou`, { method: "POST", body: {} }),
  cancelar: (id) => http(`/api/solicitacoes/${id}/cancelar`, { method: "POST", body: {} }),
  avaliar: (id, b) => http(`/api/solicitacoes/${id}/avaliar`, { method: "POST", body: b }),
  localizacao: (id, b) => http(`/api/solicitacoes/${id}/localizacao`, { method: "POST", body: b }),
};

const VeiculoService = {
  listar: () => http("/api/veiculos"),
  criar: (b) => http("/api/veiculos", { method: "POST", body: b }),
  porPlaca: (placa) => http(`/api/veiculos/${encodeURIComponent(placa)}`),
};

const FinanceiroService = {
  obter: () => http("/api/financeiro"),
};

// ============================================================
// UI HELPERS
// ============================================================
function $(sel) { return document.querySelector(sel); }
function $$(sel) { return [...document.querySelectorAll(sel)]; }

function toast(msg, type = "") {
  const el = $("#toast");
  el.textContent = msg;
  el.className = `toast ${type}`;
  setTimeout(() => el.classList.add("hidden"), 3500);
}

function showView(id) {
  $$(".view").forEach((v) => v.classList.add("hidden"));
  const v = document.getElementById(id);
  if (v) v.classList.remove("hidden");
  $$("#nav button").forEach((b) => b.classList.toggle("active", b.dataset.target === id));
}

function renderNav() {
  const nav = $("#nav");
  nav.innerHTML = "";
  const items = state.perfil === "motorista"
    ? [
        { id: "view-motorista", label: "Solicitacoes" },
        { id: "view-veiculos", label: "Veiculos" },
        { id: "view-financeiro", label: "Financeiro" },
      ]
    : [
        { id: "view-cliente", label: "Solicitar Reboque" },
        { id: "view-veiculos", label: "Meus Veiculos" },
        { id: "view-financeiro", label: "Financeiro" },
      ];
  items.forEach((i) => {
    const b = document.createElement("button");
    b.textContent = i.label;
    b.dataset.target = i.id;
    b.onclick = () => {
      showView(i.id);
      if (i.id === "view-cliente") carregarMinhasSolicitacoes();
      if (i.id === "view-motorista") carregarSolicitacoesAtivas();
      if (i.id === "view-financeiro") carregarFinanceiro();
    };
    nav.appendChild(b);
  });
}

function setAuth({ token, perfil, user, motoristaId }) {
  state.token = token;
  state.perfil = perfil;
  state.user = user || null;
  localStorage.setItem("token", token);
  localStorage.setItem("perfil", perfil);
  if (user) localStorage.setItem("user", JSON.stringify(user));
  if (motoristaId) {
    state.motoristaId = motoristaId;
    localStorage.setItem("motoristaId", motoristaId);
  }
  bootAfterLogin();
}

function logout() {
  localStorage.clear();
  state.token = null;
  state.perfil = null;
  state.user = null;
  state.motoristaId = null;
  state.solicitacaoAtual = null;
  state.atendimentoAtivo = null;
  stopPolling();
  $("#topbar").classList.add("hidden");
  showView("view-login");
}

function bootAfterLogin() {
  $("#topbar").classList.remove("hidden");
  $("#userInfo").textContent = `${state.perfil?.toUpperCase()} - ${state.user?.nome || state.user?.email || ""}`;
  renderNav();
  if (state.perfil === "motorista") {
    showView("view-motorista");
    carregarSolicitacoesAtivas();
    startMotoristaLocationPolling();
  } else {
    showView("view-cliente");
    carregarMinhasSolicitacoes();
  }
}

// ============================================================
// BUTTON STATES
// ============================================================
function setButtonState(btn, state) {
  if (!btn) return;
  btn.classList.remove("loading", "success", "error");
  if (state) btn.classList.add(state);
  btn.disabled = state === "loading";
}

async function withButtonState(btn, asyncFn) {
  setButtonState(btn, "loading");
  try {
    const result = await asyncFn();
    setButtonState(btn, "success");
    setTimeout(() => setButtonState(btn, null), 2000);
    return result;
  } catch (e) {
    setButtonState(btn, "error");
    setTimeout(() => setButtonState(btn, null), 2000);
    throw e;
  }
}

// ============================================================
// MAPS
// ============================================================
let mapsReady = false;
const maps = {
  cliente: { map: null, directions: null, marker: null },
  clienteAtivo: { map: null, directions: null, markerMotorista: null },
  motorista: { map: null, directions: null, markerMotorista: null },
  motoristaAtivo: { map: null, directions: null, markerMinha: null },
};

window.initMaps = function () {
  mapsReady = true;
  const center = { lat: -23.55052, lng: -46.633308 };
  const lightStyle = [];

  // Mapa do cliente (nova solicitacao)
  if (document.getElementById("mapCliente")) {
    maps.cliente.map = new google.maps.Map(document.getElementById("mapCliente"), {
      center, zoom: 12, styles: lightStyle
    });
    maps.cliente.directions = new google.maps.DirectionsRenderer({
      map: maps.cliente.map,
      polylineOptions: { strokeColor: "#0066ff", strokeWeight: 5, strokeOpacity: 0.8 },
      suppressMarkers: false,
    });

    const acOrigem = new google.maps.places.Autocomplete(document.getElementById("inputOrigem"), {
      componentRestrictions: { country: "br" }, fields: ["formatted_address", "geometry"]
    });
    const acDestino = new google.maps.places.Autocomplete(document.getElementById("inputDestino"), {
      componentRestrictions: { country: "br" }, fields: ["formatted_address", "geometry"]
    });

    let origemOk = false, destinoOk = false;
    acOrigem.addListener("place_changed", () => {
      origemOk = true;
      document.getElementById("inputOrigem").value = acOrigem.getPlace().formatted_address || document.getElementById("inputOrigem").value;
      if (destinoOk) tracarRotaCliente();
    });
    acDestino.addListener("place_changed", () => {
      destinoOk = true;
      document.getElementById("inputDestino").value = acDestino.getPlace().formatted_address || document.getElementById("inputDestino").value;
      if (origemOk) tracarRotaCliente();
    });
  }

  // Mapa do cliente (solicitacao ativa)
  if (document.getElementById("mapClienteAtivo")) {
    maps.clienteAtivo.map = new google.maps.Map(document.getElementById("mapClienteAtivo"), {
      center, zoom: 12, styles: lightStyle
    });
    maps.clienteAtivo.directions = new google.maps.DirectionsRenderer({
      map: maps.clienteAtivo.map,
      polylineOptions: { strokeColor: "#0066ff", strokeWeight: 5, strokeOpacity: 0.8 },
    });
  }

  // Mapa do motorista (fila)
  if (document.getElementById("mapMotorista")) {
    maps.motorista.map = new google.maps.Map(document.getElementById("mapMotorista"), {
      center, zoom: 12, styles: lightStyle
    });
    maps.motorista.directions = new google.maps.DirectionsRenderer({
      map: maps.motorista.map,
      polylineOptions: { strokeColor: "#0066ff", strokeWeight: 5, strokeOpacity: 0.8 },
    });
  }

  // Mapa do motorista (atendimento ativo)
  if (document.getElementById("mapMotoristaAtivo")) {
    maps.motoristaAtivo.map = new google.maps.Map(document.getElementById("mapMotoristaAtivo"), {
      center, zoom: 12, styles: lightStyle
    });
    maps.motoristaAtivo.directions = new google.maps.DirectionsRenderer({
      map: maps.motoristaAtivo.map,
      polylineOptions: { strokeColor: "#10b981", strokeWeight: 5, strokeOpacity: 0.9 },
    });
  }
};

async function tracarRotaCliente() {
  if (!mapsReady) return toast("Mapa ainda nao carregou", "error");
  const origem = $("#inputOrigem").value.trim();
  const destino = $("#inputDestino").value.trim();
  if (!origem || !destino) return toast("Informe origem e destino", "error");

  const btn = $("#btnTracar");
  setButtonState(btn, "loading");

  const ds = new google.maps.DirectionsService();
  try {
    const result = await ds.route({
      origin: origem,
      destination: destino,
      travelMode: google.maps.TravelMode.DRIVING,
    });
    maps.cliente.directions.setDirections(result);
    const leg = result.routes[0].legs[0];
    const distKm = leg.distance.value / 1000;
    const valor = (distKm * 5 + 50).toFixed(2);
    $("#rotaInfo").textContent = `Distancia: ${distKm.toFixed(2)} km | Tempo: ${leg.duration.text} | Valor estimado: R$ ${valor}`;
    $("#formSolicitacao").dataset.lat = leg.start_location.lat();
    $("#formSolicitacao").dataset.lng = leg.start_location.lng();
    $("#formSolicitacao").dataset.dist = distKm.toFixed(2);
    $("#formSolicitacao").dataset.valor = valor;
    setButtonState(btn, "success");
    setTimeout(() => setButtonState(btn, null), 2000);
  } catch (e) {
    toast("Nao foi possivel tracar a rota: " + e.message, "error");
    setButtonState(btn, "error");
    setTimeout(() => setButtonState(btn, null), 2000);
  }
}

// ============================================================
// AUTH HANDLERS
// ============================================================
$("#formLogin").addEventListener("submit", async (e) => {
  e.preventDefault();
  const btn = e.target.querySelector('button[type="submit"]');
  const f = new FormData(e.target);
  const perfil = f.get("perfil");
  
  setButtonState(btn, "loading");
  try {
    const r = await AuthService.loginCliente({ email: f.get("email"), senha: f.get("senha") });
    const token = r.token || r.accessToken || r.jwt || r;
    setAuth({ token, perfil, user: r.user || r.cliente || r.motorista || null, motoristaId: r.motoristaId || r.id });
    toast("Login efetuado", "success");
    setButtonState(btn, "success");
  } catch (err) {
    toast(err.message, "error");
    setButtonState(btn, "error");
    setTimeout(() => setButtonState(btn, null), 2000);
  }
});

$("#formCadastroCliente").addEventListener("submit", async (e) => {
  e.preventDefault();
  const btn = e.target.querySelector('button[type="submit"]');
  const f = new FormData(e.target);
  
  await withButtonState(btn, async () => {
    await AuthService.cadastrarCliente(Object.fromEntries(f));
    toast("Cadastro realizado! Faca login.", "success");
    showView("view-login");
  }).catch(err => toast(err.message, "error"));
});

$("#formCadastroMotorista").addEventListener("submit", async (e) => {
  e.preventDefault();
  const btn = e.target.querySelector('button[type="submit"]');
  const f = new FormData(e.target);
  
  await withButtonState(btn, async () => {
    await AuthService.cadastrarMotorista(Object.fromEntries(f));
    toast("Motorista cadastrado! Faca login.", "success");
    showView("view-login");
  }).catch(err => toast(err.message, "error"));
});

$("#btnLogout").onclick = logout;
$$("[data-go]").forEach((a) => a.onclick = (e) => { e.preventDefault(); showView(a.dataset.go); });

// ============================================================
// CLIENTE: SOLICITACAO
// ============================================================
$("#btnTracar").onclick = tracarRotaCliente;

$("#formSolicitacao").addEventListener("submit", async (e) => {
  e.preventDefault();
  const btn = $("#btnSolicitar");
  const f = new FormData(e.target);
  const ds = e.target.dataset;
  const body = {
    origem: f.get("origem"),
    destino: f.get("destino"),
    placa: f.get("placa"),
    modelo: f.get("modelo"),
    tipoVeiculo: f.get("tipoVeiculo"),
    urgencia: f.get("urgencia"),
    latOrigem: ds.lat ? parseFloat(ds.lat) : null,
    lngOrigem: ds.lng ? parseFloat(ds.lng) : null,
    distanciaKm: ds.dist ? parseFloat(ds.dist) : 0,
    valorTotal: ds.valor ? parseFloat(ds.valor) : 0,
  };
  
  await withButtonState(btn, async () => {
    await SolicitacaoService.criar(body);
    toast("Solicitacao criada!", "success");
    e.target.reset();
    $("#rotaInfo").textContent = "";
    carregarMinhasSolicitacoes();
  }).catch(err => toast(err.message, "error"));
});

async function carregarMinhasSolicitacoes() {
  const cont = $("#listaMinhasSolicitacoes");
  const containerAtivo = $("#solicitacaoAtivaContainer");
  cont.innerHTML = '<div class="muted">Carregando...</div>';
  
  try {
    const lista = await SolicitacaoService.minhas();
    cont.innerHTML = "";
    
    if (!Array.isArray(lista) || lista.length === 0) {
      cont.innerHTML = '<p class="muted">Nenhuma solicitacao ainda.</p>';
      containerAtivo.classList.add("hidden");
      return;
    }
    
    // Separar solicitacao ativa do historico
    const ativa = lista.find(s => ["pendente", "acionada", "em_rota"].includes(s.status));
    const historico = lista.filter(s => !["pendente", "acionada", "em_rota"].includes(s.status));
    
    // Mostrar solicitacao ativa
    if (ativa) {
      containerAtivo.classList.remove("hidden");
      state.solicitacaoAtual = ativa;
      atualizarSolicitacaoAtiva(ativa);
      startClienteMotoristaTracking(ativa.id, ativa);
    } else {
      containerAtivo.classList.add("hidden");
      stopClientePolling();
    }
    
    // Mostrar historico
    if (historico.length === 0) {
      cont.innerHTML = '<p class="muted">Nenhuma solicitacao no historico.</p>';
    } else {
      historico.forEach((s) => cont.appendChild(itemSolicitacaoHistorico(s)));
    }
  } catch (e) {
    cont.innerHTML = `<p class="muted">Erro: ${e.message}</p>`;
  }
}

function atualizarSolicitacaoAtiva(s) {
  const info = $("#solicitacaoAtivaInfo");
  if (info) {
    info.innerHTML = `
      <strong>#${s.id}</strong> | ${s.origem} - ${s.destino}<br>
      <span style="color: var(--text-4)">Placa: ${s.placa} | Modelo: ${s.modelo}</span>
    `;
  }
  
  // Atualizar stepper
  const statusMap = { pendente: 1, acionada: 2, em_rota: 3, concluida: 4 };
  const step = statusMap[s.status] || 1;
  
  for (let i = 1; i <= 4; i++) {
    const stepEl = $(`#tStep${i}`);
    if (stepEl) {
      const dot = stepEl.querySelector(".tracking-step-dot");
      dot.classList.toggle("active", i <= step);
      dot.classList.toggle("current", i === step);
    }
  }
  
  // Tracar rota no mapa ativo
  if (mapsReady && maps.clienteAtivo.map && s.origem && s.destino) {
    const ds = new google.maps.DirectionsService();
    ds.route({
      origin: s.origem,
      destination: s.destino,
      travelMode: google.maps.TravelMode.DRIVING
    }, (r, st) => {
      if (st === "OK") maps.clienteAtivo.directions.setDirections(r);
    });
  }
}

function atualizarTrackingPanel(sol, etaMin, distKm) {
  const etaEl = $("#trackingEta");
  const distEl = $("#trackingDist");
  const chegEl = $("#trackingChegada");
  const nameEl = $("#trackingDriverName");
  const plateEl = $("#trackingDriverPlate");
  const ratingEl = $("#trackingDriverRating");

  if (etaEl) etaEl.textContent = etaMin != null ? `~${Math.round(etaMin)}` : "--";
  if (distEl) distEl.textContent = distKm != null ? parseFloat(distKm).toFixed(1) : "--";
  if (nameEl) nameEl.textContent = sol.motoristaNome ?? sol.motorista?.nome ?? "Aguardando motorista...";
  if (plateEl) plateEl.textContent = sol.placaMotorista ?? sol.motorista?.placa ?? "--";
  if (ratingEl) ratingEl.textContent = sol.motoristaRating ?? sol.motorista?.rating ?? "--";

  if (chegEl && etaMin != null) {
    const hora = new Date(Date.now() + etaMin * 60000);
    chegEl.textContent = hora.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  }
}

$("#btnRecarregarMinhas").onclick = async function() {
  await withButtonState(this, carregarMinhasSolicitacoes);
};

$("#btnCancelarAtiva").onclick = async function() {
  if (!state.solicitacaoAtual) return;
  if (!confirm("Cancelar essa solicitacao?")) return;
  
  await withButtonState(this, async () => {
    await SolicitacaoService.cancelar(state.solicitacaoAtual.id);
    toast("Solicitacao cancelada", "success");
    state.solicitacaoAtual = null;
    carregarMinhasSolicitacoes();
  }).catch(err => toast(err.message, "error"));
};

function itemSolicitacaoHistorico(s) {
  const div = document.createElement("div");
  div.className = "item";
  const status = s.status || "pendente";
  div.innerHTML = `
    <h3>#${s.id || "?"} ${s.origem || ""} - ${s.destino || ""}
      <span class="badge ${status === "concluida" ? "ok" : ""}">${status}</span>
    </h3>
    <div class="meta">${s.modelo || ""} | ${s.placa || ""} | ${s.distanciaKm ?? "-"} km | R$ ${s.valorTotal ?? "-"}</div>
    <div class="actions"></div>
  `;
  
  const actions = div.querySelector(".actions");
  if (status === "concluida" && !s.avaliacao) {
    const bAvaliar = btn("Avaliar", "secondary small", async () => {
      const nota = parseInt(prompt("Nota (1-5)?", "5") || "5", 10);
      const comentario = prompt("Comentario?", "") || "";
      try {
        await SolicitacaoService.avaliar(s.id, { nota, comentario });
        toast("Avaliacao enviada", "success");
        carregarMinhasSolicitacoes();
      } catch (err) { toast(err.message, "error"); }
    });
    actions.append(bAvaliar);
  }
  
  return div;
}

// ============================================================
// CLIENTE: TRACKING
// ============================================================
async function _fetchMotoristaPos(sol) {
  const lat1 = sol.latMotorista ?? sol.lat_motorista ?? sol.motorista?.lat;
  const lng1 = sol.lngMotorista ?? sol.lng_motorista ?? sol.motorista?.lng;
  if (lat1 && lng1) return { lat: parseFloat(lat1), lng: parseFloat(lng1) };

  const motId = sol.motoristaId ?? sol.motorista_id ?? sol.motorista?.id;
  if (motId) {
    try {
      const mot = await MotoristaService.buscar(motId);
      const lat2 = mot.lat ?? mot.latitude ?? mot.localizacao?.lat;
      const lng2 = mot.lng ?? mot.longitude ?? mot.localizacao?.lng;
      if (lat2 && lng2) return { lat: parseFloat(lat2), lng: parseFloat(lng2) };
    } catch (e) { /* ignora */ }
  }
  return null;
}

function _colocarMarkerMotorista(p) {
  if (!mapsReady || !maps.clienteAtivo.map) return;
  if (!maps.clienteAtivo.markerMotorista) {
    maps.clienteAtivo.markerMotorista = new google.maps.Marker({
      position: p,
      map: maps.clienteAtivo.map,
      icon: {
        path: google.maps.SymbolPath.CIRCLE,
        scale: 12,
        fillColor: "#0066ff",
        fillOpacity: 1,
        strokeColor: "#fff",
        strokeWeight: 3,
      },
      title: "Motorista",
      zIndex: 20,
    });
  } else {
    maps.clienteAtivo.markerMotorista.setPosition(p);
  }
}

function startClienteMotoristaTracking(solId, solData) {
  stopClientePolling();

  if (solData) atualizarTrackingPanel(solData, solData.etaMinutos, solData.distanciaKm);

  const tick = async () => {
    try {
      const sol = await SolicitacaoService.buscar(solId);
      if (!sol) return;

      atualizarSolicitacaoAtiva(sol);
      
      const pos = await _fetchMotoristaPos(sol);

      if (pos && sol.origem && mapsReady && maps.clienteAtivo.map) {
        const ds = new google.maps.DirectionsService();
        ds.route({
          origin: { lat: pos.lat, lng: pos.lng },
          destination: sol.origem,
          travelMode: google.maps.TravelMode.DRIVING,
        }, (result, status) => {
          if (status === "OK") {
            const leg = result.routes[0].legs[0];
            const etaMin = leg.duration.value / 60;
            const distKm = leg.distance.value / 1000;
            atualizarTrackingPanel(sol, etaMin, distKm);
          } else {
            atualizarTrackingPanel(sol, sol.etaMinutos, sol.distanciaKm);
          }
        });
        _colocarMarkerMotorista(pos);
        maps.clienteAtivo.map.panTo(pos);
      } else {
        atualizarTrackingPanel(sol, sol.etaMinutos, sol.distanciaKm);
      }
    } catch (e) { /* silencia */ }
  };

  tick();
  state.clientePolling = setInterval(tick, 8000);
}

function stopClientePolling() {
  if (state.clientePolling) {
    clearInterval(state.clientePolling);
    state.clientePolling = null;
  }
}

// ============================================================
// MOTORISTA
// ============================================================
async function carregarSolicitacoesAtivas() {
  const cont = $("#listaAtivas");
  const containerAtivo = $("#atendimentoAtivoContainer");
  cont.innerHTML = '<div class="muted">Carregando...</div>';

  try {
    const lista = await SolicitacaoService.ativas();
    cont.innerHTML = "";

    if (!Array.isArray(lista) || lista.length === 0) {
      cont.innerHTML = '<p class="muted">Nenhuma solicitacao ativa.</p>';
    } else {
      // Verificar se motorista tem atendimento ativo
      const meuAtendimento = lista.find(s => 
        (s.status === "acionada" || s.status === "em_rota") && 
        (s.motoristaId === state.motoristaId || s.motorista_id === state.motoristaId)
      );
      
      if (meuAtendimento) {
        containerAtivo.classList.remove("hidden");
        state.atendimentoAtivo = meuAtendimento;
        atualizarAtendimentoAtivo(meuAtendimento);
        // Ocultar outras solicitacoes quando em atendimento
        cont.innerHTML = '<p class="muted">Finalize o atendimento atual para ver novas solicitacoes.</p>';
      } else {
        containerAtivo.classList.add("hidden");
        state.atendimentoAtivo = null;
        lista.forEach((s) => cont.appendChild(itemSolicitacao(s, "motorista")));
      }
    }
  } catch (e) {
    cont.innerHTML = `<p class="muted">Erro: ${e.message}</p>`;
  }
}

function atualizarAtendimentoAtivo(s) {
  const detalhes = $("#atendimentoDetalhes");
  if (detalhes) {
    detalhes.innerHTML = `
      <strong>#${s.id}</strong><br>
      <strong>Origem:</strong> ${s.origem}<br>
      <strong>Destino:</strong> ${s.destino}<br>
      <strong>Veiculo:</strong> ${s.modelo} - ${s.placa}<br>
      <strong>Urgencia:</strong> ${s.urgencia}
    `;
  }
  
  // Tracar rota
  if (mapsReady && maps.motoristaAtivo.map && navigator.geolocation) {
    navigator.geolocation.getCurrentPosition((pos) => {
      const myPos = { lat: pos.coords.latitude, lng: pos.coords.longitude };
      const ds = new google.maps.DirectionsService();
      
      ds.route({
        origin: myPos,
        destination: s.origem,
        travelMode: google.maps.TravelMode.DRIVING,
      }, (result, status) => {
        if (status === "OK") {
          maps.motoristaAtivo.directions.setDirections(result);
          const leg = result.routes[0].legs[0];
          const etaMin = Math.round(leg.duration.value / 60);
          const distKm = (leg.distance.value / 1000).toFixed(1);
          
          $("#motoristaEta").textContent = `~${etaMin}`;
          $("#motoristaDist").textContent = distKm;
        }
      });
      
      // Marker da posicao
      if (!maps.motoristaAtivo.markerMinha) {
        maps.motoristaAtivo.markerMinha = new google.maps.Marker({
          position: myPos,
          map: maps.motoristaAtivo.map,
          icon: {
            path: google.maps.SymbolPath.CIRCLE,
            scale: 10,
            fillColor: "#10b981",
            fillOpacity: 1,
            strokeColor: "#fff",
            strokeWeight: 2,
          },
          title: "Voce",
        });
      } else {
        maps.motoristaAtivo.markerMinha.setPosition(myPos);
      }
    });
  }
}

$("#btnRecarregarAtivas").onclick = async function() {
  await withButtonState(this, carregarSolicitacoesAtivas);
};

$("#btnCheguei").onclick = async function() {
  if (!state.atendimentoAtivo) return;
  
  await withButtonState(this, async () => {
    await SolicitacaoService.chegou(state.atendimentoAtivo.id);
    toast("Chegada registrada!", "success");
    state.atendimentoAtivo = null;
    $("#atendimentoAtivoContainer").classList.add("hidden");
    carregarSolicitacoesAtivas();
  }).catch(err => toast(err.message, "error"));
};

function itemSolicitacao(s, ctx) {
  const div = document.createElement("div");
  div.className = "item";
  const status = s.status || "pendente";
  const urg = (s.urgencia || "").toLowerCase();
  div.innerHTML = `
    <h3>#${s.id || "?"} ${s.origem || ""} - ${s.destino || ""}
      <span class="badge ${urg === "alta" ? "urgente" : ""}">${s.urgencia || "-"}</span>
      <span class="badge ${status === "concluida" ? "ok" : ""}">${status}</span>
    </h3>
    <div class="meta">${s.modelo || ""} | ${s.placa || ""} | ${s.distanciaKm ?? "-"} km | R$ ${s.valorTotal ?? "-"}</div>
    <div class="actions"></div>
  `;
  const actions = div.querySelector(".actions");

  if (ctx === "motorista") {
    const bAceitar = btn("Aceitar Corrida", "primary small", async function() {
      const eta = parseInt(prompt("ETA em minutos ate o cliente?", "12") || "12", 10);
      await withButtonState(this, async () => {
        await SolicitacaoService.acionar(s.id, { etaMinutos: eta, motoristaId: state.motoristaId });
        state.atendimentoAtivo = s;
        toast("Atendimento iniciado - rastreamento ativo", "success");
        carregarSolicitacoesAtivas();
      }).catch(err => toast(err.message, "error"));
    });
    
    const bVer = btn("Ver Rota", "secondary small", () => {
      if (!mapsReady) return;
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition((pos) => {
          const ds = new google.maps.DirectionsService();
          ds.route({
            origin: { lat: pos.coords.latitude, lng: pos.coords.longitude },
            destination: s.origem,
            travelMode: google.maps.TravelMode.DRIVING,
          }, (result, status) => {
            if (status === "OK") {
              maps.motorista.directions.setDirections(result);
            }
          });
        });
      }
    });
    
    actions.append(bAceitar, bVer);
  }
  
  return div;
}

function btn(label, variant, onclick) {
  const b = document.createElement("button");
  b.innerHTML = `<span class="btn-text">${label}</span><span class="btn-loading">...</span>`;
  b.className = `btn ${variant}`;
  b.onclick = onclick;
  return b;
}

// ============================================================
// MOTORISTA: LOCATION POLLING
// ============================================================
function startMotoristaLocationPolling() {
  stopPolling();
  if (state.perfil !== "motorista") return;
  if (!navigator.geolocation) return;

  const sendLocation = () => {
    navigator.geolocation.getCurrentPosition(async (pos) => {
      const body = { lat: pos.coords.latitude, lng: pos.coords.longitude, etaMinutos: 0 };

      try {
        if (state.motoristaId) await MotoristaService.atualizarLocalizacao(state.motoristaId, body);
        if (state.atendimentoAtivo?.id) {
          await SolicitacaoService.localizacao(state.atendimentoAtivo.id, body);
        }

        // Atualizar mapa do motorista
        if (mapsReady && maps.motorista.map) {
          const p = { lat: body.lat, lng: body.lng };
          if (!maps.motorista.markerMotorista) {
            maps.motorista.markerMotorista = new google.maps.Marker({
              position: p,
              map: maps.motorista.map,
              icon: {
                path: google.maps.SymbolPath.CIRCLE,
                scale: 10,
                fillColor: "#10b981",
                fillOpacity: 1,
                strokeColor: "#fff",
                strokeWeight: 2,
              },
              title: "Sua posicao",
            });
          } else {
            maps.motorista.markerMotorista.setPosition(p);
          }
        }
        
        // Atualizar mapa do atendimento ativo
        if (state.atendimentoAtivo) {
          atualizarAtendimentoAtivo(state.atendimentoAtivo);
        }
      } catch (e) { console.warn(e); }
    }, (err) => console.warn("GPS:", err), { enableHighAccuracy: true, timeout: 7000 });
  };

  sendLocation();
  state.polling = setInterval(() => {
    sendLocation();
    carregarSolicitacoesAtivas();
  }, 8000);
}

function stopPolling() {
  if (state.polling) {
    clearInterval(state.polling);
    state.polling = null;
  }
  stopClientePolling();
}

// ============================================================
// VEICULOS
// ============================================================
$("#formVeiculo").addEventListener("submit", async (e) => {
  e.preventDefault();
  const btn = e.target.querySelector('button[type="submit"]');
  const f = new FormData(e.target);
  
  await withButtonState(btn, async () => {
    await VeiculoService.criar(Object.fromEntries(f));
    toast("Veiculo cadastrado", "success");
    e.target.reset();
  }).catch(err => toast(err.message, "error"));
});

$("#formBuscaVeiculo").addEventListener("submit", async (e) => {
  e.preventDefault();
  const btn = e.target.querySelector('button[type="submit"]');
  const placa = new FormData(e.target).get("placa");
  
  await withButtonState(btn, async () => {
    const v = await VeiculoService.porPlaca(placa);
    $("#resultadoVeiculo").textContent = JSON.stringify(v, null, 2);
  }).catch(err => {
    $("#resultadoVeiculo").textContent = err.message;
  });
});

// ============================================================
// FINANCEIRO
// ============================================================
function finSetState(st) {
  const btn = $("#btnRecarregarFinanceiro");
  const elLoad = $("#finStateLoading");
  const elErr = $("#finStateError");

  if (elLoad) elLoad.style.display = st === "loading" ? "flex" : "none";
  if (elErr) elErr.style.display = st === "error" ? "flex" : "none";

  setButtonState(btn, st === "loading" ? "loading" : st === "success" ? "success" : st === "error" ? "error" : null);
}

function finRenderKpis(d) {
  const total = d.totalRecebido ?? d.totalReceita ?? d.valorTotal ?? d.total ?? null;
  const servicos = d.totalServicos ?? d.servicosRealizados ?? d.concluidos ?? null;
  const ticket = (total != null && servicos) ? (total / servicos) : (d.ticketMedio ?? null);
  const cancela = d.cancelamentos ?? d.totalCancelamentos ?? null;

  const fmt = (v) => v != null ? `R$ ${parseFloat(v).toFixed(2).replace(".", ",")}` : "--";
  const num = (v) => v != null ? parseInt(v) : "--";

  $("#finValorTotal").textContent = fmt(total);
  $("#finTotalServicos").textContent = num(servicos);
  $("#finTicketMedio").textContent = fmt(ticket);
  $("#finCancelamentos").textContent = num(cancela);

  const strip = $("#finKpiStrip");
  if (strip) strip.style.display = "grid";
}

function finRenderTabela(d) {
  const tbody = $("#finTabelaBody");
  const card = $("#finTabelaCard");
  const vazia = $("#finTabelaVazia");
  if (!tbody || !card) return;

  const lista = d.solicitacoes ?? d.transacoes ?? d.servicos ?? (Array.isArray(d) ? d : null);

  if (!lista || lista.length === 0) {
    card.style.display = "block";
    tbody.innerHTML = "";
    if (vazia) vazia.style.display = "block";
    return;
  }

  card.style.display = "block";
  if (vazia) vazia.style.display = "none";
  
  const statusLabel = { concluida: "Concluida", cancelada: "Cancelada", acionada: "Em atendimento", pendente: "Pendente" };
  const statusClass = { concluida: "fin-badge--green", cancelada: "fin-badge--red", acionada: "fin-badge--blue", pendente: "fin-badge--amber" };

  tbody.innerHTML = lista.map((s, i) => {
    const st = (s.status || "pendente").toLowerCase();
    const data = s.criadoEm ?? s.createdAt ?? s.data ?? "--";
    const dataFmt = data !== "--" ? new Date(data).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "2-digit" }) : "--";
    const dist = s.distanciaKm != null ? `${parseFloat(s.distanciaKm).toFixed(1)} km` : "--";
    const val = s.valorTotal != null ? `R$ ${parseFloat(s.valorTotal).toFixed(2).replace(".", ",")}` : "--";
    return `<tr>
      <td class="fin-td-id">#${s.id ?? i + 1}</td>
      <td class="fin-td-rota">${s.origem ?? "--"} - ${s.destino ?? "--"}</td>
      <td>${dataFmt}</td>
      <td>${dist}</td>
      <td><span class="fin-badge ${statusClass[st] ?? ""}">${statusLabel[st] ?? st}</span></td>
      <td class="fin-td-val">${val}</td>
    </tr>`;
  }).join("");
}

async function carregarFinanceiro() {
  finSetState("loading");
  const strip = $("#finKpiStrip");
  const tCard = $("#finTabelaCard");
  if (strip) strip.style.display = "none";
  if (tCard) tCard.style.display = "none";

  try {
    const d = await FinanceiroService.obter();
    finSetState("success");

    const now = new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
    const upd = $("#finLastUpdate");
    if (upd) upd.textContent = `Ultima atualizacao: ${now}`;

    finRenderKpis(d);
    finRenderTabela(d);
  } catch (e) {
    finSetState("error");
    const errMsg = $("#finErrorMsg");
    if (errMsg) errMsg.textContent = `Erro: ${e.message}`;
  }
}

$("#btnRecarregarFinanceiro").onclick = carregarFinanceiro;

// ============================================================
// BOOT
// ============================================================
if (state.token && state.perfil) bootAfterLogin();
else showView("view-login");
