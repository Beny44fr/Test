/* =====================================================================
   Persistance (localStorage) + encodage des codes de partage
   ===================================================================== */
(function () {
  const WC = (window.WC = window.WC || {});
  const KEY = "wc2026.v1";

  const emptyBracket = () => ({ teams: [], win: { r32: [], r16: [], qf: [], sf: [], final: [], third: [] } });

  const blank = () => ({
    me: { name: "" },
    predictions: {}, // { matchId: {h,a} }
    bonus: {}, // { topScorer }
    bracket: emptyBracket(), // tableau final pronostiqué
    results: {}, // résultats réels (API ou saisie organisateur)
    bonusResults: {},
    bracketResults: emptyBracket(), // vrai tableau final
    schedule: {}, // { matchId: {date, city} } surcharge depuis l'API
    apiCfg: null, // configuration API de synchronisation des résultats
    league: [], // [{ name, predictions, bonus, bracket }]
  });

  WC.store = {
    load() {
      try {
        const raw = localStorage.getItem(KEY);
        if (!raw) return blank();
        return Object.assign(blank(), JSON.parse(raw));
      } catch (e) {
        return blank();
      }
    },
    save(state) {
      try {
        localStorage.setItem(KEY, JSON.stringify(state));
      } catch (e) {
        console.warn("Sauvegarde impossible", e);
      }
    },
    reset() {
      localStorage.removeItem(KEY);
    },
    blank,
    emptyBracket,
  };

  /* ---- Encodage Base64 URL-safe compatible Unicode ---- */
  function b64encode(str) {
    const bytes = new TextEncoder().encode(str);
    let bin = "";
    bytes.forEach((b) => (bin += String.fromCharCode(b)));
    return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  }
  function b64decode(str) {
    str = str.replace(/-/g, "+").replace(/_/g, "/");
    while (str.length % 4) str += "=";
    const bin = atob(str);
    const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
    return new TextDecoder().decode(bytes);
  }

  // Un joueur partage : nom + pronos de groupe + bonus + tableau final
  WC.encodePlayer = function (player) {
    const payload = {
      v: 2,
      n: player.name,
      p: player.predictions || {},
      b: player.bonus || {},
      k: player.bracket || emptyBracket(),
    };
    return b64encode(JSON.stringify(payload));
  };

  WC.decodePlayer = function (code) {
    const obj = JSON.parse(b64decode(code.trim()));
    if (!obj || typeof obj.n !== "string") throw new Error("Code invalide");
    const bracket = obj.k && obj.k.win ? obj.k : emptyBracket();
    return { name: obj.n, predictions: obj.p || {}, bonus: obj.b || {}, bracket };
  };
})();
