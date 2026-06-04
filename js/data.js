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

  const t = (name, code, en) => ({ name, code, en });

  // 12 groupes de 4 équipes (code = drapeau image ; en = nom anglais pour l'API)
  WC.GROUPS = [
    { letter: "A", teams: [t("Mexique","mx","Mexico"), t("Afrique du Sud","za","South Africa"), t("Corée du Sud","kr","South Korea"), t("Tchéquie","cz","Czechia")] },
    { letter: "B", teams: [t("Canada","ca","Canada"), t("Bosnie-Herzégovine","ba","Bosnia and Herzegovina"), t("Qatar","qa","Qatar"), t("Suisse","ch","Switzerland")] },
    { letter: "C", teams: [t("Brésil","br","Brazil"), t("Maroc","ma","Morocco"), t("Haïti","ht","Haiti"), t("Écosse","gb-sct","Scotland")] },
    { letter: "D", teams: [t("États-Unis","us","United States"), t("Paraguay","py","Paraguay"), t("Australie","au","Australia"), t("Turquie","tr","Turkey")] },
    { letter: "E", teams: [t("Allemagne","de","Germany"), t("Curaçao","cw","Curacao"), t("Côte d'Ivoire","ci","Ivory Coast"), t("Équateur","ec","Ecuador")] },
    { letter: "F", teams: [t("Pays-Bas","nl","Netherlands"), t("Japon","jp","Japan"), t("Suède","se","Sweden"), t("Tunisie","tn","Tunisia")] },
    { letter: "G", teams: [t("Belgique","be","Belgium"), t("Égypte","eg","Egypt"), t("Iran","ir","Iran"), t("Nouvelle-Zélande","nz","New Zealand")] },
    { letter: "H", teams: [t("Espagne","es","Spain"), t("Cap-Vert","cv","Cape Verde"), t("Arabie saoudite","sa","Saudi Arabia"), t("Uruguay","uy","Uruguay")] },
    { letter: "I", teams: [t("France","fr","France"), t("Sénégal","sn","Senegal"), t("Irak","iq","Iraq"), t("Norvège","no","Norway")] },
    { letter: "J", teams: [t("Argentine","ar","Argentina"), t("Algérie","dz","Algeria"), t("Autriche","at","Austria"), t("Jordanie","jo","Jordan")] },
    { letter: "K", teams: [t("Portugal","pt","Portugal"), t("RD Congo","cd","DR Congo"), t("Ouzbékistan","uz","Uzbekistan"), t("Colombie","co","Colombia")] },
    { letter: "L", teams: [t("Angleterre","gb-eng","England"), t("Croatie","hr","Croatia"), t("Ghana","gh","Ghana"), t("Panama","pa","Panama")] },
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

  // Horaires indicatifs (heure locale du match) — affinés par l'API à la synchro
  const TIME_SLOTS = ["12:00", "15:00", "18:00", "21:00"];

  // Génération des 72 matchs de poule
  const MATCHES = [];
  WC.GROUPS.forEach((g, gi) => {
    SCHEDULE.forEach((pairs, mi) => {
      pairs.forEach((p, pi) => {
        MATCHES.push({
          id: `${g.letter}-${mi + 1}-${pi + 1}`,
          group: g.letter,
          matchday: mi + 1,
          home: g.teams[p[0]],
          away: g.teams[p[1]],
          date: DATES[g.letter][mi],
          time: TIME_SLOTS[(gi + mi + pi) % TIME_SLOTS.length], // indicatif
        });
      });
    });
  });
  // Tri chronologique (date puis heure) puis par groupe
  MATCHES.sort((a, b) => {
    const ka = a.date + a.time, kb = b.date + b.time;
    return ka < kb ? -1 : ka > kb ? 1 : a.group.localeCompare(b.group);
  });
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

  // 20 candidats réalistes au titre de meilleur buteur (équipes qualifiées)
  WC.TOP_SCORERS = [
    { name: "Kylian Mbappé", team: "France" },
    { name: "Erling Haaland", team: "Norvège" },
    { name: "Harry Kane", team: "Angleterre" },
    { name: "Lionel Messi", team: "Argentine" },
    { name: "Lautaro Martínez", team: "Argentine" },
    { name: "Julián Álvarez", team: "Argentine" },
    { name: "Vinícius Júnior", team: "Brésil" },
    { name: "Rodrygo", team: "Brésil" },
    { name: "Raphinha", team: "Brésil" },
    { name: "Cristiano Ronaldo", team: "Portugal" },
    { name: "Rafael Leão", team: "Portugal" },
    { name: "Lamine Yamal", team: "Espagne" },
    { name: "Álvaro Morata", team: "Espagne" },
    { name: "Jude Bellingham", team: "Angleterre" },
    { name: "Bukayo Saka", team: "Angleterre" },
    { name: "Memphis Depay", team: "Pays-Bas" },
    { name: "Cody Gakpo", team: "Pays-Bas" },
    { name: "Romelu Lukaku", team: "Belgique" },
    { name: "Mohamed Salah", team: "Égypte" },
    { name: "Jamal Musiala", team: "Allemagne" },
  ];
  WC.scorerLabel = (p) => `${p.name} (${p.team})`;
  WC.TOP_SCORER_LABELS = WC.TOP_SCORERS.map(WC.scorerLabel);

  // Barème phase de groupes
  WC.POINTS = { exact: 5, diff: 3, outcome: 1 };
})();
