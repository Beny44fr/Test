/* =====================================================================
   Pronos CM 2026 — Application (vanilla JS)
   ===================================================================== */
(function () {
  const WC = window.WC;
  let state = WC.store.load();
  let view = "home";
  let filterGroup = "A";
  let viewBy = "date"; // "group" | "date" : tri de l'écran de saisie (par date par défaut)
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

  // Date / heure / ville effectives (surchargées par l'API si dispo)
  const effDate = (m) => (state.schedule[m.id] && state.schedule[m.id].date) || m.date;
  const effTime = (m) => (state.schedule[m.id] && state.schedule[m.id].time) || m.time || "";
  const effCity = (m) => state.schedule[m.id] && state.schedule[m.id].city;
  const uniqueDates = () => [...new Set(WC.MATCHES.map(effDate))].sort();
  const todayStr = () => {
    const n = new Date();
    return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, "0")}-${String(n.getDate()).padStart(2, "0")}`;
  };

  // Instant de coup d'envoi d'un match (timestamp API prioritaire, sinon date+heure locale)
  function matchStart(m) {
    const sc = state.schedule[m.id] || {};
    if (sc.ts) return new Date(sc.ts).getTime();
    return new Date(`${effDate(m)}T${(effTime(m) || "12:00")}:00`).getTime();
  }
  const matchStarted = (m) => Date.now() >= matchStart(m);
  const compStarted = () => Date.now() >= KICKOFF.getTime();

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
    // Centre la puce active (utile en mode "par date" sur la date à venir)
    const active = app.querySelector(".chips .chip.active");
    if (active && active.scrollIntoView) active.scrollIntoView({ inline: "center", block: "nearest" });
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
        <div class="btn-group">
          <button class="btn btn-ghost" data-act="goBracket">${WC.icon("trophy", 16)} Tableau final</button>
          <button class="btn btn-ghost" data-act="goScorer">${WC.icon("boot", 16)} Buteur</button>
        </div>
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
      <div class="subtabs subtabs-3">
        <button class="subtab ${predictPhase === "groups" ? "active" : ""}" data-phase="groups">${WC.icon("ball", 16)} Groupes</button>
        <button class="subtab ${predictPhase === "bracket" ? "active" : ""}" data-phase="bracket">${WC.icon("trophy", 16)} Tableau</button>
        <button class="subtab ${predictPhase === "scorer" ? "active" : ""}" data-phase="scorer">${WC.icon("boot", 16)} Buteur</button>
      </div>`;

    const head = `
      <header class="topbar">
        <h2>${resultsMode ? "Saisie des résultats" : "Mes pronostics"}</h2>
      </header>
      ${resultsMode ? `<p class="banner">Mode organisateur — saisis ici les vrais résultats pour calculer le classement.</p>` : ""}
      ${subTabs}`;

    if (predictPhase === "bracket") return head + bracketView(resultsMode);
    if (predictPhase === "scorer") return head + scorerView(resultsMode);

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
      const today = todayStr();
      // Par défaut : première date à venir (>= aujourd'hui), sinon la dernière
      if (!filterDate || !dates.includes(filterDate)) {
        filterDate = dates.find((d) => d >= today) || dates[dates.length - 1];
      }
      chips = dates
        .map(
          (d) =>
            `<button class="chip chip-wide ${d === filterDate ? "active" : ""} ${d < today ? "past" : ""}" data-date="${d}">${fmtChip(d)}</button>`
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
      ${resultsMode ? "" : `<button class="btn btn-primary full" data-act="share">${WC.icon("share", 18)} Partager mes pronos</button>`}
    `;
  };

  /* ---------------- Sous-onglet Meilleur buteur ---------------- */
  function scorerView(isResults) {
    const ds = isResults ? "bonusResult" : "bonus";
    const store = isResults ? state.bonusResults : state.bonus;
    const val = store.topScorer || "";
    const labels = WC.TOP_SCORER_LABELS;
    const inList = labels.includes(val);
    const other = scorerOther[ds] || (!!val && !inList);
    const bonusPts = (WC.BONUS.find((b) => b.id === "topScorer") || {}).points || 10;
    const locked = !isResults && compStarted();

    // Verrou : la compétition a commencé → pronostic de buteur figé
    if (locked) {
      return `
        <section class="card lock-card">
          <strong class="card-head">${WC.icon("lock", 18)} Buteur verrouillé</strong>
          <p class="hint">La compétition a commencé : ton pronostic de meilleur buteur est désormais figé.</p>
          <div class="lock-val">${val ? esc(val) : "Aucun buteur pronostiqué"}</div>
        </section>`;
    }

    const cards = WC.TOP_SCORERS.map((p) => {
      const label = WC.scorerLabel(p);
      const t = WC.TEAM_BY_NAME[p.team];
      const sel = !other && val === label;
      return `
        <button class="scorer-card ${sel ? "sel" : ""}" data-act="pickScorer" data-store="${ds}" data-label="${esc(label)}">
          <span class="sc-flag">${t ? WC.flag(t.code) : ""}</span>
          <span class="sc-txt"><span class="sc-name">${esc(p.name)}</span><span class="sc-team">${esc(p.team)}</span></span>
          <span class="sc-check">${sel ? WC.icon("check", 16) : ""}</span>
        </button>`;
    }).join("");

    const otherCard = `
      <button class="scorer-card ${other ? "sel" : ""}" data-act="pickScorerOther" data-store="${ds}">
        <span class="sc-flag">${WC.icon("user", 18)}</span>
        <span class="sc-txt"><span class="sc-name">Autre joueur</span><span class="sc-team">Saisie libre</span></span>
        <span class="sc-check">${other ? WC.icon("check", 16) : ""}</span>
      </button>`;

    const otherInput = other
      ? `<input class="input scorer-other" data-scorer-text data-store="${ds}" maxlength="40" placeholder="Nom du buteur…" value="${esc(val)}" />`
      : "";

    return `
      <div class="phase-meta"><span class="pill">${isResults ? "Buteur réel" : "+" + bonusPts + " pts"}</span></div>
      <p class="hint sc-hint">${isResults ? "Désigne le meilleur buteur réel du tournoi pour attribuer les points." : "Qui finira meilleur buteur de la Coupe du Monde ? Choisis un favori (ou saisis un autre joueur)."}</p>
      <div class="scorer-grid">${cards}${otherCard}</div>
      ${otherInput}
      ${isResults ? "" : `<button class="btn btn-primary full" data-act="share">${WC.icon("share", 18)} Partager mes pronos</button>`}
    `;
  }

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
    const locked = !resultsMode && matchStarted(m); // pronos figés une fois le match commencé

    const teamRow = (team, side) => {
      const filled = Number.isInteger(v[side]);
      const val = filled ? v[side] : "";
      const score = locked
        ? `<span class="score-ro">${filled ? v[side] : "–"}</span>`
        : `<div class="stepper">
            ${
              filled && v[side] >= 1
                ? `<button class="step" data-act="dec" data-mid="${m.id}" data-side="${side}" data-store="${ds}" aria-label="moins">${WC.icon("minus", 16)}</button>`
                : `<button class="step step-zero" data-act="setzero" data-mid="${m.id}" data-side="${side}" data-store="${ds}" aria-label="zéro">0</button>`
            }
            <input class="score" inputmode="numeric" maxlength="2" data-mid="${m.id}" data-side="${side}" data-store="${ds}" value="${val}" />
            <button class="step" data-act="inc" data-mid="${m.id}" data-side="${side}" data-store="${ds}" aria-label="plus">${WC.icon("plus", 16)}</button>
          </div>`;
      return `
        <div class="m-team">
          ${WC.flag(team.code)}
          <span class="tname">${esc(team.name)}</span>
          ${score}
        </div>`;
    };

    const done = WC.isFilled(v);
    const city = effCity(m);
    const time = effTime(m);
    const past = matchStarted(m);
    const meta = `Groupe ${m.group} · J${m.matchday} · ${fmtDate(effDate(m))}${time ? ` · ${time}` : ""}${city ? ` · ${esc(city)}` : ""}`;
    return `
      <div class="match ${done ? "done" : ""} ${locked ? "locked" : ""}" data-id="${m.id}">
        <div class="match-meta ${past ? "meta-past" : ""}">${meta}${locked ? ` <span class="lock-tag">${WC.icon("lock", 12)} commencé</span>` : ""}</div>
        ${teamRow(m.home, "h")}
        ${teamRow(m.away, "a")}
      </div>`;
  }

  function scorerField(val, ds) {
    const labels = WC.TOP_SCORER_LABELS;
    const inList = labels.includes(val);
    const other = scorerOther[ds] || (!!val && !inList);
    const opts =
      `<option value="" ${!val && !other ? "selected" : ""}>— choisir —</option>` +
      labels.map((l) => `<option value="${esc(l)}" ${inList && val === l ? "selected" : ""}>${esc(l)}</option>`).join("") +
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
    // Pronostic figé une fois le match commencé (la saisie des résultats reste possible)
    if (store !== "result") {
      const m = WC.MATCHES.find((x) => x.id === mid);
      if (m && matchStarted(m)) return;
    }
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
    if (act === "goScorer") {
      resultsMode = false;
      predictPhase = "scorer";
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
      if (confirm("Réinitialiser tous TES pronostics (scores vidés, buteur et tableau final remis à zéro) ? Le classement et les résultats ne sont pas touchés.")) {
        state.predictions = {};
        state.bonus = {};
        state.bracket = WC.store.emptyBracket();
        save();
        toast("Pronostics réinitialisés");
        render();
      }
      return;
    }
    if (act === "inc" || act === "dec" || act === "setzero") {
      const { mid, side, store } = b.dataset;
      const cur = (store === "result" ? state.results : state.predictions)[mid] || {};
      const base = Number.isInteger(cur[side]) ? cur[side] : 0;
      let n = act === "inc" ? Math.min(99, base + 1) : act === "dec" ? Math.max(0, base - 1) : 0;
      setScore(store, mid, side, n);
      refreshMatch(mid);
      updateProgress();
    } else if (act === "pickScorer") {
      const ds = b.dataset.store || "bonus";
      const t = ds === "bonusResult" ? state.bonusResults : state.bonus;
      scorerOther[ds] = false;
      t.topScorer = b.dataset.label;
      save();
      render();
    } else if (act === "pickScorerOther") {
      const ds = b.dataset.store || "bonus";
      const t = ds === "bonusResult" ? state.bonusResults : state.bonus;
      scorerOther[ds] = true;
      if (WC.TOP_SCORER_LABELS.includes(t.topScorer)) t.topScorer = "";
      save();
      render();
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

  // Remplace une seule carte de match (met à jour le stepper sans recharger la page)
  function refreshMatch(mid) {
    const el = document.querySelector(`.match[data-id="${mid}"]`);
    if (!el) return;
    const m = WC.MATCHES.find((x) => x.id === mid);
    const store = resultsMode ? state.results : state.predictions;
    el.outerHTML = matchCard(m, store);
  }

  function updateProgress() {
    const pill = document.querySelector(".phase-meta .pill");
    if (!pill) return;
    const store = resultsMode ? state.results : state.predictions;
    const filled = WC.MATCHES.filter((m) => WC.isFilled(store[m.id])).length;
    pill.textContent = `${filled}/${WC.MATCHES.length} matchs`;
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
        <p class="hint">Le tableau est noté par équipe : peu importe la position exacte, tu marques dès qu'une équipe que tu as fait avancer atteint réellement le tour. Les 16es se remplissent automatiquement depuis tes pronos de groupes — tu n'as plus qu'à faire avancer les équipes.</p>
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

  /* ---------------- Onboarding (premier lancement) ---------------- */
  function openOnboarding() {
    const m = document.createElement("div");
    m.className = "modal onb";
    m.innerHTML = `
      <div class="modal-card onb-card">
        <div class="onb-logo">Pronos<span>26</span></div>
        <p class="onb-tag">Bienvenue ! Crée tes pronos et défie tes collègues sur la Coupe du Monde 2026.</p>
        <div class="onb-steps">
          <div class="onb-step"><span class="onb-ic">${WC.icon("ball", 20)}</span><div><b>Pronostique</b><span>Score de chaque match + ton tableau final et ton buteur.</span></div></div>
          <div class="onb-step"><span class="onb-ic">${WC.icon("share", 20)}</span><div><b>Partage ton code</b><span>Envoie ton lien à l'organisateur pour rejoindre la ligue.</span></div></div>
          <div class="onb-step"><span class="onb-ic">${WC.icon("trophy", 20)}</span><div><b>Grimpe au classement</b><span>Les points se calculent automatiquement au fil des matchs.</span></div></div>
        </div>
        <label class="field-lab" for="onbName">Ton nom de joueur</label>
        <input id="onbName" class="input" maxlength="24" placeholder="Ex : Benjamin" value="${esc(state.me.name || "")}" data-onb-name />
        <button class="btn btn-primary full" data-onb-start>C'est parti ${WC.icon("arrowRight", 18)}</button>
        <p class="hint onb-foot">${WC.icon("check", 13)} Tes pronos sont enregistrés automatiquement sur cet appareil.</p>
      </div>`;
    m.addEventListener("click", (e) => {
      if (e.target.closest("[data-onb-start]")) {
        const inp = m.querySelector("[data-onb-name]");
        const n = (inp.value || "").trim();
        if (n) state.me.name = n.slice(0, 24);
        state.onboarded = true;
        save();
        m.remove();
        render();
      }
    });
    m.addEventListener("input", (e) => {
      if (e.target.hasAttribute("data-onb-name")) {
        state.me.name = e.target.value.slice(0, 24);
        save();
      }
    });
    document.body.appendChild(m);
    setTimeout(() => { const i = m.querySelector("[data-onb-name]"); if (i) i.focus(); }, 50);
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
  checkUrlImport();
  render();
  if (!state.onboarded) openOnboarding();
})();
