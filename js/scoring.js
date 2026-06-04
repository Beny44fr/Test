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
    return pts;
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
