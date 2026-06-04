/* =====================================================================
   Coupe du Monde 2026 — Données (groupes, équipes, calendrier)
   ---------------------------------------------------------------------
   Tirage officiel du 5 décembre 2025 (Washington D.C.).
   Les confrontations de poule sont déterminées par le tirage.
   ⚠️ Les DATES sont indicatives et facilement modifiables ci-dessous
      (phase de groupes : 11 → 27 juin 2026).
   ===================================================================== */
(function () {
  const WC = (window.WC = window.WC || {});

  const t = (name, code) => ({ name, code });

  // 12 groupes de 4 équipes (code = drapeau image, cf. icons.js)
  WC.GROUPS = [
    { letter: "A", teams: [t("Mexique","mx"), t("Afrique du Sud","za"), t("Corée du Sud","kr"), t("Tchéquie","cz")] },
    { letter: "B", teams: [t("Canada","ca"), t("Bosnie-Herzégovine","ba"), t("Qatar","qa"), t("Suisse","ch")] },
    { letter: "C", teams: [t("Brésil","br"), t("Maroc","ma"), t("Haïti","ht"), t("Écosse","gb-sct")] },
    { letter: "D", teams: [t("États-Unis","us"), t("Paraguay","py"), t("Australie","au"), t("Turquie","tr")] },
    { letter: "E", teams: [t("Allemagne","de"), t("Curaçao","cw"), t("Côte d'Ivoire","ci"), t("Équateur","ec")] },
    { letter: "F", teams: [t("Pays-Bas","nl"), t("Japon","jp"), t("Suède","se"), t("Tunisie","tn")] },
    { letter: "G", teams: [t("Belgique","be"), t("Égypte","eg"), t("Iran","ir"), t("Nouvelle-Zélande","nz")] },
    { letter: "H", teams: [t("Espagne","es"), t("Cap-Vert","cv"), t("Arabie saoudite","sa"), t("Uruguay","uy")] },
    { letter: "I", teams: [t("France","fr"), t("Sénégal","sn"), t("Irak","iq"), t("Norvège","no")] },
    { letter: "J", teams: [t("Argentine","ar"), t("Algérie","dz"), t("Autriche","at"), t("Jordanie","jo")] },
    { letter: "K", teams: [t("Portugal","pt"), t("RD Congo","cd"), t("Ouzbékistan","uz"), t("Colombie","co")] },
    { letter: "L", teams: [t("Angleterre","gb-eng"), t("Croatie","hr"), t("Ghana","gh"), t("Panama","pa")] },
  ];

  // Liste à plat des équipes (pour les pronos bonus : buteur…)
  WC.TEAMS = WC.GROUPS.flatMap((g) => g.teams);
  WC.TEAM_BY_NAME = Object.fromEntries(WC.TEAMS.map((t) => [t.name, t]));

  // Dates indicatives par groupe : [matchday1, matchday2, matchday3]
  const DATES = {
    A: ["2026-06-11", "2026-06-18", "2026-06-24"],
    B: ["2026-06-11", "2026-06-18", "2026-06-24"],
    C: ["2026-06-12", "2026-06-18", "2026-06-24"],
    D: ["2026-06-12", "2026-06-19", "2026-06-25"],
    E: ["2026-06-13", "2026-06-19", "2026-06-25"],
    F: ["2026-06-13", "2026-06-20", "2026-06-25"],
    G: ["2026-06-14", "2026-06-20", "2026-06-26"],
    H: ["2026-06-14", "2026-06-21", "2026-06-26"],
    I: ["2026-06-15", "2026-06-21", "2026-06-26"],
    J: ["2026-06-15", "2026-06-22", "2026-06-27"],
    K: ["2026-06-16", "2026-06-22", "2026-06-27"],
    L: ["2026-06-17", "2026-06-23", "2026-06-27"],
  };

  // Schéma round-robin (indices d'équipes) par journée
  const SCHEDULE = [
    [[0, 1], [2, 3]], // J1
    [[0, 2], [3, 1]], // J2
    [[3, 0], [1, 2]], // J3 (dernière journée : matchs simultanés)
  ];

  // Génération des 72 matchs de poule
  const MATCHES = [];
  WC.GROUPS.forEach((g) => {
    SCHEDULE.forEach((pairs, mi) => {
      pairs.forEach((p, pi) => {
        MATCHES.push({
          id: `${g.letter}-${mi + 1}-${pi + 1}`,
          group: g.letter,
          matchday: mi + 1,
          home: g.teams[p[0]],
          away: g.teams[p[1]],
          date: DATES[g.letter][mi],
        });
      });
    });
  });
  // Tri chronologique puis par groupe
  MATCHES.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : a.group.localeCompare(b.group)));
  WC.MATCHES = MATCHES;

  // Question bonus (le vainqueur / les finalistes sont désormais couverts
  // par le tableau final). Résolue par l'organisateur en fin de tournoi.
  WC.BONUS = [
    { id: "topScorer", label: "Meilleur buteur du tournoi", points: 10, type: "text", icon: "boot" },
  ];

  // Phases finales (tableau à élimination directe)
  // Round of 32 → Finale. Les 2 premiers de chaque groupe + 8 meilleurs 3es.
  WC.KO_ROUNDS = [
    { key: "r32", label: "16es", short: "16es", n: 16, prev: null }, // 32 équipes → 16 matchs
    { key: "r16", label: "8es de finale", short: "8es", n: 8, prev: "r32" },
    { key: "qf", label: "Quarts de finale", short: "Quarts", n: 4, prev: "r16" },
    { key: "sf", label: "Demi-finales", short: "Demis", n: 2, prev: "qf" },
    { key: "final", label: "Finale", short: "Finale", n: 1, prev: "sf" },
  ];

  // Points par vainqueur correct à chaque tour (un vainqueur de 16e = un
  // qualifié en 8es, etc.). Le vainqueur de la finale = champion.
  WC.KO_POINTS = { r32: 2, r16: 4, qf: 7, sf: 10, final: 20 };
  WC.THIRD_POINTS = 8; // bonne 3e place (petite finale)
  WC.KO_LABELS = {
    r32: "qualifié en 8es",
    r16: "qualifié en quarts",
    qf: "qualifié en demies",
    sf: "finaliste",
    final: "vainqueur",
  };

  // Barème phase de groupes
  WC.POINTS = { exact: 5, diff: 3, outcome: 1 };
})();
