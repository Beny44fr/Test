/* =====================================================================
   Synchronisation des résultats via une API de football.
   Fournisseur par défaut : TheSportsDB (gratuit, compatible navigateur).
   - Récupère les matchs de la compétition/saison
   - Met à jour les scores (matchs terminés), les dates et les villes
   - Associe les matchs par nom d'équipe (FR / EN + alias)
   ===================================================================== */
(function () {
  const WC = (window.WC = window.WC || {});

  WC.api = {
    defaults() {
      // idLeague TheSportsDB pour la Coupe du Monde + saison.
      // Ajustable dans les Réglages API si nécessaire.
      return { provider: "thesportsdb", key: "123", league: "4429", season: "2026", lastSync: null };
    },

    // Teste la connexion : renvoie le nombre de matchs trouvés
    async test(cfg) {
      const events = await fetchEvents(cfg);
      return events.length;
    },

    // Synchronise les résultats dans state ; renvoie {updated, finished, ko}
    async sync(cfg, state) {
      const events = await fetchEvents(cfg);
      const index = buildNameIndex();
      let updated = 0,
        finished = 0,
        ko = 0;

      // Accumulateurs pour le tableau final (vainqueurs réels par tour)
      const koWin = { r32: [], r16: [], qf: [], sf: [], final: [], third: [] };
      const r32teams = [];

      events.forEach((ev) => {
        const home = index[norm(ev.strHomeTeam)];
        const away = index[norm(ev.strAwayTeam)];
        if (!home || !away) return;
        const h = toInt(ev.intHomeScore);
        const a = toInt(ev.intAwayScore);
        const round = koRoundOf(ev);

        if (round) {
          // Match à élimination directe
          if (round === "r32") r32teams.push(home.name, away.name);
          if (h != null && a != null && h !== a) {
            const w = h > a ? home : away;
            if (koWin[round].indexOf(w.name) < 0) koWin[round].push(w.name);
            ko++;
          }
          return;
        }

        // Match de poule : on l'associe à l'un de nos 72 matchs
        const match = findGroupMatch(home, away);
        if (!match) return;
        const date = (ev.dateEvent || "").slice(0, 10);
        const city = ev.strCity || ev.strVenue || "";
        const time = (ev.strTime || "").slice(0, 5);
        const ts = ev.strTimestamp || ev.strTimestampUtc || "";
        if (date || city || time || ts) {
          state.schedule[match.id] = Object.assign(
            {},
            state.schedule[match.id],
            date ? { date } : {},
            city ? { city } : {},
            time ? { time } : {},
            ts ? { ts } : {}
          );
          updated++;
        }
        if (h != null && a != null) {
          const sameOrder = home.name === match.home.name;
          state.results[match.id] = sameOrder ? { h, a } : { h: a, a: h };
          finished++;
        }
      });

      // Applique le tableau final réel (n'écrase que les tours réellement reçus)
      if (!state.bracketResults || !state.bracketResults.win) state.bracketResults = WC.store.emptyBracket();
      Object.keys(koWin).forEach((k) => {
        if (koWin[k].length) state.bracketResults.win[k] = koWin[k];
      });
      if (r32teams.length) state.bracketResults.teams = r32teams;
      if (r32teams.length || Object.values(koWin).some((arr) => arr.length)) state.bracketResults.source = "api";

      return { updated, finished, ko };
    },
  };

  // Classe un match dans un tour à élimination directe (ou null si poule)
  function koRoundOf(ev) {
    const s = norm((ev.strStage || "") + " " + (ev.strRound || ""));
    if (!s) return null;
    if (/(thirdplace|3rdplace|playoffforthird)/.test(s)) return "third";
    if (/final/.test(s) && !/semifinal|quarterfinal/.test(s)) return "final";
    if (/semifinal|semi/.test(s)) return "sf";
    if (/quarterfinal|quarter/.test(s)) return "qf";
    if (/roundof16|lastof16|(^|[^0-9])16([^0-9]|$)/.test(s)) return "r16";
    if (/roundof32|lastof32|(^|[^0-9])32([^0-9]|$)/.test(s)) return "r32";
    return null;
  }

  /* ---------------- Récupération brute ---------------- */
  async function fetchEvents(cfg) {
    if (cfg.provider !== "thesportsdb") throw new Error("Fournisseur non supporté : " + cfg.provider);
    const key = encodeURIComponent(cfg.key || "123");
    const url = `https://www.thesportsdb.com/api/v1/json/${key}/eventsseason.php?id=${encodeURIComponent(cfg.league)}&s=${encodeURIComponent(cfg.season)}`;
    const r = await fetch(url, { headers: { Accept: "application/json" } });
    if (!r.ok) throw new Error("HTTP " + r.status);
    const data = await r.json();
    return (data && data.events) || [];
  }

  /* ---------------- Association des équipes ---------------- */
  function norm(s) {
    return String(s || "")
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "");
  }

  // Alias supplémentaires (variantes de noms côté API), par code pays
  const ALIAS = {
    kr: ["korearepublic", "republicofkorea", "skorea"],
    us: ["usa", "unitedstatesofamerica"],
    tr: ["turkiye"],
    cz: ["czechrepublic"],
    ci: ["cotedivoire"],
    cv: ["caboverde"],
    ir: ["iriran"],
    cd: ["congodr", "drcongo", "democraticrepublicofthecongo", "congodemocraticrepublic"],
    cw: ["curacao"],
    ba: ["bosnia", "bosniaherzegovina"],
    sa: ["ksa"],
  };

  function buildNameIndex() {
    const idx = {};
    WC.TEAMS.forEach((t) => {
      [t.name, t.en].forEach((n) => (idx[norm(n)] = t));
      (ALIAS[t.code] || []).forEach((a) => (idx[norm(a)] = t));
    });
    return idx;
  }

  // Trouve le match de poule opposant ces deux équipes (quel que soit l'ordre)
  function findGroupMatch(teamX, teamY) {
    return WC.MATCHES.find(
      (m) =>
        (m.home.name === teamX.name && m.away.name === teamY.name) ||
        (m.home.name === teamY.name && m.away.name === teamX.name)
    );
  }

  function sameTeam(apiName, teamObj, index) {
    const t = index[norm(apiName)];
    return t && t.name === teamObj.name;
  }

  function toInt(v) {
    if (v === null || v === undefined || v === "") return null;
    const n = parseInt(v, 10);
    return isNaN(n) ? null : n;
  }
})();
