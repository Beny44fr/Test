/* =====================================================================
   Pronos CM 2026 — Application (vanilla JS)
   ===================================================================== */
(function () {
  const WC = window.WC;
  let state = WC.store.load();
  let view = "home";
  let filterGroup = "A";
  let viewBy = "group"; // "group" | "date" : tri de l'écran de saisie
  let filterDate = null; // date sélectionnée en mode "par date"
  let predictPhase = "groups"; // "groups" | "bracket"
  let koRound = "r32"; // tour affiché dans le tableau final
  const scorerOther = {}; // mode "Autre" du buteur, par contexte (bonus/bonusResult)
  let resultsMode = false; // dans l'onglet Pronos : false = mes pronos, true = saisie résultats

  const app = document.getElementById("app");
  const KICKOFF = new Date("2026-06-11T16:00:00Z");

  /* ---------------- Utils ---------------- */
  const save = () => WC.store.save(state);
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const fmtDate = (iso) =>
    new Date(iso + "T12:00:00").toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", month: "short" });
  const fmtChip = (iso) =>
    new Date(iso + "T12:00:00").toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit" });
  const toast = (msg) => {
    let t = document.getElementById("toast");
    if (!t) {
      t = document.createElement("div");
      t.id = "toast";
      document.body.appendChild(t);
    }
    t.textContent = msg;
    t.classList.add("show");
    clearTimeout(t._t);
    t._t = setTimeout(() => t.classList.remove("show"), 2200);
  };

  const me = () => ({ name: state.me.name || "Moi", predictions: state.predictions, bonus: state.bonus, bracket: state.bracket });
  const allPlayers = () => [me(), ...state.league];
  const hasResults = () => WC.MATCHES.some((m) => WC.isFilled(state.results[m.id]));

  // Date / ville effectives (surchargées par l'API si dispo)
  const effDate = (m) => (state.schedule[m.id] && state.schedule[m.id].date) || m.date;
  const effCity = (m) => state.schedule[m.id] && state.schedule[m.id].city;
  const uniqueDates = () => [...new Set(WC.MATCHES.map(effDate))].sort();

  // Pré-remplit tous les pronostics manquants à 0-0
  function ensureDefaults() {
    WC.MATCHES.forEach((m) => {
      if (!WC.isFilled(state.predictions[m.id])) state.predictions[m.id] = { h: 0, a: 0 };
    });
  }

  // Tableau final calculé automatiquement depuis les pronos de groupes
  function computeR32(preds) {
    const q = WC.qualifiers(preds);
    const seedA = [...q.winners, ...q.thirds.slice(0, 4)]; // 16
    const seedB = [...q.runners, ...q.thirds.slice(4, 8)]; // 16
    const teams = [];
    for (let i = 0; i < 16; i++) {
      teams[i * 2] = seedA[i] ? seedA[i].name : "";
      teams[i * 2 + 1] = seedB[i] ? seedB[i].name : "";
    }
    return teams;
  }

  /* ---------------- Rendu principal ---------------- */
  function render() {
    app.innerHTML = views[view] ? views[view]() : views.home();
    renderNav();
    window.scrollTo({ top: 0, behavior: "instant" in window ? "instant" : "auto" });
  }

  function renderNav() {
    const items = [
      ["home", "home", "Accueil"],
      ["predict", "ball", "Pronos"],
      ["ranking", "trophy", "Classement"],
      ["league", "users", "Ligue"],
      ["results", "target", "Résultats"],
    ];
    document.getElementById("nav").innerHTML = items
      .map(
        ([id, ic, lab]) =>
          `<button class="nav-btn ${view === id ? "active" : ""}" data-view="${id}">
             <span class="nav-ic">${WC.icon(ic, 22)}</span><span class="nav-lab">${lab}</span>
           </button>`
      )
      .join("");
  }

  /* ---------------- Vues ---------------- */
  const views = {};

  views.home = function () {
    const days = Math.max(0, Math.ceil((KICKOFF - new Date()) / 86400000));
    const filled = WC.MATCHES.filter((m) => WC.isFilled(state.predictions[m.id])).length;
    const pct = Math.round((filled / WC.MATCHES.length) * 100);
    const koFilled = (state.bracket.win.final || []).filter(Boolean).length
      ? "Champion désigné"
      : (state.bracket.teams || []).filter(Boolean).length
      ? "En cours"
      : "À remplir";
    const name = state.me.name || "";
    return `
      <header class="hero">
        <div class="hero-badge">
          FIFA WORLD CUP 26
          <span class="hero-flags">${WC.flag("ca")}${WC.flag("mx")}${WC.flag("us")}</span>
        </div>
        <h1 class="hero-title">Pronos<span>26</span></h1>
        <p class="hero-sub">Défie tes collègues sur la Coupe du Monde.</p>
        <div class="countdown">
          <div class="cd-num">${days}</div>
          <div class="cd-lab">jour${days > 1 ? "s" : ""} avant le coup d'envoi<br><span>11 juin 2026 · Estadio Azteca</span></div>
        </div>
      </header>

      <section class="card">
        <label class="field-lab" for="meName">Ton nom de joueur</label>
        <input id="meName" class="input" maxlength="24" placeholder="Ex : Benjamin" value="${esc(name)}" data-name />
        <p class="hint">Il apparaîtra dans le classement de la ligue.</p>
      </section>

      <section class="card">
        <div class="row-between">
          <strong>Mes pronostics</strong>
          <span class="pill">${filled}/${WC.MATCHES.length}</span>
        </div>
        <div class="progress"><div class="progress-bar" style="width:${pct}%"></div></div>
        <button class="btn btn-primary full" data-act="goGroups">${filled ? "Continuer mes pronos" : "Commencer mes pronos"} ${WC.icon("arrowRight", 18)}</button>
        <button class="btn btn-ghost full" data-act="goBracket">${WC.icon("trophy", 16)} Tableau final — ${koFilled}</button>
      </section>

      <section class="grid2">
        <button class="tile" data-view="ranking"><span class="tile-ic">${WC.icon("trophy", 26)}</span>Classement</button>
        <button class="tile" data-view="league"><span class="tile-ic">${WC.icon("users", 26)}</span>Ma ligue</button>
        <button class="tile" data-view="results"><span class="tile-ic">${WC.icon("target", 26)}</span>Résultats</button>
        <button class="tile" data-act="rules"><span class="tile-ic">${WC.icon("book", 26)}</span>Règles</button>
      </section>

      <div class="reset-row">
        <button class="link-btn danger" data-act="resetMine">${WC.icon("x", 14)} Réinitialiser mes pronostics</button>
      </div>
      <p class="foot">Données : tirage officiel du 5 déc. 2025 · dates indicatives</p>
    `;
  };

  views.predict = function () {
    const subTabs = `
      <div class="subtabs">
        <button class="subtab ${predictPhase === "groups" ? "active" : ""}" data-phase="groups">${WC.icon("ball", 16)} Phase de groupes</button>
        <button class="subtab ${predictPhase === "bracket" ? "active" : ""}" data-phase="bracket">${WC.icon("trophy", 16)} Tableau final</button>
      </div>`;

    const head = `
      <header class="topbar">
        <h2>${resultsMode ? "Saisie des résultats" : "Mes pronostics"}</h2>
      </header>
      ${resultsMode ? `<p class="banner">Mode organisateur — saisis ici les vrais résultats pour calculer le classement.</p>` : ""}
      ${subTabs}`;

    if (predictPhase === "bracket") return head + bracketView(resultsMode);

    const store = resultsMode ? state.results : state.predictions;
    const filled = WC.MATCHES.filter((m) => WC.isFilled(store[m.id])).length;

    // Bascule de tri : par groupe / par date
    const seg = `
      <div class="seg">
        <button class="seg-btn ${viewBy === "group" ? "active" : ""}" data-viewby="group">Par groupe</button>
        <button class="seg-btn ${viewBy === "date" ? "active" : ""}" data-viewby="date">Par date</button>
      </div>`;

    let chips, matches;
    if (viewBy === "date") {
      const dates = uniqueDates();
      if (!filterDate || !dates.includes(filterDate)) filterDate = dates[0];
      chips = dates
        .map(
          (d) =>
            `<button class="chip chip-wide ${d === filterDate ? "active" : ""}" data-date="${d}">${fmtChip(d)}</button>`
        )
        .join("");
      matches = WC.MATCHES.filter((m) => effDate(m) === filterDate);
    } else {
      chips = WC.GROUPS.map(
        (g) => `<button class="chip ${g.letter === filterGroup ? "active" : ""}" data-group="${g.letter}">${g.letter}</button>`
      ).join("");
      matches = WC.MATCHES.filter((m) => m.group === filterGroup).sort((a, b) =>
        effDate(a) < effDate(b) ? -1 : effDate(a) > effDate(b) ? 1 : 0
      );
    }

    return `
      ${head}
      ${resultsMode ? syncBar() : ""}
      <div class="phase-meta"><span class="pill">${filled}/${WC.MATCHES.length} matchs</span></div>
      ${seg}
      <div class="chips">${chips}</div>
      <div class="match-list">
        ${matches.map((m) => matchCard(m, store)).join("")}
      </div>
      ${
        resultsMode
          ? bonusBlock(state.bonusResults, true)
          : `${bonusBlock(state.bonus, false)}
             <button class="btn btn-primary full" data-act="share">${WC.icon("share", 18)} Partager mes pronos</button>`
      }
    `;
  };

  // Barre de synchronisation API (mode résultats) — détaillée dans api.js
  function syncBar() {
    const last = state.apiCfg && state.apiCfg.lastSync;
    return `
      <div class="syncbar">
        <button class="btn btn-primary" data-act="apiSync">${WC.icon("download", 16)} Synchroniser les résultats</button>
        <button class="link-btn" data-act="apiSettings">Réglages API</button>
        ${last ? `<span class="sync-info">Dernière synchro : ${esc(last)}</span>` : `<span class="sync-info">Jamais synchronisé</span>`}
      </div>`;
  }

  /* ---------------- Tableau final (phases finales) ---------------- */
  function bracketView(isResults) {
    const B = isResults ? state.bracketResults : state.bracket;
    if (!B.win) Object.assign(B, WC.store.emptyBracket());
    let r32teams;
    if (isResults) {
      // Côté résultats : l'API fait foi ; sinon on dérive des résultats de groupes
      r32teams = B.teams && B.teams.length ? B.teams : computeR32(state.results);
      B.teams = r32teams;
    } else {
      // Mes pronos : 16es alimentés automatiquement par mes pronos de groupes
      r32teams = computeR32(state.predictions);
      B.teams = r32teams;
      pruneBracket(B, r32teams);
    }
    const apiSourced = isResults && B.source === "api";
    const round = WC.KO_ROUNDS.find((r) => r.key === koRound) || WC.KO_ROUNDS[0];

    const roundChips = WC.KO_ROUNDS.map(
      (r) => `<button class="chip chip-wide ${r.key === round.key ? "active" : ""}" data-round-tab="${r.key}">${r.short}</button>`
    ).join("");

    // Récupère les deux équipes d'un match du tour courant
    const teamsOf = (i) => {
      if (round.key === "r32") return [r32teams[i * 2] || "", r32teams[i * 2 + 1] || ""];
      const pw = B.win[round.prev] || [];
      return [pw[i * 2] || "", pw[i * 2 + 1] || ""];
    };

    const champion = (B.win.final || [])[0];
    const banner = champion
      ? `<div class="champ-banner">${WC.icon("trophy", 20)} Champion ${isResults ? "" : "pronostiqué"} : <b>${flagName(champion)}</b></div>`
      : "";

    let cards = "";
    for (let i = 0; i < round.n; i++) {
      const [a, b] = teamsOf(i);
      const winner = (B.win[round.key] || [])[i] || "";
      cards += koMatchCard(round, i, a, b, winner, isResults);
    }

    // Petite finale (3e place) : affichée dans l'onglet Finale
    if (round.key === "final") {
      const l0 = sfLoserOf(B, 0), l1 = sfLoserOf(B, 1);
      const tw = (B.win.third || [])[0] || "";
      cards += `<div class="ko-subhead">${WC.icon("medal", 16)} Petite finale — 3e place <span class="pts">+${WC.THIRD_POINTS}</span></div>`;
      cards += koMatchCard({ key: "third" }, 0, l0, l1, tw, isResults);
      if (tw) {
        const third = `<span class="champ-third">${WC.icon("medal", 16)} 3e place : <b>${flagName(tw)}</b></span>`;
        cards += `<div class="ko-thirdline">${third}</div>`;
      }
    }

    let autoNote = "";
    if (apiSourced) {
      autoNote = `<p class="hint ko-auto">${WC.icon("download", 14)} Tableau final renseigné automatiquement depuis l'API. Tu peux ajuster manuellement si besoin.</p>`;
    } else if (round.key === "r32") {
      autoNote = `<p class="hint ko-auto">${WC.icon("ball", 14)} Les 16es sont alimentés automatiquement par ${isResults ? "les résultats" : "tes pronos"} de la phase de groupes (1ers, 2es + 8 meilleurs 3es). Fais ensuite avancer chaque équipe.</p>`;
    }

    return `
      <p class="hint ko-hint">Barème : ${WC.KO_POINTS.r32} pts par qualifié en 8es, ${WC.KO_POINTS.r16} en quarts, ${WC.KO_POINTS.qf} en demies, ${WC.KO_POINTS.sf} par finaliste, ${WC.THIRD_POINTS} pts pour la 3e place, ${WC.KO_POINTS.final} pts pour le vainqueur.</p>
      ${banner}
      <div class="chips">${roundChips}</div>
      ${autoNote}
      <div class="match-list">${cards}</div>
      ${
        isResults
          ? ""
          : `<button class="btn btn-primary full" data-act="share">${WC.icon("share", 18)} Partager mes pronos</button>`
      }
    `;
  }

  function koMatchCard(round, i, a, b, winner, isResults) {
    const ds = isResults ? "koResult" : "ko";
    const cell = (team) => `<span class="ko-team-label">${team ? flagName(team) : '<span class="muted">— à venir —</span>'}</span>`;
    const advBtn = (team) =>
      `<button class="ko-adv ${winner && winner === team ? "win" : ""}" data-act="koWin" data-store="${ds}" data-round="${round.key}" data-idx="${i}" data-team="${esc(team)}" ${team ? "" : "disabled"} aria-label="faire avancer">${WC.icon("check", 14)}</button>`;
    return `
      <div class="ko-match ${winner ? "decided" : ""}">
        <span class="ko-num">M${i + 1}</span>
        <div class="ko-side ${winner === a ? "is-win" : ""}">${cell(a)}${advBtn(a)}</div>
        <div class="ko-side ${winner === b ? "is-win" : ""}">${cell(b)}${advBtn(b)}</div>
      </div>`;
  }

  function flagName(name) {
    const t = WC.TEAM_BY_NAME[name];
    return t ? `${WC.flag(t.code)}<span class="tname">${esc(name)}</span>` : esc(name);
  }

  function matchCard(m, store) {
    const v = store[m.id] || {};
    const ds = resultsMode ? "result" : "pred";
    const stepper = (side) => {
      const val = Number.isInteger(v[side]) ? v[side] : "";
      return `
        <div class="stepper">
          <button class="step" data-act="dec" data-mid="${m.id}" data-side="${side}" data-store="${ds}" aria-label="moins">${WC.icon("minus", 16)}</button>
          <input class="score" inputmode="numeric" maxlength="2" data-mid="${m.id}" data-side="${side}" data-store="${ds}" value="${val}" placeholder="·" />
          <button class="step" data-act="inc" data-mid="${m.id}" data-side="${side}" data-store="${ds}" aria-label="plus">${WC.icon("plus", 16)}</button>
        </div>`;
    };
    const done = WC.isFilled(v);
    const city = effCity(m);
    return `
      <div class="match ${done ? "done" : ""}">
        <div class="match-meta">Groupe ${m.group} · J${m.matchday} · ${fmtDate(effDate(m))}${city ? ` · ${esc(city)}` : ""}</div>
        <div class="match-row">
          <div class="team team-h">${WC.flag(m.home.code)}<span class="tname">${esc(m.home.name)}</span></div>
          ${stepper("h")}
          <span class="vs">:</span>
          ${stepper("a")}
          <div class="team team-a"><span class="tname">${esc(m.away.name)}</span>${WC.flag(m.away.code)}</div>
        </div>
      </div>`;
  }

  function scorerField(val, ds) {
    const inList = WC.TOP_SCORERS.includes(val);
    const other = scorerOther[ds] || (!!val && !inList);
    const opts =
      `<option value="" ${!val && !other ? "selected" : ""}>— choisir —</option>` +
      WC.TOP_SCORERS.map((p) => `<option value="${esc(p)}" ${inList && val === p ? "selected" : ""}>${esc(p)}</option>`).join("") +
      `<option value="__other__" ${other ? "selected" : ""}>Autre…</option>`;
    const sel = `<select class="input" data-scorer-select data-store="${ds}">${opts}</select>`;
    const txt = other
      ? `<input class="input scorer-other" data-scorer-text data-store="${ds}" maxlength="40" placeholder="Nom du buteur" value="${esc(val)}" />`
      : "";
    return sel + txt;
  }

  function bonusBlock(store, isResults) {
    const teamOpts = (sel) =>
      `<option value="">—</option>` +
      WC.TEAMS.map((t) => `<option value="${esc(t.name)}" ${sel === t.name ? "selected" : ""}>${esc(t.name)}</option>`).join("");
    const ds = isResults ? "bonusResult" : "bonus";
    return `
      <section class="card">
        <strong class="card-head">${WC.icon("gift", 18)} Questions bonus</strong>
        <p class="hint">Points en fin de tournoi.</p>
        ${WC.BONUS.map((b) => {
          const val = (store || {})[b.id] || "";
          let input;
          if (b.id === "topScorer") input = scorerField(val, ds);
          else if (b.type === "team") input = `<select class="input" data-bonus="${b.id}" data-store="${ds}">${teamOpts(val)}</select>`;
          else input = `<input class="input" data-bonus="${b.id}" data-store="${ds}" maxlength="40" placeholder="Nom du joueur" value="${esc(val)}" />`;
          return `<div class="bonus-row"><label><span class="bonus-lab">${WC.icon(b.icon, 16)} ${b.label}</span> <span class="pts">+${b.points}</span></label>${input}</div>`;
        }).join("")}
      </section>`;
  }

  views.ranking = function () {
    if (!hasResults()) {
      return `
        <header class="topbar"><h2>Classement</h2></header>
        <div class="empty">
          <div class="empty-ic">${WC.icon("chart", 48)}</div>
          <p>Le classement apparaîtra dès que des résultats seront saisis dans l'onglet <b>Résultats</b>.</p>
          <button class="btn btn-ghost" data-view="results">Saisir des résultats</button>
        </div>`;
    }
    const rows = allPlayers()
      .map((p) => ({ name: p.name, ...WC.totalPoints(p, state.results, state.bonusResults, state.bracketResults) }))
      .sort((a, b) => b.total - a.total || b.exact - a.exact);
    return `
      <header class="topbar"><h2>Classement</h2><span class="pill">${rows.length} joueur${rows.length > 1 ? "s" : ""}</span></header>
      <div class="board">
        ${rows
          .map(
            (r, i) => `
          <div class="rank-row ${r.name === (state.me.name || "Moi") ? "is-me" : ""}">
            <div class="rank-pos rank-${i + 1 <= 3 ? i + 1 : "n"}">${i + 1 <= 3 ? WC.icon("trophy", 18) : i + 1}</div>
            <div class="rank-name">${esc(r.name)}<span class="rank-sub">${r.matchPts} groupes · ${r.koPts} tableau${r.bonusPts ? ` · ${r.bonusPts} bonus` : ""} · ${r.exact} exact${r.exact > 1 ? "s" : ""}</span></div>
            <div class="rank-pts">${r.total}<span>pts</span></div>
          </div>`
          )
          .join("")}
      </div>
      <p class="foot">Barème : score exact ${WC.POINTS.exact} pts · bonne différence ${WC.POINTS.diff} pts · bon résultat ${WC.POINTS.outcome} pt · tableau final ${WC.KO_POINTS.r32}→${WC.KO_POINTS.final} pts</p>
    `;
  };

  views.league = function () {
    const myCode = WC.encodePlayer(me());
    return `
      <header class="topbar"><h2>Ma ligue</h2></header>

      <section class="card">
        <strong class="card-head">${WC.icon("share", 18)} Partager mes pronos</strong>
        <p class="hint">Envoie ton lien ou ton code à l'organisateur.</p>
        <div class="btn-group">
          <button class="btn btn-primary" data-act="copyLink">${WC.icon("link", 16)} Copier le lien</button>
          <button class="btn btn-ghost" data-act="copyCode">${WC.icon("copy", 16)} Copier le code</button>
          <button class="btn btn-ghost" data-act="share">${WC.icon("share", 16)} Partager</button>
        </div>
        <textarea class="code-box" readonly rows="3">${myCode}</textarea>
      </section>

      <section class="card">
        <strong class="card-head">${WC.icon("download", 18)} Ajouter un collègue</strong>
        <p class="hint">Colle ici le code reçu d'un collègue.</p>
        <textarea id="importCode" class="code-box" rows="3" placeholder="Colle un code de pronos…"></textarea>
        <button class="btn btn-primary full" data-act="importCode">Ajouter au classement</button>
      </section>

      <section class="card">
        <div class="row-between"><strong>Membres (${state.league.length})</strong>
          ${state.league.length ? `<button class="link-btn" data-act="exportLeague">${WC.icon("upload", 14)} Exporter</button>` : ""}
        </div>
        ${
          state.league.length
            ? state.league
                .map(
                  (p, i) => `<div class="member"><span class="member-name">${WC.icon("user", 16)} ${esc(p.name)}</span><button class="link-btn danger" data-act="removeMember" data-i="${i}">Retirer</button></div>`
                )
                .join("")
            : `<p class="hint">Aucun collègue ajouté pour l'instant.</p>`
        }
      </section>
    `;
  };

  views.results = function () {
    resultsMode = true;
    return views.predict();
  };

  /* ---------------- Interactions ---------------- */
  function setScore(store, mid, side, val) {
    const target = store === "result" ? state.results : state.predictions;
    target[mid] = target[mid] || {};
    if (val === "" || val == null) {
      delete target[mid][side];
      if (!("h" in target[mid]) && !("a" in target[mid])) delete target[mid];
    } else {
      target[mid][side] = Math.max(0, Math.min(99, parseInt(val, 10) || 0));
    }
    // Le tableau de pronostics est dérivé des scores de groupes : on le garde cohérent.
    // (Le tableau des résultats est piloté par l'API / l'organisateur.)
    if (store !== "result") pruneBracket(state.bracket, computeR32(state.predictions));
    save();
  }

  document.addEventListener("click", (e) => {
    const b = e.target.closest("[data-view],[data-act],[data-group],[data-date],[data-viewby],[data-phase],[data-round-tab]");
    if (!b) return;

    if (b.dataset.view) {
      view = b.dataset.view;
      if (view !== "results") resultsMode = false;
      return render();
    }
    if (b.dataset.group) {
      filterGroup = b.dataset.group;
      return render();
    }
    if (b.dataset.date) {
      filterDate = b.dataset.date;
      return render();
    }
    if (b.dataset.viewby) {
      viewBy = b.dataset.viewby;
      return render();
    }
    if (b.dataset.phase) {
      predictPhase = b.dataset.phase;
      return render();
    }
    if (b.dataset.roundTab) {
      koRound = b.dataset.roundTab;
      return render();
    }

    const act = b.dataset.act;
    if (act === "goGroups") {
      resultsMode = false;
      predictPhase = "groups";
      view = "predict";
      return render();
    }
    if (act === "goBracket") {
      resultsMode = false;
      predictPhase = "bracket";
      view = "predict";
      return render();
    }
    if (act === "koWin") {
      const isRes = b.dataset.store === "koResult";
      const target = isRes ? state.bracketResults : state.bracket;
      const arr = (target.win[b.dataset.round] = target.win[b.dataset.round] || []);
      const idx = +b.dataset.idx;
      arr[idx] = arr[idx] === b.dataset.team ? "" : b.dataset.team; // re-tap = annuler
      if (isRes) target.source = "manual";
      else pruneBracket(target, computeR32(state.predictions));
      save();
      return render();
    }
    if (act === "apiSync") {
      return doApiSync();
    }
    if (act === "apiSettings") {
      return openApiSettings();
    }
    if (act === "resetMine") {
      if (confirm("Réinitialiser tous TES pronostics (tout repasse à 0-0, tableau final remis à zéro) ? Le classement et les résultats ne sont pas touchés.")) {
        state.predictions = {};
        state.bonus = {};
        state.bracket = WC.store.emptyBracket();
        ensureDefaults();
        save();
        toast("Pronostics réinitialisés (0-0)");
        render();
      }
      return;
    }
    if (act === "inc" || act === "dec") {
      const inp = document.querySelector(`.score[data-mid="${b.dataset.mid}"][data-side="${b.dataset.side}"][data-store="${b.dataset.store}"]`);
      let n = parseInt(inp.value, 10);
      n = isNaN(n) ? 0 : n;
      n = act === "inc" ? Math.min(99, n + 1) : Math.max(0, n - 1);
      inp.value = n;
      setScore(b.dataset.store, b.dataset.mid, b.dataset.side, n);
      inp.closest(".match").classList.toggle("done", WC.isFilled((b.dataset.store === "result" ? state.results : state.predictions)[b.dataset.mid]));
      updateProgress();
    } else if (act === "rules") {
      openRules();
    } else if (act === "share") {
      shareMe();
    } else if (act === "copyLink") {
      copy(shareLink());
      toast("Lien copié");
    } else if (act === "copyCode") {
      copy(WC.encodePlayer(me()));
      toast("Code copié");
    } else if (act === "importCode") {
      importColleague();
    } else if (act === "removeMember") {
      state.league.splice(+b.dataset.i, 1);
      save();
      render();
    } else if (act === "exportLeague") {
      exportLeague();
    }
  });

  // Saisie directe dans les champs
  document.addEventListener("input", (e) => {
    const el = e.target;
    if (el.dataset.name !== undefined) {
      state.me.name = el.value.slice(0, 24);
      save();
    } else if (el.classList.contains("score")) {
      let v = el.value.replace(/[^0-9]/g, "").slice(0, 2);
      el.value = v;
      setScore(el.dataset.store, el.dataset.mid, el.dataset.side, v === "" ? "" : v);
      const cur = (el.dataset.store === "result" ? state.results : state.predictions)[el.dataset.mid];
      el.closest(".match").classList.toggle("done", WC.isFilled(cur));
      updateProgress();
    } else if (el.dataset.bonus) {
      const target = el.dataset.store === "bonusResult" ? state.bonusResults : state.bonus;
      target[el.dataset.bonus] = el.value;
      save();
    } else if (el.hasAttribute("data-scorer-text")) {
      const target = el.dataset.store === "bonusResult" ? state.bonusResults : state.bonus;
      target.topScorer = el.value;
      save();
    }
  });

  // Selects : certains navigateurs n'émettent que "change"
  document.addEventListener("change", (e) => {
    const el = e.target;
    if (el.hasAttribute && el.hasAttribute("data-scorer-select")) handleScorerSelect(el);
  });

  function handleScorerSelect(el) {
    const ds = el.dataset.store;
    const target = ds === "bonusResult" ? state.bonusResults : state.bonus;
    if (el.value === "__other__") {
      scorerOther[ds] = true;
      target.topScorer = "";
    } else {
      scorerOther[ds] = false;
      target.topScorer = el.value;
    }
    save();
    render();
  }

  // Perdant de la demi-finale i (pour la petite finale)
  function sfLoserOf(B, i) {
    const pw = (B.win && B.win.qf) || [];
    const a = pw[i * 2] || "";
    const b = pw[i * 2 + 1] || "";
    const w = (B.win.sf || [])[i];
    if (!w) return "";
    return w === a ? b : a;
  }

  // Nettoie les vainqueurs devenus incohérents après un changement amont
  function pruneBracket(B, teams) {
    if (!B.win) Object.assign(B, WC.store.emptyBracket());
    const r32 = teams || B.teams || [];
    B.teams = r32;
    WC.KO_ROUNDS.forEach((r) => {
      const w = (B.win[r.key] = B.win[r.key] || []);
      for (let i = 0; i < r.n; i++) {
        let a, b;
        if (r.key === "r32") {
          a = r32[i * 2] || "";
          b = r32[i * 2 + 1] || "";
        } else {
          const pw = B.win[r.prev] || [];
          a = pw[i * 2] || "";
          b = pw[i * 2 + 1] || "";
        }
        if (w[i] && w[i] !== a && w[i] !== b) w[i] = "";
      }
    });
    // Petite finale : le 3e doit être l'un des deux perdants de demie
    const tw = (B.win.third || [])[0];
    if (tw && tw !== sfLoserOf(B, 0) && tw !== sfLoserOf(B, 1)) B.win.third = [];
  }

  function updateProgress() {
    const pill = document.querySelector(".topbar .pill");
    if (!pill) return;
    const store = resultsMode ? state.results : state.predictions;
    const filled = WC.MATCHES.filter((m) => WC.isFilled(store[m.id])).length;
    pill.textContent = `${filled}/${WC.MATCHES.length}`;
  }

  /* ---------------- Partage / import ---------------- */
  function shareLink() {
    const base = location.href.split("#")[0];
    return base + "#p=" + WC.encodePlayer(me());
  }
  async function shareMe() {
    const text = `Mes pronos CM 2026 — ${state.me.name || "joueur"}. Rejoins la ligue 👉`;
    const url = shareLink();
    if (navigator.share) {
      try {
        await navigator.share({ title: "Pronos CM 2026", text, url });
        return;
      } catch (e) {}
    }
    copy(url);
    toast("Lien copié");
  }
  function copy(txt) {
    if (navigator.clipboard) navigator.clipboard.writeText(txt).catch(() => fallbackCopy(txt));
    else fallbackCopy(txt);
  }
  function fallbackCopy(txt) {
    const ta = document.createElement("textarea");
    ta.value = txt;
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand("copy"); } catch (e) {}
    ta.remove();
  }

  function addPlayer(player) {
    const myName = (state.me.name || "Moi").toLowerCase();
    if (player.name.toLowerCase() === myName) {
      toast("C'est toi !");
      return false;
    }
    const idx = state.league.findIndex((p) => p.name.toLowerCase() === player.name.toLowerCase());
    if (idx >= 0) state.league[idx] = player;
    else state.league.push(player);
    save();
    return true;
  }

  function importColleague() {
    const ta = document.getElementById("importCode");
    const code = (ta.value || "").trim();
    if (!code) return toast("Colle d'abord un code");
    try {
      const player = WC.decodePlayer(code);
      if (addPlayer(player)) {
        toast(`${player.name} ajouté`);
        render();
      }
    } catch (e) {
      toast("Code invalide");
    }
  }

  function exportLeague() {
    const data = JSON.stringify({ v: 1, league: state.league }, null, 2);
    const blob = new Blob([data], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "ligue-cm2026.json";
    a.click();
    URL.revokeObjectURL(a.href);
  }

  /* ---------------- Modale règles ---------------- */
  function openRules() {
    const m = document.createElement("div");
    m.className = "modal";
    m.innerHTML = `
      <div class="modal-card">
        <button class="modal-x" data-close aria-label="fermer">${WC.icon("x", 16)}</button>
        <h2 class="card-head">${WC.icon("book", 20)} Règles du jeu</h2>
        <h3>Barème par match</h3>
        <ul class="rules">
          <li><b>${WC.POINTS.exact} pts</b> — Score exact (ex : tu mets 2-1, résultat 2-1)</li>
          <li><b>${WC.POINTS.diff} pts</b> — Bon vainqueur + bonne différence de buts</li>
          <li><b>${WC.POINTS.outcome} pt</b> — Bon résultat (vainqueur ou nul) seulement</li>
          <li><b>0 pt</b> — Mauvais pronostic</li>
        </ul>
        <h3>Tableau final (phases finales)</h3>
        <ul class="rules">
          <li><b>+${WC.KO_POINTS.r32}</b> — par équipe correctement qualifiée en 8es</li>
          <li><b>+${WC.KO_POINTS.r16}</b> — par équipe en quarts de finale</li>
          <li><b>+${WC.KO_POINTS.qf}</b> — par équipe en demi-finales</li>
          <li><b>+${WC.KO_POINTS.sf}</b> — par finaliste</li>
          <li><b>+${WC.THIRD_POINTS}</b> — bonne 3e place (petite finale)</li>
          <li><b>+${WC.KO_POINTS.final}</b> — pour le champion du monde</li>
        </ul>
        <p class="hint">Le tableau est noté par équipe : peu importe la position exacte, tu marques dès qu'une équipe que tu as fait avancer atteint réellement le tour. Astuce : le bouton « Pré-remplir les 16es » place automatiquement les qualifiés calculés depuis tes pronos de groupes — tu peux ensuite tout ajuster.</p>
        <h3>Bonus (fin de tournoi)</h3>
        <ul class="rules">
          ${WC.BONUS.map((b) => `<li><b>+${b.points}</b> — ${b.label}</li>`).join("")}
        </ul>
        <h3>Comment jouer entre collègues ?</h3>
        <ol class="rules">
          <li>Chacun remplit ses pronos et <b>partage son lien/code</b>.</li>
          <li>L'organisateur ajoute chaque code dans l'onglet <b>Ligue</b>.</li>
          <li>Au fil des matchs, l'organisateur saisit les <b>résultats</b>.</li>
          <li>Le <b>classement</b> se met à jour automatiquement.</li>
        </ol>
        <p class="hint">Astuce : l'écran de saisie se trie par groupe ou par date. Les résultats peuvent être synchronisés via une API (onglet Résultats), et le tableau final s'alimente tout seul depuis la phase de groupes.</p>
      </div>`;
    m.addEventListener("click", (e) => {
      if (e.target === m || e.target.hasAttribute("data-close")) m.remove();
    });
    document.body.appendChild(m);
  }

  /* ---------------- Import depuis l'URL (#p=...) ---------------- */
  function checkUrlImport() {
    const h = location.hash;
    const mtch = h.match(/p=([^&]+)/);
    if (!mtch) return;
    try {
      const player = WC.decodePlayer(decodeURIComponent(mtch[1]));
      history.replaceState(null, "", location.pathname + location.search);
      if (confirm(`Ajouter les pronos de « ${player.name} » à ta ligue ?`)) {
        if (addPlayer(player)) toast(`${player.name} ajouté`);
        view = "league";
      }
    } catch (e) {
      /* ignore */
    }
  }

  /* ---------------- Synchronisation API des résultats ---------------- */
  async function doApiSync() {
    const cfg = state.apiCfg || WC.api.defaults();
    toast("Synchronisation…");
    try {
      const res = await WC.api.sync(cfg, state);
      cfg.lastSync = new Date().toLocaleString("fr-FR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
      state.apiCfg = cfg;
      save();
      toast(`${res.finished} match(s) de poule · ${res.ko} en phase finale`);
      render();
    } catch (e) {
      console.warn(e);
      alert("Échec de la synchronisation : " + (e && e.message ? e.message : e) + "\n\nVérifie les Réglages API (fournisseur, clé, identifiant de compétition, saison) et ta connexion.");
    }
  }

  function openApiSettings() {
    const cfg = Object.assign(WC.api.defaults(), state.apiCfg || {});
    const m = document.createElement("div");
    m.className = "modal";
    m.innerHTML = `
      <div class="modal-card">
        <button class="modal-x" data-close aria-label="fermer">${WC.icon("x", 16)}</button>
        <h2 class="card-head">${WC.icon("download", 20)} Réglages API (résultats)</h2>
        <p class="hint">Synchronise automatiquement les scores réels depuis une API de football. Par défaut : TheSportsDB (gratuit, compatible navigateur).</p>
        <label class="field-lab">Fournisseur</label>
        <select class="input" data-cfg="provider">
          <option value="thesportsdb" ${cfg.provider === "thesportsdb" ? "selected" : ""}>TheSportsDB (gratuit)</option>
        </select>
        <label class="field-lab">Clé API</label>
        <input class="input" data-cfg="key" value="${esc(cfg.key)}" placeholder="123" />
        <label class="field-lab">Identifiant de compétition (idLeague)</label>
        <input class="input" data-cfg="league" value="${esc(cfg.league)}" />
        <label class="field-lab">Saison</label>
        <input class="input" data-cfg="season" value="${esc(cfg.season)}" />
        <button class="btn btn-primary full" data-cfg-save>Enregistrer</button>
        <button class="btn btn-ghost full" data-cfg-test>Tester la connexion</button>
        <p class="hint">L'app associe les matchs par nom d'équipe et met aussi à jour dates et villes. Les scores des matchs terminés alimentent le classement.</p>
      </div>`;
    m.addEventListener("click", async (e) => {
      if (e.target === m || e.target.hasAttribute("data-close")) return m.remove();
      const read = () => {
        m.querySelectorAll("[data-cfg]").forEach((el) => (cfg[el.dataset.cfg] = el.value.trim()));
        return cfg;
      };
      if (e.target.hasAttribute("data-cfg-save")) {
        state.apiCfg = read();
        save();
        toast("Réglages enregistrés");
        m.remove();
        render();
      } else if (e.target.hasAttribute("data-cfg-test")) {
        read();
        e.target.textContent = "Test en cours…";
        try {
          const n = await WC.api.test(cfg);
          alert(`Connexion OK : ${n} matchs trouvés pour la compétition/saison.`);
        } catch (err) {
          alert("Échec : " + (err && err.message ? err.message : err));
        }
        e.target.textContent = "Tester la connexion";
      }
    });
    document.body.appendChild(m);
  }

  /* ---------------- Démarrage ---------------- */
  ensureDefaults();
  save();
  checkUrlImport();
  render();
})();
