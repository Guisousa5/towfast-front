// ============================================================
// CONFIG
// ============================================================
const API_BASE = "http://localhost:5000"; // ajuste se necessário
window.GOOGLE_MAPS_KEY = ""; // <-- coloque sua chave

// ============================================================
// STATE
// ============================================================
const state = {
  token: localStorage.getItem("token") || null,
  perfil: localStorage.getItem("perfil") || null, // "cliente" | "motorista"
  user: JSON.parse(localStorage.getItem("user") || "null"),
  motoristaId: localStorage.getItem("motoristaId") || null,
  solicitacaoAtual: null,
  polling: null,
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
  loginCliente:    (b) => http("/api/clientes/login", { method: "POST", body: b, auth: false }),
  cadastrarMotorista: (b) => http("/api/motoristas/cadastro", { method: "POST", body: b, auth: false }),
};

const MotoristaService = {
  listar:        ()   => http("/api/motoristas"),
  buscar:        (id) => http(`/api/motoristas/${id}`),
  meu:           ()   => http("/api/motoristas/meu"),
  disponibilidade: (id, disponivel) => http(`/api/motoristas/${id}/disponibilidade`, { method: "PATCH", body: { disponivel } }),
  atualizarLocalizacao: (id, b) => http(`/api/motoristas/${id}/localizacao`, { method: "POST", body: b }),
};

const SolicitacaoService = {
  listar:    ()   => http("/api/solicitacoes"),
  criar:     (b)  => http("/api/solicitacoes", { method: "POST", body: b }),
  ativas:    ()   => http("/api/solicitacoes/ativas"),
  minhas:    ()   => http("/api/solicitacoes/minha"),
  buscar:    (id) => http(`/api/solicitacoes/${id}`),
  acionar:   (id, b) => http(`/api/solicitacoes/${id}/acionar`, { method: "POST", body: b }),
  chegou:    (id) => http(`/api/solicitacoes/${id}/chegou`, { method: "POST", body: {} }),
  cancelar:  (id) => http(`/api/solicitacoes/${id}/cancelar`, { method: "POST", body: {} }),
  avaliar:   (id, b) => http(`/api/solicitacoes/${id}/avaliar`, { method: "POST", body: b }),
  localizacao: (id, b) => http(`/api/solicitacoes/${id}/localizacao`, { method: "POST", body: b }),
};

const VeiculoService = {
  listar:  ()       => http("/api/veiculos"),
  criar:   (b)      => http("/api/veiculos", { method: "POST", body: b }),
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
        { id: "view-motorista", label: "Solicitações Ativas" },
        { id: "view-veiculos", label: "Veículos" },
        { id: "view-financeiro", label: "Financeiro" },
      ]
    : [
        { id: "view-cliente", label: "Solicitar Reboque" },
        { id: "view-veiculos", label: "Meus Veículos" },
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
  state.token = token; state.perfil = perfil; state.user = user || null;
  localStorage.setItem("token", token);
  localStorage.setItem("perfil", perfil);
  if (user) localStorage.setItem("user", JSON.stringify(user));
  if (motoristaId) { state.motoristaId = motoristaId; localStorage.setItem("motoristaId", motoristaId); }
  bootAfterLogin();
}

function logout() {
  localStorage.clear();
  state.token = null; state.perfil = null; state.user = null; state.motoristaId = null;
  stopPolling();
  $("#topbar").classList.add("hidden");
  showView("view-login");
}

function bootAfterLogin() {
  $("#topbar").classList.remove("hidden");
  $("#userInfo").textContent = `${state.perfil?.toUpperCase()} ${state.user?.nome || state.user?.email || ""}`;
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
// MAPS
// ============================================================
let mapsReady = false;
const maps = {
  cliente: { map: null, directions: null, marker: null },
  motorista: { map: null, directions: null, markerMotorista: null, markerOrigem: null },
};

window.initMaps = function () {
  mapsReady = true;
  const center = { lat: -23.55052, lng: -46.633308 }; // São Paulo

  if (document.getElementById("mapCliente")) {
    maps.cliente.map = new google.maps.Map(document.getElementById("mapCliente"), {
      center, zoom: 12,
      styles: [
        { elementType: "geometry", stylers: [{ color: "#1a1a1a" }] },
        { elementType: "labels.text.stroke", stylers: [{ color: "#0a0a0a" }] },
        { elementType: "labels.text.fill", stylers: [{ color: "#888880" }] },
        { featureType: "road", elementType: "geometry", stylers: [{ color: "#2e2e2e" }] },
        { featureType: "road.arterial", elementType: "labels.text.fill", stylers: [{ color: "#666660" }] },
        { featureType: "water", elementType: "geometry", stylers: [{ color: "#111111" }] },
        { featureType: "transit", stylers: [{ color: "#222222" }] },
        { featureType: "poi", stylers: [{ visibility: "off" }] },
      ]
    });
    maps.cliente.directions = new google.maps.DirectionsRenderer({
      map: maps.cliente.map,
      polylineOptions: { strokeColor: "#ff5c00", strokeWeight: 5, strokeOpacity: 0.9 },
      suppressMarkers: false,
    });

    // Autocomplete para Origem e Destino
    const acOrigem = new google.maps.places.Autocomplete(document.getElementById("inputOrigem"), {
      componentRestrictions: { country: "br" }, fields: ["formatted_address", "geometry"]
    });
    const acDestino = new google.maps.places.Autocomplete(document.getElementById("inputDestino"), {
      componentRestrictions: { country: "br" }, fields: ["formatted_address", "geometry"]
    });

    // Traça rota automaticamente quando ambos preenchidos via autocomplete
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

  if (document.getElementById("mapMotorista")) {
    maps.motorista.map = new google.maps.Map(document.getElementById("mapMotorista"), {
      center, zoom: 12,
      styles: [
        { elementType: "geometry", stylers: [{ color: "#1a1a1a" }] },
        { elementType: "labels.text.stroke", stylers: [{ color: "#0a0a0a" }] },
        { elementType: "labels.text.fill", stylers: [{ color: "#888880" }] },
        { featureType: "road", elementType: "geometry", stylers: [{ color: "#2e2e2e" }] },
        { featureType: "road.arterial", elementType: "labels.text.fill", stylers: [{ color: "#666660" }] },
        { featureType: "water", elementType: "geometry", stylers: [{ color: "#111111" }] },
        { featureType: "poi", stylers: [{ visibility: "off" }] },
      ]
    });
    maps.motorista.directions = new google.maps.DirectionsRenderer({
      map: maps.motorista.map,
      polylineOptions: { strokeColor: "#ff5c00", strokeWeight: 5, strokeOpacity: 0.9 },
    });
  }
};

async function tracarRotaCliente() {
  if (!mapsReady) return toast("Mapa ainda não carregou", "error");
  const origem = $("#inputOrigem").value.trim();
  const destino = $("#inputDestino").value.trim();
  if (!origem || !destino) return toast("Informe origem e destino", "error");

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
    $("#rotaInfo").textContent = `Distância: ${distKm.toFixed(2)} km · Tempo: ${leg.duration.text} · Valor estimado: R$ ${valor}`;
    $("#formSolicitacao").dataset.lat = leg.start_location.lat();
    $("#formSolicitacao").dataset.lng = leg.start_location.lng();
    $("#formSolicitacao").dataset.dist = distKm.toFixed(2);
    $("#formSolicitacao").dataset.valor = valor;
  } catch (e) {
    toast("Não foi possível traçar a rota: " + e.message, "error");
  }
}

async function mostrarRotaMotorista(s) {
  if (!mapsReady) return;
  state.solicitacaoAtual = s;
  $("#solicitacaoSelecionada").textContent =
    `#${s.id} · ${s.origem} → ${s.destino}\nPlaca: ${s.placa} · Modelo: ${s.modelo}\nStatus: ${s.status || "-"}`;

  // Tenta pegar posição atual do motorista para traçar rota DAQUI até o cliente
  const tracarDoMotorista = (latMot, lngMot) => {
    if (!s.origem) return;
    const ds = new google.maps.DirectionsService();
    // Rota: posição atual do motorista → origem do cliente → destino do cliente
    const waypoints = s.destino ? [{ location: s.destino, stopover: true }] : [];
    ds.route({
      origin: { lat: latMot, lng: lngMot },
      destination: s.destino || s.origem,
      waypoints: s.destino ? [{ location: s.origem, stopover: true }] : [],
      travelMode: google.maps.TravelMode.DRIVING,
      optimizeWaypoints: false,
    }, (result, status) => {
      if (status === "OK") {
        maps.motorista.directions.setDirections(result);
        const leg = result.routes[0].legs[0];
        const eta = Math.round(leg.duration.value / 60);
        $("#solicitacaoSelecionada").textContent =
          `#${s.id} · ${s.origem} → ${s.destino}\nPlaca: ${s.placa} · ${s.modelo}\nStatus: ${s.status || "-"} · ETA até cliente: ~${eta} min`;
      } else {
        // fallback: rota fixa da solicitação
        ds.route({ origin: s.origem, destination: s.destino || s.origem, travelMode: google.maps.TravelMode.DRIVING },
          (r2, st2) => { if (st2 === "OK") maps.motorista.directions.setDirections(r2); });
      }
    });

    // Marcador da posição atual do motorista
    const posMot = { lat: latMot, lng: lngMot };
    if (!maps.motorista.markerMinha) {
      maps.motorista.markerMinha = new google.maps.Marker({
        position: posMot, map: maps.motorista.map,
        icon: { path: google.maps.SymbolPath.CIRCLE, scale: 10, fillColor: "#ff5c00", fillOpacity: 1, strokeColor: "#fff", strokeWeight: 2 },
        title: "Você está aqui", zIndex: 10
      });
    } else maps.motorista.markerMinha.setPosition(posMot);
  };

  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(
      (pos) => tracarDoMotorista(pos.coords.latitude, pos.coords.longitude),
      () => {
        // sem permissão de GPS: mostra rota da solicitação normalmente
        if (s.origem && s.destino) {
          const ds = new google.maps.DirectionsService();
          ds.route({ origin: s.origem, destination: s.destino, travelMode: google.maps.TravelMode.DRIVING },
            (r, st) => { if (st === "OK") maps.motorista.directions.setDirections(r); });
        }
      }
    );
  } else if (s.origem && s.destino) {
    const ds = new google.maps.DirectionsService();
    ds.route({ origin: s.origem, destination: s.destino, travelMode: google.maps.TravelMode.DRIVING },
      (r, st) => { if (st === "OK") maps.motorista.directions.setDirections(r); });
  }
}

// ============================================================
// AUTH HANDLERS
// ============================================================
$("#formLogin").addEventListener("submit", async (e) => {
  e.preventDefault();
  const f = new FormData(e.target);
  const perfil = f.get("perfil");
  try {
    const r = await AuthService.loginCliente({ email: f.get("email"), senha: f.get("senha") });
    const token = r.token || r.accessToken || r.jwt || r;
    setAuth({ token, perfil, user: r.user || r.cliente || r.motorista || null, motoristaId: r.motoristaId || r.id });
    toast("Login efetuado", "success");
  } catch (err) { toast(err.message, "error"); }
});

$("#formCadastroCliente").addEventListener("submit", async (e) => {
  e.preventDefault();
  const f = new FormData(e.target);
  try {
    await AuthService.cadastrarCliente(Object.fromEntries(f));
    toast("Cadastro realizado! Faça login.", "success");
    showView("view-login");
  } catch (err) { toast(err.message, "error"); }
});

$("#formCadastroMotorista").addEventListener("submit", async (e) => {
  e.preventDefault();
  const f = new FormData(e.target);
  try {
    await AuthService.cadastrarMotorista(Object.fromEntries(f));
    toast("Motorista cadastrado! Faça login.", "success");
    showView("view-login");
  } catch (err) { toast(err.message, "error"); }
});

$("#btnLogout").onclick = logout;
$$("[data-go]").forEach((a) => a.onclick = (e) => { e.preventDefault(); showView(a.dataset.go); });

// ============================================================
// CLIENTE: SOLICITAÇÃO
// ============================================================
$("#btnTracar").onclick = tracarRotaCliente;

$("#formSolicitacao").addEventListener("submit", async (e) => {
  e.preventDefault();
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
  try {
    await SolicitacaoService.criar(body);
    toast("Solicitação criada!", "success");
    e.target.reset();
    $("#rotaInfo").textContent = "";
    carregarMinhasSolicitacoes();
  } catch (err) { toast(err.message, "error"); }
});

async function carregarMinhasSolicitacoes() {
  const cont = $("#listaMinhasSolicitacoes");
  cont.innerHTML = "Carregando...";
  try {
    const lista = await SolicitacaoService.minhas();
    cont.innerHTML = "";
    if (!Array.isArray(lista) || lista.length === 0) { cont.innerHTML = '<p class="muted">Nenhuma solicitação ainda.</p>'; return; }
    lista.forEach((s) => cont.appendChild(itemSolicitacao(s, "cliente")));

    // Auto-ativa tracking se houver solicitação acionada/em_rota (e não estiver rastreando já)
    if (!state.clientePolling) {
      const ativa = lista.find(s => s.status === "acionada" || s.status === "em_rota");
      if (ativa) {
        startClienteMotoristaTracking(ativa.id, ativa);
        // Traça a rota no mapa do cliente automaticamente
        if (mapsReady && maps.cliente.map && ativa.origem && ativa.destino) {
          const ds = new google.maps.DirectionsService();
          ds.route({ origin: ativa.origem, destination: ativa.destino, travelMode: google.maps.TravelMode.DRIVING },
            (r, st) => { if (st === "OK") maps.cliente.directions.setDirections(r); });
        }
      }
    }
  } catch (e) { cont.innerHTML = `<p class="muted">Erro: ${e.message}</p>`; }
}

$("#btnRecarregarMinhas").onclick = carregarMinhasSolicitacoes;

function itemSolicitacao(s, ctx) {
  const div = document.createElement("div");
  div.className = "item";
  const status = s.status || "pendente";
  const urg = (s.urgencia || "").toLowerCase();
  div.innerHTML = `
    <h3>#${s.id || "?"} ${s.origem || ""} → ${s.destino || ""}
      <span class="badge ${urg === "alta" ? "urgente" : ""}">${s.urgencia || "-"}</span>
      <span class="badge ${status === "concluida" ? "ok" : ""}">${status}</span>
    </h3>
    <div class="meta">${s.modelo || ""} · ${s.placa || ""} · ${s.distanciaKm ?? "-"} km · R$ ${s.valorTotal ?? "-"}</div>
    <div class="actions"></div>
  `;
  const actions = div.querySelector(".actions");

  if (ctx === "motorista") {
    const bAcionar = btn("Acionar", "primary", async () => {
      const eta = parseInt(prompt("ETA em minutos?", "15") || "0", 10);
      try {
        await SolicitacaoService.acionar(s.id, { etaMinutos: eta, motoristaId: state.motoristaId });
        state.solicitacaoAtual = s; // ativa o envio de localização para esta solicitação
        toast("Solicitação acionada — rastreamento iniciado", "success");
        carregarSolicitacoesAtivas();
        mostrarRotaMotorista(s); // traça rota da posição atual até o cliente
      }
      catch (err) { toast(err.message, "error"); }
    });
    const bChegou = btn("Cheguei", "", async () => {
      try { await SolicitacaoService.chegou(s.id); toast("Chegada registrada", "success"); carregarSolicitacoesAtivas(); }
      catch (err) { toast(err.message, "error"); }
    });
    const bVer = btn("Ver no Mapa", "ghost", async () => {
      // Seta solicitação atual para envio de localização
      state.solicitacaoAtual = s;
      // Se ainda pendente, aciona automaticamente ao ver mapa
      if ((s.status || "pendente") === "pendente") {
        const eta = parseInt(prompt("ETA em minutos até o cliente?", "12") || "12", 10);
        try {
          await SolicitacaoService.acionar(s.id, { etaMinutos: eta, motoristaId: state.motoristaId });
          toast("Atendimento iniciado — rastreamento ativo", "success");
          s.status = "acionada";
          s.etaMinutos = eta;
          carregarSolicitacoesAtivas();
        } catch (err) { toast(err.message, "error"); }
      }
      mostrarRotaMotorista(s);
    });
    actions.append(bAcionar, bChegou, bVer);
  } else {
    const bCancelar = btn("Cancelar", "danger", async () => {
      if (!confirm("Cancelar essa solicitação?")) return;
      try { await SolicitacaoService.cancelar(s.id); toast("Cancelada", "success"); carregarMinhasSolicitacoes(); }
      catch (err) { toast(err.message, "error"); }
    });
    const bAvaliar = btn("Avaliar", "ghost", async () => {
      const nota = parseInt(prompt("Nota (1-5)?", "5") || "5", 10);
      const comentario = prompt("Comentário?", "") || "";
      try { await SolicitacaoService.avaliar(s.id, { nota, comentario }); toast("Avaliação enviada", "success"); }
      catch (err) { toast(err.message, "error"); }
    });
    const bVer = btn("Ver Rota", "ghost", async () => {
      if (!mapsReady) return;
      const ds = new google.maps.DirectionsService();
      try {
        const r = await ds.route({ origin: s.origem, destination: s.destino, travelMode: google.maps.TravelMode.DRIVING });
        maps.cliente.directions.setDirections(r);
        // Se a solicitação estiver acionada, inicia tracking e abre painel Uber
        if (s.status === "acionada" || s.status === "em_rota") {
          startClienteMotoristaTracking(s.id, s);
          toast("📍 Rastreando motorista em tempo real", "success");
        }
      } catch (e) { toast(e.message, "error"); }
    });

    // Botão de rastreamento ao vivo — aparece quando acionada
    const bRastrear = btn("📍 Rastrear Motorista", "primary small", () => {
      if (!mapsReady) return toast("Mapa não carregou", "error");
      startClienteMotoristaTracking(s.id);
      toast("Rastreamento iniciado", "success");
    });
    if (s.status === "acionada" || s.status === "em_rota") {
      actions.append(bRastrear);
    }
    actions.append(bVer, bCancelar, bAvaliar);
  }
  return div;
}

function btn(label, variant, onclick) {
  const b = document.createElement("button");
  b.textContent = label;
  b.className = `btn small ${variant}`;
  b.onclick = onclick;
  return b;
}

// ============================================================
// MOTORISTA
// ============================================================
async function carregarSolicitacoesAtivas() {
  const cont = $("#listaAtivas");
  cont.innerHTML = "Carregando...";
  try {
    const lista = await SolicitacaoService.ativas();
    cont.innerHTML = "";
    if (!Array.isArray(lista) || lista.length === 0) { cont.innerHTML = '<p class="muted">Nenhuma solicitação ativa.</p>'; return; }
    lista.forEach((s) => cont.appendChild(itemSolicitacao(s, "motorista")));
  } catch (e) { cont.innerHTML = `<p class="muted">Erro: ${e.message}</p>`; }
}
$("#btnRecarregarAtivas").onclick = carregarSolicitacoesAtivas;

// Polling: motorista envia sua localização a cada 8s e atualiza o mapa em tempo real
function startMotoristaLocationPolling() {
  stopPolling();
  if (state.perfil !== "motorista") return;
  if (!navigator.geolocation) return;

  const sendLocation = () => {
    navigator.geolocation.getCurrentPosition(async (pos) => {
      const body = { lat: pos.coords.latitude, lng: pos.coords.longitude, etaMinutos: 0 };
      state._lastMotoristaPos = body; // guarda sempre para o cliente buscar

      try {
        // Sempre envia localização do motorista
        if (state.motoristaId) await MotoristaService.atualizarLocalizacao(state.motoristaId, body);

        // Se tiver solicitação ativa, envia também no endpoint da solicitação
        if (state.solicitacaoAtual?.id) {
          await SolicitacaoService.localizacao(state.solicitacaoAtual.id, body);
        }

        // Sempre mostra posição no mapa do motorista
        if (mapsReady && maps.motorista.map) {
          const p = { lat: body.lat, lng: body.lng };
          if (!maps.motorista.markerMinha) {
            maps.motorista.markerMinha = new google.maps.Marker({
              position: p, map: maps.motorista.map,
              icon: { path: google.maps.SymbolPath.CIRCLE, scale: 10, fillColor: "#ff5c00", fillOpacity: 1, strokeColor: "#fff", strokeWeight: 2 },
              title: "Você está aqui", zIndex: 10
            });
          } else maps.motorista.markerMinha.setPosition(p);
          maps.motorista.map.panTo(p);
        }
      } catch (e) { console.warn(e); }
    }, (err) => console.warn("GPS:", err), { enableHighAccuracy: true, timeout: 7000 });
  };

  sendLocation(); // dispara imediatamente
  state.polling = setInterval(() => {
    sendLocation();
    carregarSolicitacoesAtivas();
  }, 8000);
}

function stopPolling() {
  if (state.polling) { clearInterval(state.polling); state.polling = null; }
  if (state.clientePolling) { clearInterval(state.clientePolling); state.clientePolling = null; }
}

// Polling: cliente acompanha posição do motorista em tempo real (a cada 8s)
// Tenta múltiplas fontes de dados: solicitação → motorista atribuído → fallback silencioso
async function _fetchMotoristaPos(sol) {
  // Fonte 1: campos diretos na solicitação
  const lat1 = sol.latMotorista ?? sol.lat_motorista ?? sol.motorista?.lat ?? sol.motorista?.latitude;
  const lng1 = sol.lngMotorista ?? sol.lng_motorista ?? sol.motorista?.lng ?? sol.motorista?.longitude;
  if (lat1 && lng1) return { lat: parseFloat(lat1), lng: parseFloat(lng1) };

  // Fonte 2: busca motorista atribuído pelo id
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

function _colocarMarkerMotorista(p, statusText) {
  if (!mapsReady || !maps.cliente.map) return;
  if (!maps.cliente.markerMotorista) {
    maps.cliente.markerMotorista = new google.maps.Marker({
      position: p,
      map: maps.cliente.map,
      icon: {
        url: "data:image/svg+xml;charset=UTF-8," + encodeURIComponent(`
          <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 48 48">
            <circle cx="24" cy="24" r="22" fill="#00d4ff" stroke="#05060f" stroke-width="3"/>
            <text x="24" y="30" text-anchor="middle" font-size="20" fill="#05060f">🚛</text>
          </svg>`),
        scaledSize: new google.maps.Size(48, 48),
        anchor: new google.maps.Point(24, 24),
      },
      title: "Motorista",
      zIndex: 20,
      animation: google.maps.Animation.DROP,
    });
  } else {
    maps.cliente.markerMotorista.setPosition(p);
  }
}

// Atualiza o painel de tracking estilo Uber
function _atualizarTrackingPanel(sol, etaMin, distKm) {
  const panel = document.getElementById("trackingPanel");
  if (!panel) return;
  panel.style.display = "flex";

  // ETA e distância
  const etaEl    = document.getElementById("trackingEta");
  const distEl   = document.getElementById("trackingDist");
  const chegEl   = document.getElementById("trackingChegada");
  const nameEl   = document.getElementById("trackingDriverName");
  const plateEl  = document.getElementById("trackingDriverPlate");
  const lblEl    = document.getElementById("trackingStatusLabel");

  if (etaEl)   etaEl.textContent   = etaMin != null ? `~${Math.round(etaMin)}` : "—";
  if (distEl)  distEl.textContent  = distKm != null ? parseFloat(distKm).toFixed(1) : "—";
  if (nameEl)  nameEl.textContent  = sol.motoristaNome ?? sol.motorista?.nome ?? "Motorista";
  if (plateEl) plateEl.textContent = sol.placa ?? "—";

  // Previsão de chegada
  if (chegEl && etaMin != null) {
    const hora = new Date(Date.now() + etaMin * 60000);
    chegEl.textContent = hora.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  }

  // Status label
  const st = (sol.status || "pendente").toLowerCase();
  const lblMap = { pendente: "Aguardando motorista", acionada: "Motorista a caminho", em_rota: "Em rota de reboque", concluida: "Atendimento concluído", cancelada: "Cancelado" };
  if (lblEl) lblEl.textContent = lblMap[st] ?? "Motorista a caminho";

  // Stepper
  const steps = ["tStep1","tStep2","tStep3","tStep4"];
  const stepAtivo = { pendente: 1, acionada: 2, em_rota: 3, concluida: 4, cancelada: 1 };
  const ativo = stepAtivo[st] ?? 1;
  steps.forEach((id, i) => {
    const dot = document.getElementById(id)?.querySelector(".tracking-step-dot");
    if (dot) {
      dot.className = "tracking-step-dot" + (i + 1 <= ativo ? " active" : "") + (i + 1 === ativo ? " current" : "");
    }
  });
}

function startClienteMotoristaTracking(solId, solData) {
  if (state.clientePolling) clearInterval(state.clientePolling);
  const liveTag = document.getElementById("mapLiveTag");
  if (liveTag) liveTag.style.display = "inline-flex";

  // Mostra painel imediatamente com dados já disponíveis
  if (solData) _atualizarTrackingPanel(solData, solData.etaMinutos, solData.distanciaKm);

  const tick = async () => {
    if (!mapsReady || !maps.cliente.map) return;
    try {
      const sol = await SolicitacaoService.buscar(solId);
      if (!sol) return;

      const pos = await _fetchMotoristaPos(sol);

      // Calcula ETA real via DirectionsService se tiver posição do motorista e origem
      if (pos && sol.origem) {
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
            _atualizarTrackingPanel(sol, etaMin, distKm);
          } else {
            _atualizarTrackingPanel(sol, sol.etaMinutos, sol.distanciaKm);
          }
        });
        _colocarMarkerMotorista(pos, `Status: ${sol.status || "em rota"}`);
        maps.cliente.map.panTo(pos);
      } else {
        // Sem posição GPS ainda, usa ETA da solicitação
        _atualizarTrackingPanel(sol, sol.etaMinutos, sol.distanciaKm);
      }
    } catch (e) { /* silencia */ }
  };

  tick();
  state.clientePolling = setInterval(tick, 8000);
}

// ============================================================
// VEÍCULOS
// ============================================================
$("#formVeiculo").addEventListener("submit", async (e) => {
  e.preventDefault();
  const f = new FormData(e.target);
  try { await VeiculoService.criar(Object.fromEntries(f)); toast("Veículo cadastrado", "success"); e.target.reset(); }
  catch (err) { toast(err.message, "error"); }
});

$("#formBuscaVeiculo").addEventListener("submit", async (e) => {
  e.preventDefault();
  const placa = new FormData(e.target).get("placa");
  try {
    const v = await VeiculoService.porPlaca(placa);
    $("#resultadoVeiculo").textContent = JSON.stringify(v, null, 2);
  } catch (err) { $("#resultadoVeiculo").textContent = err.message; }
});

// ============================================================
// FINANCEIRO — Dashboard rico
// ============================================================
function finSetState(state) {
  // state: "idle" | "loading" | "error" | "success"
  const btn    = $("#btnRecarregarFinanceiro");
  const icon   = btn?.querySelector(".fin-refresh-icon");
  const label  = btn?.querySelector(".fin-refresh-label");
  const elLoad = $("#finStateLoading");
  const elErr  = $("#finStateError");

  if (elLoad) elLoad.style.display = state === "loading" ? "flex" : "none";
  if (elErr)  elErr.style.display  = state === "error"   ? "flex" : "none";

  if (btn) {
    btn.disabled = state === "loading";
    btn.classList.toggle("fin-btn-loading",  state === "loading");
    btn.classList.toggle("fin-btn-success",  state === "success");
    btn.classList.toggle("fin-btn-error",    state === "error");
    if (label) {
      label.textContent = state === "loading" ? "Carregando…"
                        : state === "success"  ? "Atualizado ✓"
                        : state === "error"    ? "Tentar novamente"
                        : "Atualizar";
    }
    if (icon) icon.style.animation = state === "loading" ? "finSpin 0.8s linear infinite" : "";
    if (state === "success" || state === "error") {
      setTimeout(() => {
        btn.classList.remove("fin-btn-success", "fin-btn-error");
        if (label) label.textContent = "Atualizar";
        if (icon)  icon.style.animation = "";
      }, 3000);
    }
  }
}

function finRenderKpis(d) {
  // Tenta mapear diferentes formatos de API
  const total     = d.totalRecebido ?? d.totalReceita ?? d.valorTotal ?? d.total ?? null;
  const servicos  = d.totalServicos ?? d.servicosRealizados ?? d.concluidos ?? d.totalConcluidos ?? null;
  const ticket    = (total != null && servicos) ? (total / servicos) : (d.ticketMedio ?? d.mediaPorServico ?? null);
  const cancela   = d.cancelamentos ?? d.totalCancelamentos ?? d.cancelados ?? null;

  const fmt = (v) => v != null ? `R$ ${parseFloat(v).toFixed(2).replace(".", ",")}` : "—";
  const num = (v) => v != null ? parseInt(v) : "—";

  $("#finValorTotal").textContent   = fmt(total);
  $("#finTotalServicos").textContent = num(servicos);
  $("#finTicketMedio").textContent  = fmt(ticket);
  $("#finCancelamentos").textContent = num(cancela);

  const strip = $("#finKpiStrip");
  if (strip) { strip.style.display = "grid"; strip.classList.add("fin-kpi-strip--visible"); }
}

function finRenderTabela(d) {
  const tbody = $("#finTabelaBody");
  const card  = $("#finTabelaCard");
  const vazia = $("#finTabelaVazia");
  if (!tbody || !card) return;

  // Tenta encontrar lista de transações em diferentes campos
  const lista = d.solicitacoes ?? d.transacoes ?? d.servicos ?? d.registros ?? (Array.isArray(d) ? d : null);

  if (!lista || lista.length === 0) {
    card.style.display = "block";
    tbody.innerHTML = "";
    if (vazia) vazia.style.display = "block";
    return;
  }

  card.style.display = "block";
  if (vazia) vazia.style.display = "none";
  const statusLabel = { concluida: "Concluída", cancelada: "Cancelada", acionada: "Em atendimento", pendente: "Pendente" };
  const statusClass = { concluida: "fin-badge--green", cancelada: "fin-badge--red", acionada: "fin-badge--cyan", pendente: "fin-badge--amber" };

  tbody.innerHTML = lista.map((s, i) => {
    const st   = (s.status || "pendente").toLowerCase();
    const data = s.criadoEm ?? s.createdAt ?? s.data ?? "—";
    const dataFmt = data !== "—" ? new Date(data).toLocaleDateString("pt-BR", { day:"2-digit", month:"short", year:"2-digit" }) : "—";
    const dist = s.distanciaKm != null ? `${parseFloat(s.distanciaKm).toFixed(1)} km` : "—";
    const val  = s.valorTotal != null ? `R$ ${parseFloat(s.valorTotal).toFixed(2).replace(".",",")}` : "—";
    return `<tr class="fin-tr" style="animation-delay:${i * 0.04}s">
      <td class="fin-td fin-td-id">#${s.id ?? i+1}</td>
      <td class="fin-td fin-td-rota">${s.origem ?? "—"} → ${s.destino ?? "—"}</td>
      <td class="fin-td fin-td-data">${dataFmt}</td>
      <td class="fin-td fin-td-dist">${dist}</td>
      <td class="fin-td"><span class="fin-badge ${statusClass[st] ?? ""}">${statusLabel[st] ?? st}</span></td>
      <td class="fin-td fin-td-val">${val}</td>
    </tr>`;
  }).join("");
}

function finRenderRaw(d) {
  const raw = $("#finRawPre");
  const card = $("#finRawCard");
  if (raw && card) {
    raw.textContent = JSON.stringify(d, null, 2);
    card.style.display = "block";
  }
}

async function carregarFinanceiro() {
  finSetState("loading");
  // Esconde conteúdo anterior
  const strip = $("#finKpiStrip");
  const tCard = $("#finTabelaCard");
  const rCard = $("#finRawCard");
  if (strip) strip.style.display = "none";
  if (tCard) tCard.style.display = "none";
  if (rCard) rCard.style.display = "none";

  try {
    const d = await FinanceiroService.obter();
    finSetState("success");

    const now = new Date().toLocaleTimeString("pt-BR", { hour:"2-digit", minute:"2-digit" });
    const upd = $("#finLastUpdate");
    if (upd) upd.textContent = `Última atualização: ${now}`;

    finRenderKpis(d);
    finRenderTabela(d);
    finRenderRaw(d);
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