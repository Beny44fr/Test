/* =====================================================================
   Logique de calcul des points
   ===================================================================== */
(function () {
  const WC = (window.WC = window.WC || {});
  const P = WC.POINTS;

  // Un pronostic est valide si les deux scores sont des entiers >= 0
  WC.isFilled = (s) =>
    s && Number.isInteger(s.h) && Number.isInteger(s.a) && s.h >= 0 && s.a >= 0;

  /**
   * Compare un pronostic à un résultat réel.
   * @returns {points:number, kind:'exact'|'diff'|'outcome'|'miss'|null}
   */
  WC.scoreMatch = function (pred, actual) {
    if (!WC.isFilled(pred) || !WC.isFilled(actual)) return { points: 0, kind: null };

    if (pred.h === actual.h && pred.a === actual.a) return { points: P.exact, kind: "exact" };

    const po = Math.sign(pred.h - pred.a);
    const ao = Math.sign(actual.h - actual.a);
    if (po !== ao) return { points: 0, kind: "miss" };

    // Même issue (victoire dom / nul / victoire ext)
    if (pred.h - pred.a === actual.h - actual.a) return { points: P.diff, kind: "diff" };
    return { points: P.outcome, kind: "outcome" };
  };

  /**
   * Points du tableau final : pour chaque tour, +KO_POINTS par vainqueur
   * correctement pronostiqué (comparaison ensembliste, indépendante de la
   * position dans le tableau).
   */
  WC.knockoutPoints = function (playerBracket, resultBracket) {
    if (!playerBracket || !resultBracket || !resultBracket.win) return 0;
    let pts = 0;
    WC.KO_ROUNDS.forEach((r) => {
      const real = (resultBracket.win[r.key] || []).filter(Boolean).map(norm);
      if (!real.length) return;
      const realSet = new Set(real);
      const mine = (playerBracket.win && playerBracket.win[r.key]) || [];
      const counted = new Set();
      mine.filter(Boolean).forEach((t) => {
        const n = norm(t);
        if (realSet.has(n) && !counted.has(n)) {
          counted.add(n);
          pts += WC.KO_POINTS[r.key];
        }
      });
    });
    // Petite finale (3e place)
    const realThird = (resultBracket.win.third || [])[0];
    const myThird = playerBracket.win && (playerBracket.win.third || [])[0];
    if (realThird && myThird && norm(realThird) === norm(myThird)) pts += WC.THIRD_POINTS;
    return pts;
  };

  /**
   * Classement de chaque groupe à partir d'un jeu de pronostics (ou résultats).
   * Tri : points > diff. de buts > buts marqués > ordre alphabétique.
   */
  WC.groupStandings = function (preds) {
    return WC.GROUPS.map((g) => {
      const stats = {};
      g.teams.forEach((t) => (stats[t.name] = { team: t, pts: 0, gf: 0, ga: 0, gd: 0, played: 0 }));
      WC.MATCHES.filter((m) => m.group === g.letter).forEach((m) => {
        const p = preds[m.id];
        if (!WC.isFilled(p)) return;
        const H = stats[m.home.name];
        const A = stats[m.away.name];
        H.gf += p.h; H.ga += p.a; A.gf += p.a; A.ga += p.h; H.played++; A.played++;
        if (p.h > p.a) H.pts += 3;
        else if (p.h < p.a) A.pts += 3;
        else { H.pts++; A.pts++; }
      });
      const table = Object.values(stats).map((s) => ((s.gd = s.gf - s.ga), s));
      table.sort((a, b) => b.pts - a.pts || b.gd - a.gd || b.gf - a.gf || a.team.name.localeCompare(b.team.name));
      return { letter: g.letter, table };
    });
  };

  /**
   * Qualifiés pour les 16es : 1ers, 2es de chaque groupe + 8 meilleurs 3es.
   */
  WC.qualifiers = function (preds) {
    const st = WC.groupStandings(preds);
    const winners = [], runners = [], thirdsAll = [];
    st.forEach((g) => {
      winners.push(g.table[0].team);
      runners.push(g.table[1].team);
      thirdsAll.push(g.table[2]);
    });
    thirdsAll.sort((a, b) => b.pts - a.pts || b.gd - a.gd || b.gf - a.gf || a.team.name.localeCompare(b.team.name));
    const thirds = thirdsAll.slice(0, 8).map((s) => s.team);
    const complete = WC.MATCHES.every((m) => WC.isFilled(preds[m.id]));
    return { winners, runners, thirds, complete };
  };

  /**
   * Total des points d'un joueur.
   * player = { name, predictions:{id:{h,a}}, bonus:{topScorer}, bracket:{...} }
   */
  WC.totalPoints = function (player, results, bonusResults, bracketResults) {
    let matchPts = 0,
      exact = 0,
      good = 0,
      played = 0;

    WC.MATCHES.forEach((m) => {
      const r = results[m.id];
      if (!WC.isFilled(r)) return;
      played++;
      const res = WC.scoreMatch(player.predictions[m.id], r);
      matchPts += res.points;
      if (res.kind === "exact") exact++;
      if (res.points > 0) good++;
    });

    let bonusPts = 0;
    WC.BONUS.forEach((b) => {
      const truth = (bonusResults || {})[b.id];
      const guess = (player.bonus || {})[b.id];
      if (truth && guess && norm(truth) === norm(guess)) bonusPts += b.points;
    });

    const koPts = WC.knockoutPoints(player.bracket, bracketResults);

    return {
      total: matchPts + bonusPts + koPts,
      matchPts,
      bonusPts,
      koPts,
      exact,
      good,
      played,
    };
  };

  function norm(s) {
    return String(s).trim().toLowerCase();
  }
})();
