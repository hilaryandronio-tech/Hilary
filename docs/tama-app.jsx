import React, { useState, useEffect, useMemo } from "react";

/* ------------------------------------------------------------------ */
/*  TAMA FERME — Saisie quotidienne. Prototype V1                      */
/*  1 alvéole = 30 œufs. Toute la logique dérive de LOTS + ENTRIES.    */
/* ------------------------------------------------------------------ */

const ALV = 30;

/* Pictogramme Tama Ferme (poule + œuf), encodé pour éviter tout fichier externe */
const LOGO = "data:image/png;base64,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";

const SEED_LOTS = [
  { id: "B1", nom: "Bâtiment 1", effectifInitial: 3000, enPonte: true, ageSem: 42 },
  { id: "B2", nom: "Bâtiment 2", effectifInitial: 3000, enPonte: true, ageSem: 31 },
  { id: "B3", nom: "Bâtiment 3", effectifInitial: 3000, enPonte: false, ageSem: 12 },
];

/* Calibres utilisés à la collecte */
const CALIBRES = ["S1", "S2", "M1", "M2", "L1", "L2", "XL1", "XL2"];

/* Prix unitaire par œuf, en ariary */
const PRIX = { S1: 600, S2: 620, M1: 650, M2: 660, L1: 670, L2: 680, XL1: 700, XL2: 750, casse: 500 };

/* Profils de connexion — chacun ouvre directement son écran */
const PROFILS = [
  { k: "ferme", l: "Chef de ferme", d: "Provende · mortalité" },
  { k: "magasin", l: "Magasinière", d: "Fiche de ponte" },
  { k: "vente", l: "Point de vente", d: "Caisse · clients" },
  { k: "direction", l: "Direction", d: "Accès complet" },
];

/* Tarifs négociés par client — remplacent le prix de base sur les tailles listées */
const CLIENTS = [
  { k: "calypso", l: "Calypso", prix: { L2: 800 } },
  { k: "leader", l: "Leader Price", prix: { M1: 760 } },
  { k: "terrasse", l: "La Terrasse", prix: { L1: 750 } },
  { k: "mercy", l: "Mercy Ships", prix: { L1: 800 } },
];
const prixClient = (cl, taille) => (cl?.prix?.[taille] ?? PRIX[taille]);

/* Catégories de charges — écran Chef de ferme */
const CATEGORIES = [
  { k: "veto", l: "Produit véto" },
  { k: "connexion", l: "Connexion" },
  { k: "sakafo", l: "Sakafo" },
  { k: "nettoyage", l: "Nettoyage" },
  { k: "salaire", l: "Salaire" },
  { k: "curbu", l: "Curbu Hilary" },
  { k: "carburant", l: "Carburant" },
  { k: "voiture", l: "Voiture" },
  { k: "frais", l: "Frais" },
  { k: "alveoles", l: "Alvéoles" },
  { k: "film", l: "Papier film" },
  { k: "etiquette", l: "Étiquette" },
  { k: "loyer", l: "Loyer" },
  { k: "deratisation", l: "Dératisation" },
  { k: "machine", l: "Remb. machine" },
  { k: "autres", l: "Autres" },
];

const CSS = `
@import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+Condensed:wght@600;700&family=IBM+Plex+Sans:wght@400;500;600&family=IBM+Plex+Mono:wght@500;600&display=swap');

.tf { --bg:#E4EFE7; --card:#EFFCF3; --ink:#36251E; --muted:#7C6A5F;
      --yolk:#FAA429; --brick:#AF481F; --moss:#36251E; --line:#CBDACE;
      --field:#F7FFF9;
      background:var(--bg); color:var(--ink); min-height:100vh;
      font-family:'IBM Plex Sans',system-ui,sans-serif; padding-bottom:120px; }
.tf *, .tf *::before, .tf *::after { box-sizing:border-box; }

.tf-head { position:sticky; top:0; z-index:20; background:var(--ink);
           padding:12px 16px 0; }
.tf-brand { display:flex; align-items:center; justify-content:space-between; gap:10px; }
.tf-mark { display:flex; align-items:center; gap:9px; }
.tf-mark img { height:34px; width:auto; display:block; }
.tf-logo { font-family:'IBM Plex Sans Condensed',sans-serif; font-weight:700;
           font-size:19px; letter-spacing:0.01em; text-transform:uppercase;
           color:var(--card); line-height:1.05; }
.tf-logo span { color:var(--yolk); }
.tf-date { font-family:'IBM Plex Mono',monospace; font-size:11px; color:#B9A99D;
           text-transform:uppercase; letter-spacing:0.06em; }

.tf-roles { display:flex; gap:6px; margin-top:12px; overflow-x:auto; padding-bottom:10px; }
.tf-role { flex:0 0 auto; border:1px solid #5A463C; background:transparent;
           border-radius:2px; padding:7px 12px; font-size:12px; font-weight:500;
           color:#C9BAB0; cursor:pointer; white-space:nowrap;
           font-family:'IBM Plex Sans',sans-serif; }
.tf-role[data-on="1"] { background:var(--yolk); border-color:var(--yolk); color:var(--ink); font-weight:600; }
.tf-role:focus-visible { outline:2px solid var(--yolk); outline-offset:2px; }

.tf-body { padding:18px 16px 0; max-width:640px; margin:0 auto; }
.tf-eyebrow { font-family:'IBM Plex Mono',monospace; font-size:10px; letter-spacing:0.12em;
              text-transform:uppercase; color:var(--muted); margin:0 0 8px; }
.tf-h1 { font-family:'IBM Plex Sans Condensed',sans-serif; font-weight:700;
         font-size:26px; line-height:1.1; margin:0 0 4px; letter-spacing:-0.01em; }
.tf-sub { font-size:13px; color:var(--muted); margin:0 0 20px; }

.tf-card { background:var(--card); border:1px solid var(--line); border-radius:3px;
           padding:14px; margin-bottom:12px; }
.tf-cardhead { display:flex; align-items:center; justify-content:space-between; margin-bottom:12px; }
.tf-cardtitle { font-family:'IBM Plex Sans Condensed',sans-serif; font-weight:600;
                font-size:15px; text-transform:uppercase; letter-spacing:0.02em; }
.tf-tag { font-family:'IBM Plex Mono',monospace; font-size:10px; color:var(--muted);
          border:1px solid var(--line); padding:2px 6px; border-radius:2px; }

.tf-fields { display:grid; gap:8px; }
.tf-grid2 { display:grid; grid-template-columns:1fr 1fr; gap:8px; }
.tf-grid4 { display:grid; grid-template-columns:repeat(4,1fr); gap:8px; }

.tf-field { border:1px solid var(--line); border-radius:2px; background:var(--field);
            padding:9px 11px; text-align:left; width:100%; cursor:pointer;
            font-family:'IBM Plex Sans',sans-serif; display:block; }
.tf-field:focus-visible { outline:2px solid var(--yolk); outline-offset:1px; }
.tf-field[data-filled="1"] { background:var(--card); border-color:var(--ink); }
.tf-label { display:block; font-size:10px; letter-spacing:0.08em; text-transform:uppercase;
            color:var(--muted); font-family:'IBM Plex Mono',monospace; margin-bottom:3px; }
.tf-value { font-family:'IBM Plex Mono',monospace; font-weight:600; font-size:21px;
            line-height:1.15; font-variant-numeric:tabular-nums; }
.tf-value[data-zero="1"] { color:#B6C4B9; }
.tf-unit { font-size:11px; font-weight:500; color:var(--muted); margin-left:3px; }
.tf-field[data-tone="brick"][data-filled="1"] .tf-value { color:var(--brick); }

.tf-chips { display:flex; flex-wrap:wrap; gap:6px; margin-bottom:12px; }
.tf-chip { border:1px solid var(--line); background:var(--field); border-radius:2px; padding:8px 11px;
           font-size:12px; font-weight:500; cursor:pointer; font-family:'IBM Plex Sans',sans-serif;
           color:var(--muted); }
.tf-chip[data-on="1"] { background:var(--ink); border-color:var(--ink); color:#fff; }
.tf-chip[data-dot="1"]::after { content:"·"; color:var(--yolk); font-weight:700; margin-left:5px; }

.tf-due { display:flex; align-items:center; justify-content:space-between; gap:10px;
          padding:10px 0; border-bottom:1px dashed var(--line); }
.tf-due:last-child { border-bottom:none; padding-bottom:0; }
.tf-due-l { font-size:13px; font-weight:500; }
.tf-due-d { font-family:'IBM Plex Mono',monospace; font-size:10px; color:var(--muted); margin-top:2px; }
.tf-due-d[data-late="1"] { color:var(--brick); font-weight:600; }
.tf-due-r { display:flex; align-items:center; gap:9px; flex:0 0 auto; }
.tf-due-n { font-family:'IBM Plex Mono',monospace; font-weight:600; font-size:14px;
            font-variant-numeric:tabular-nums; }
.tf-due-btn { border:1px solid var(--moss); background:var(--moss); color:#fff; border-radius:2px;
              padding:9px 12px; font-size:12px; font-weight:600; cursor:pointer;
              font-family:'IBM Plex Sans',sans-serif; white-space:nowrap; }
.tf-due-btn:focus-visible { outline:2px solid var(--ink); outline-offset:2px; }

.tf-toggle { display:flex; gap:6px; margin-top:12px; }
.tf-toggle .tf-chip { flex:1; text-align:center; padding:11px; font-weight:600; }
.tf-chip[data-warn="1"][data-on="1"] { background:var(--brick); border-color:var(--brick); color:#fff; }

.tf-cats { display:grid; grid-template-columns:1fr 1fr; gap:6px; }
.tf-cats .tf-field { padding:7px 9px; }
.tf-cats .tf-label { font-size:9px; letter-spacing:0.05em; white-space:nowrap;
                     overflow:hidden; text-overflow:ellipsis; }
.tf-cats .tf-value { font-size:16px; }

.tf-live { display:flex; align-items:baseline; gap:8px; margin-top:12px;
           border-top:1px dashed var(--line); padding-top:10px; }
.tf-live-n { font-family:'IBM Plex Mono',monospace; font-weight:600; font-size:26px;
             font-variant-numeric:tabular-nums; }
.tf-live-l { font-size:12px; color:var(--muted); }

.tf-lots { display:flex; gap:6px; margin-bottom:14px; }
.tf-lot { flex:1; border:1px solid var(--line); background:var(--card); border-radius:2px;
          padding:9px 6px; cursor:pointer; font-family:'IBM Plex Sans',sans-serif; }
.tf-lot[data-on="1"] { border-color:var(--ink); box-shadow:inset 0 -3px 0 var(--yolk); }
.tf-lot-id { font-family:'IBM Plex Sans Condensed',sans-serif; font-weight:700; font-size:15px; }
.tf-lot-m { font-family:'IBM Plex Mono',monospace; font-size:10px; color:var(--muted); }

.tf-cta { position:fixed; left:0; right:0; bottom:0; z-index:30; padding:12px 16px 16px;
          background:linear-gradient(to top,var(--bg) 72%,rgba(228,239,231,0)); }
.tf-cta-in { max-width:640px; margin:0 auto; display:flex; gap:8px; }
.tf-btn { flex:1; border:none; border-radius:2px; padding:15px; font-size:14px; font-weight:700;
          cursor:pointer; font-family:'IBM Plex Sans',sans-serif; background:var(--yolk); color:var(--ink); }
.tf-btn:disabled { background:#CBDACE; color:#8C9A8F; cursor:not-allowed; }
.tf-btn-ghost { flex:0 0 auto; background:transparent; border:1px solid var(--ink); padding:15px 16px; }
.tf-btn:focus-visible { outline:2px solid var(--ink); outline-offset:2px; }

.tf-pad { position:fixed; inset:0; z-index:50; display:flex; flex-direction:column;
          justify-content:flex-end; background:rgba(54,37,30,0.42); }
.tf-pad-sheet { background:var(--card); border-top:2px solid var(--ink); padding:16px;
                animation:tfup .16s ease-out; }
@keyframes tfup { from{transform:translateY(16px);opacity:.4} to{transform:none;opacity:1} }
.tf-pad-head { display:flex; align-items:baseline; justify-content:space-between; margin-bottom:14px; }
.tf-pad-label { font-family:'IBM Plex Mono',monospace; font-size:11px; letter-spacing:0.08em;
                text-transform:uppercase; color:var(--muted); }
.tf-pad-val { font-family:'IBM Plex Mono',monospace; font-weight:600; font-size:34px;
              font-variant-numeric:tabular-nums; }
.tf-keys { display:grid; grid-template-columns:repeat(3,1fr); gap:7px; max-width:420px; margin:0 auto; }
.tf-key { border:1px solid var(--line); background:var(--field); border-radius:2px; padding:16px;
          font-family:'IBM Plex Mono',monospace; font-weight:600; font-size:20px; cursor:pointer; }
.tf-key:active { background:var(--yolk); }
.tf-key[data-ok="1"] { background:var(--ink); color:var(--card); border-color:var(--ink); grid-column:span 3; font-size:14px; }

.tf-kpis { display:grid; grid-template-columns:1fr 1fr; gap:8px; margin-bottom:12px; }
.tf-kpi { background:var(--card); border:1px solid var(--line); border-radius:3px; padding:12px; }
.tf-kpi-n { font-family:'IBM Plex Mono',monospace; font-weight:600; font-size:25px;
            font-variant-numeric:tabular-nums; line-height:1.1; }
.tf-kpi-l { font-size:11px; color:var(--muted); margin-top:3px; }
.tf-kpi[data-alert="1"] { border-left:4px solid var(--brick); }
.tf-kpi[data-alert="1"] .tf-kpi-n { color:var(--brick); }
.tf-kpi[data-hero="1"] { grid-column:span 2; border-color:var(--ink); border-left:4px solid var(--yolk); }
.tf-kpi[data-hero="1"] .tf-kpi-n { font-size:40px; }

.tf-bars { display:flex; align-items:flex-end; gap:5px; height:78px; margin:14px 0 6px; }
.tf-bar { flex:1; background:var(--line); border-radius:1px 1px 0 0; min-height:3px; position:relative; }
.tf-bar[data-last="1"] { background:var(--yolk); }
.tf-barlabels { display:flex; gap:5px; }
.tf-barlabel { flex:1; text-align:center; font-family:'IBM Plex Mono',monospace;
               font-size:9px; color:var(--muted); }

.tf-ticket { font-family:'IBM Plex Mono',monospace; font-size:12px; }
.tf-ticket-row { display:flex; justify-content:space-between; padding:6px 0;
                 border-bottom:1px dashed var(--line); }
.tf-ticket-row:last-child { border-bottom:none; }
.tf-empty { font-size:13px; color:var(--muted); padding:6px 0; }
.tf-note { font-size:11px; color:var(--muted); margin-top:10px; line-height:1.5; }
.tf-flash { position:fixed; left:16px; right:16px; bottom:96px; z-index:60; background:var(--moss);
            color:#fff; padding:12px 14px; border-radius:2px; font-size:13px; max-width:608px;
            margin:0 auto; text-align:center; }

.tf-login { position:fixed; inset:0; z-index:80; background:var(--ink); display:flex;
            flex-direction:column; align-items:center; justify-content:center;
            padding:28px 20px; overflow-y:auto;
            font-family:'IBM Plex Sans',system-ui,sans-serif; }
.tf-login-in { width:100%; max-width:380px; }
.tf-login img { display:block; margin:0 auto 18px; height:150px; }
.tf-login-t { font-family:'IBM Plex Sans Condensed',sans-serif; font-weight:700; font-size:23px;
              color:var(--card); text-align:center; text-transform:uppercase; letter-spacing:0.02em; }
.tf-login-s { font-family:'IBM Plex Mono',monospace; font-size:10px; letter-spacing:0.16em;
              text-transform:uppercase; color:#B9A99D; text-align:center; margin:5px 0 26px; }
.tf-login-lbl { font-family:'IBM Plex Mono',monospace; font-size:10px; letter-spacing:0.1em;
                text-transform:uppercase; color:#B9A99D; margin-bottom:8px; }
.tf-who { display:grid; grid-template-columns:1fr 1fr; gap:7px; margin-bottom:22px; }
.tf-who button { border:1px solid #5A463C; background:transparent; color:#C9BAB0; border-radius:2px;
                 padding:12px 8px; font-size:13px; cursor:pointer; text-align:left;
                 font-family:'IBM Plex Sans',sans-serif; }
.tf-who button[data-on="1"] { background:var(--yolk); border-color:var(--yolk); color:var(--ink); font-weight:600; }
.tf-who small { display:block; font-family:'IBM Plex Mono',monospace; font-size:9px; opacity:.75; margin-top:2px; }
.tf-pin { display:flex; gap:9px; justify-content:center; margin-bottom:22px; }
.tf-pin i { width:15px; height:15px; border-radius:50%; border:1.5px solid #5A463C; }
.tf-pin i[data-on="1"] { background:var(--yolk); border-color:var(--yolk); }
.tf-login .tf-keys { max-width:300px; }
.tf-login .tf-key { background:transparent; border-color:#5A463C; color:var(--card); padding:15px; }
.tf-login .tf-key:active { background:var(--yolk); color:var(--ink); }
.tf-login .tf-key[data-ok="1"] { background:var(--yolk); border-color:var(--yolk); color:var(--ink); font-weight:700; }
.tf-login .tf-key[data-ok="1"]:disabled { background:#5A463C; border-color:#5A463C; color:#9A897E; }
.tf-login-f { text-align:center; font-family:'IBM Plex Mono',monospace; font-size:9px;
              letter-spacing:0.1em; color:#6E5A4E; margin-top:22px; text-transform:uppercase; }

@media (prefers-reduced-motion:reduce){ .tf-pad-sheet{animation:none} }
`;

const fmt = (n) => new Intl.NumberFormat("fr-FR").format(Math.round(n || 0));
const today = () => new Date().toISOString().slice(0, 10);
const dLabel = (d) =>
  new Date(d + "T12:00:00").toLocaleDateString("fr-FR", { weekday: "short", day: "2-digit", month: "short" });

/* ---------------------------- pavé numérique ---------------------------- */
function Keypad({ field, onChange, onClose }) {
  if (!field) return null;
  const push = (k) => {
    if (k === "C") return onChange(0);
    if (k === "<") return onChange(Math.floor((field.value || 0) / 10));
    const next = Number(String(field.value || 0) + k);
    if (next <= 9999999) onChange(next);
  };
  return (
    <div className="tf-pad" onClick={onClose}>
      <div className="tf-pad-sheet" onClick={(e) => e.stopPropagation()}>
        <div className="tf-pad-head">
          <span className="tf-pad-label">{field.label}</span>
          <span className="tf-pad-val">
            {fmt(field.value)}
            <span className="tf-unit">{field.unit}</span>
          </span>
        </div>
        <div className="tf-keys">
          {["1", "2", "3", "4", "5", "6", "7", "8", "9", "C", "0", "<"].map((k) => (
            <button key={k} className="tf-key" onClick={() => push(k)}>{k}</button>
          ))}
          <button className="tf-key" data-ok="1" onClick={onClose}>Valider</button>
        </div>
      </div>
    </div>
  );
}

/* ---------------------------- champ chiffre ---------------------------- */
function NumField({ label, unit, value, tone, onOpen }) {
  return (
    <button className="tf-field" data-filled={value ? 1 : 0} data-tone={tone} onClick={onOpen}>
      <span className="tf-label">{label}</span>
      <span className="tf-value" data-zero={value ? 0 : 1}>
        {fmt(value)}<span className="tf-unit">{unit}</span>
      </span>
    </button>
  );
}

/* ================================ APP ================================ */
export default function TamaFerme() {
  const [role, setRole] = useState("ferme");
  const [entries, setEntries] = useState([]);
  const [ready, setReady] = useState(false);
  const [lot, setLot] = useState("B1");
  const [client, setClient] = useState("calypso");
  const [params, setParams] = useState({ provende: 0, poulette: 0, semaines: 52 });
  const [periode, setPeriode] = useState("mois");
  const [connecte, setConnecte] = useState(false);
  const [qui, setQui] = useState("ferme");
  const [pin, setPin] = useState("");
  const [pad, setPad] = useState(null);
  const [flash, setFlash] = useState("");
  const [draft, setDraft] = useState({});

  useEffect(() => {
    (async () => {
      try {
        const r = await window.storage.get("tama:entries");
        if (r?.value) setEntries(JSON.parse(r.value));
        const p = await window.storage.get("tama:params");
        if (p?.value) setParams(JSON.parse(p.value));
      } catch (e) { /* première ouverture */ }
      setReady(true);
    })();
  }, []);

  const save = async (rows) => {
    const next = [...entries, ...rows];
    setEntries(next);
    try { await window.storage.set("tama:entries", JSON.stringify(next)); }
    catch (e) { setFlash("Enregistré sur l'appareil. Synchronisation en attente."); }
  };

  const solder = async (id) => {
    const next = entries.map((e) => (e.id === id ? { ...e, solde: true, dateSolde: today() } : e));
    setEntries(next);
    try { await window.storage.set("tama:entries", JSON.stringify(next)); } catch (e) { /* hors ligne */ }
    setFlash("Encaissement enregistré.");
    setTimeout(() => setFlash(""), 2600);
  };

  const val = (k) => draft[k] || 0;
  const open = (k, label, unit) => setPad({ key: k, label, unit, value: val(k) });
  const setPadVal = (v) => {
    if (pad.key.startsWith("p_")) {
      const np = { ...params, [pad.key.slice(2)]: v };
      setParams(np);
      window.storage.set("tama:params", JSON.stringify(np)).catch(() => {});
    } else {
      setDraft({ ...draft, [pad.key]: v });
    }
    setPad({ ...pad, value: v });
  };

  /* ---------- agrégats ---------- */
  const lots = SEED_LOTS;
  const stats = useMemo(() => {
    const morts = {}; lots.forEach((l) => (morts[l.id] = 0));
    entries.filter((e) => e.type === "mortalite").forEach((e) => (morts[e.lot] = (morts[e.lot] || 0) + e.n));
    const vivants = lots.map((l) => ({ ...l, vivant: l.effectifInitial - (morts[l.id] || 0) }));
    const enPonte = vivants.filter((l) => l.enPonte).reduce((s, l) => s + l.vivant, 0);
    const cheptel = vivants.reduce((s, l) => s + l.vivant, 0);

    const byDay = (d) => {
      const E = entries.filter((e) => e.date === d);
      const oeufs = E.filter((e) => e.type === "ponte").reduce((s, e) => s + e.oeufs, 0);
      const degats = E.filter((e) => e.type === "ponte").reduce((s, e) => s + (e.degats || 0), 0);
      const valeur = E.filter((e) => e.type === "ponte").reduce((s, e) => s + (e.valeur || 0), 0);
      const kg = E.filter((e) => e.type === "provende").reduce((s, e) => s + e.n, 0);
      const mort = E.filter((e) => e.type === "mortalite").reduce((s, e) => s + e.n, 0);
      const estCredit = (e) => (e.type === "vente" && e.credit) || e.type === "credit";
      const recette =
        E.filter((e) => e.type === "vente" && !e.credit).reduce((s, e) => s + e.n, 0) +
        entries.filter((e) => estCredit(e) && e.solde && e.dateSolde === d).reduce((s, e) => s + e.n, 0);
      const creance = E.filter(estCredit).reduce((s, e) => s + e.n, 0);
      const charge = E.filter((e) => e.type === "charge").reduce((s, e) => s + e.n, 0);
      return { d, oeufs, degats, valeur, kg, mort, recette, creance, charge, taux: enPonte ? (oeufs / enPonte) * 100 : 0 };
    };
    const days = [...Array(7)].map((_, i) => {
      const dt = new Date(); dt.setDate(dt.getDate() - (6 - i));
      return byDay(dt.toISOString().slice(0, 10));
    });
    const impayes = entries.filter(
      (e) => ((e.type === "vente" && e.credit) || e.type === "credit") && !e.solde
    );
    const creanceTotale = impayes.reduce((s, e) => s + e.n, 0);
    return { vivants, enPonte, cheptel, impayes, creanceTotale, jour: byDay(today()), days };
  }, [entries, lots]);

  if (!ready) return <div className="tf"><style>{CSS}</style></div>;

  const commit = (rows, msg) => {
    if (!rows.length) return;
    save(rows.map((r) => ({ ...r, date: today(), id: Math.random().toString(36).slice(2) })));
    setDraft({}); setFlash(msg);
    setTimeout(() => setFlash(""), 2600);
  };

  /* ---------- vues ---------- */
  const ROLES = [
    { k: "ferme", l: "Chef de ferme" },
    { k: "magasin", l: "Magasinière" },
    { k: "vente", l: "Point de vente" },
    { k: "creances", l: "Créances" },
    { k: "bilan", l: "Bilan" },
    { k: "direction", l: "Direction" },
  ];

  const alvDraft = CALIBRES.reduce((s, c) => s + val("c" + c), 0);
  const oeufsDraft = alvDraft * ALV;
  const valeurDraft =
    CALIBRES.reduce((s, c) => s + val("c" + c) * ALV * PRIX[c], 0) + val("casse") * PRIX.casse;
  const totalCharges = CATEGORIES.reduce((s, c) => s + val("ch_" + c.k), 0);
  const paye = (k) => draft[`pay_${k}`] !== "credit";
  const venteClient = (cl, c) => val(`v_${cl.k}_${c}`) * ALV * prixClient(cl, c);
  const totalClients = CLIENTS.reduce((s, cl) => s + CALIBRES.reduce((t, c) => t + venteClient(cl, c), 0), 0);

  if (!connecte) {
    return (
      <div className="tf">
        <style>{CSS}</style>
        <div className="tf-login">
          <div className="tf-login-in">
            <img src={LOGO} alt="Tama Ferme" />
            <div className="tf-login-t">Tama Ferme</div>
            <div className="tf-login-s">Gestion de la ferme · Toamasina</div>

            <div className="tf-login-lbl">Qui es-tu ?</div>
            <div className="tf-who">
              {PROFILS.map((p) => (
                <button key={p.k} data-on={qui === p.k ? 1 : 0} onClick={() => setQui(p.k)}>
                  {p.l}<small>{p.d}</small>
                </button>
              ))}
            </div>

            <div className="tf-login-lbl">Code à 4 chiffres</div>
            <div className="tf-pin">
              {[0, 1, 2, 3].map((i) => <i key={i} data-on={pin.length > i ? 1 : 0} />)}
            </div>

            <div className="tf-keys">
              {["1", "2", "3", "4", "5", "6", "7", "8", "9", "C", "0", "<"].map((k) => (
                <button key={k} className="tf-key" onClick={() => {
                  if (k === "C") return setPin("");
                  if (k === "<") return setPin(pin.slice(0, -1));
                  if (pin.length < 4) setPin(pin + k);
                }}>{k}</button>
              ))}
              <button className="tf-key" data-ok="1" disabled={pin.length < 4}
                onClick={() => { setRole(qui); setConnecte(true); setPin(""); }}>
                Entrer
              </button>
            </div>

            <div className="tf-login-f">Prototype · code non vérifié</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="tf">
      <style>{CSS}</style>

      <header className="tf-head">
        <div className="tf-brand">
          <div className="tf-mark">
            <img src={LOGO} alt="Tama Ferme" />
            <div className="tf-logo">Tama<span>·</span>Ferme</div>
          </div>
          <div className="tf-date">{dLabel(today())}</div>
        </div>
        <div className="tf-roles">
          {ROLES.map((r) => (
            <button key={r.k} className="tf-role" data-on={role === r.k ? 1 : 0}
              onClick={() => { setRole(r.k); setDraft({}); }}>{r.l}</button>
          ))}
        </div>
      </header>

      <main className="tf-body">
        {/* ---------------- CHEF DE FERME ---------------- */}
        {role === "ferme" && (
          <>
            <p className="tf-eyebrow">Saisie du soir · 30 secondes</p>
            <h1 className="tf-h1">Provende, mortalité, charges</h1>
            <p className="tf-sub">Choisis le bâtiment, tape les chiffres, enregistre.</p>

            <div className="tf-lots">
              {stats.vivants.map((l) => (
                <button key={l.id} className="tf-lot" data-on={lot === l.id ? 1 : 0} onClick={() => setLot(l.id)}>
                  <div className="tf-lot-id">{l.id}</div>
                  <div className="tf-lot-m">{fmt(l.vivant)} · {l.ageSem} sem</div>
                </button>
              ))}
            </div>

            <div className="tf-card">
              <div className="tf-cardhead">
                <span className="tf-cardtitle">{lot} — aujourd'hui</span>
                <span className="tf-tag">{lots.find((l) => l.id === lot).enPonte ? "EN PONTE" : "POULETTES"}</span>
              </div>
              <div className="tf-grid2">
                <NumField label="Provende" unit="kg" value={val("kg")} onOpen={() => open("kg", "Provende distribuée", "kg")} />
                <NumField label="Mortalité" unit="têtes" tone="brick" value={val("mort")} onOpen={() => open("mort", "Mortalité du jour", "têtes")} />
              </div>
              <div className="tf-live">
                <span className="tf-live-n">
                  {val("kg") && stats.vivants.find((l) => l.id === lot).vivant
                    ? fmt((val("kg") * 1000) / stats.vivants.find((l) => l.id === lot).vivant) : "—"}
                </span>
                <span className="tf-live-l">grammes par poule · norme 110–125 g</span>
              </div>
            </div>

            <div className="tf-card">
              <div className="tf-cardhead">
                <span className="tf-cardtitle">Charges ferme</span>
                <span className="tf-tag">{CATEGORIES.filter((c) => val("ch_" + c.k)).length} / {CATEGORIES.length}</span>
              </div>
              <div className="tf-cats">
                {CATEGORIES.map((c) => (
                  <NumField key={c.k} label={c.l} unit="Ar" value={val("ch_" + c.k)}
                    onOpen={() => open("ch_" + c.k, c.l, "Ar")} />
                ))}
              </div>
              <div className="tf-live">
                <span className="tf-live-n">{fmt(totalCharges)}</span>
                <span className="tf-live-l">Ar de charges aujourd'hui</span>
              </div>
              <p className="tf-note">Laisse à zéro les postes sans dépense aujourd'hui. Seules les catégories remplies sont enregistrées.</p>
            </div>
          </>
        )}

        {/* ---------------- MAGASINIÈRE ---------------- */}
        {role === "magasin" && (
          <>
            <p className="tf-eyebrow">Fiche de ponte · en alvéoles</p>
            <h1 className="tf-h1">Collecte par calibre</h1>
            <p className="tf-sub">Compte en alvéoles de 30. La conversion en œufs est automatique.</p>

            <div className="tf-card">
              <div className="tf-cardhead">
                <span className="tf-cardtitle">Alvéoles collectées</span>
                <span className="tf-tag">1 ALV = 30 ŒUFS</span>
              </div>
              <div className="tf-grid4">
                {CALIBRES.map((c) => (
                  <NumField key={c} label={`${c} · ${PRIX[c]}`} unit="" value={val("c" + c)}
                    onOpen={() => open("c" + c, `Taille ${c} — ${PRIX[c]} Ar/œuf`, "alv")} />
                ))}
              </div>
              <div className="tf-live">
                <span className="tf-live-n">{fmt(oeufsDraft)}</span>
                <span className="tf-live-l">
                  œufs · taux de ponte {stats.enPonte ? ((oeufsDraft / stats.enPonte) * 100).toFixed(1) : "0"} %
                </span>
              </div>
              <div className="tf-live">
                <span className="tf-live-n">{fmt(valeurDraft)}</span>
                <span className="tf-live-l">Ar — valeur de la collecte</span>
              </div>
            </div>

            <div className="tf-card">
              <div className="tf-cardhead"><span className="tf-cardtitle">Dégâts</span></div>
              <div className="tf-grid2">
                <NumField label="Cassés" unit="œufs" tone="brick" value={val("casse")} onOpen={() => open("casse", "Œufs cassés", "œufs")} />
                <NumField label="Sales / fêlés" unit="œufs" tone="brick" value={val("sale")} onOpen={() => open("sale", "Œufs sales ou fêlés", "œufs")} />
              </div>
              <p className="tf-note">Au-delà de 2 % de la collecte, il y a un problème de nid, de ramassage ou de calcium.</p>
            </div>
          </>
        )}

        {/* ---------------- POINT DE VENTE ---------------- */}
        {role === "vente" && (
          <>
            <p className="tf-eyebrow">Clôture de caisse</p>
            <h1 className="tf-h1">Recettes et dépenses</h1>
            <p className="tf-sub">Ce que la caisse a encaissé aujourd'hui, et ce qui reste à encaisser.</p>

            <div className="tf-card">
              <div className="tf-cardhead">
                <span className="tf-cardtitle">Vente client</span>
                <span className="tf-tag">EN ALVÉOLES</span>
              </div>
              <div className="tf-chips">
                {CLIENTS.map((cl) => (
                  <button key={cl.k} className="tf-chip" data-on={client === cl.k ? 1 : 0}
                    data-dot={CALIBRES.some((c) => val(`v_${cl.k}_${c}`)) ? 1 : 0}
                    onClick={() => setClient(cl.k)}>{cl.l}</button>
                ))}
              </div>
              {(() => {
                const cl = CLIENTS.find((x) => x.k === client);
                const totalCl = CALIBRES.reduce((s, c) => s + venteClient(cl, c), 0);
                return (
                  <>
                    <div className="tf-grid4">
                      {CALIBRES.map((c) => (
                        <NumField key={c} label={`${c} · ${prixClient(cl, c)}`} unit=""
                          value={val(`v_${cl.k}_${c}`)}
                          onOpen={() => open(`v_${cl.k}_${c}`, `${cl.l} — ${c} à ${prixClient(cl, c)} Ar`, "alv")} />
                      ))}
                    </div>
                    <div className="tf-live">
                      <span className="tf-live-n">{fmt(totalCl)}</span>
                      <span className="tf-live-l">Ar — commande {cl.l}</span>
                    </div>
                    <div className="tf-toggle">
                      <button className="tf-chip" data-on={paye(cl.k) ? 1 : 0}
                        onClick={() => setDraft({ ...draft, [`pay_${cl.k}`]: "paye" })}>Payé</button>
                      <button className="tf-chip" data-warn="1" data-on={!paye(cl.k) ? 1 : 0}
                        onClick={() => setDraft({ ...draft, [`pay_${cl.k}`]: "credit" })}>À crédit</button>
                    </div>
                  </>
                );
              })()}
              <p className="tf-note">
                Les tailles négociées avec ce client s'appliquent automatiquement, les autres partent au prix de base.
                Le point orange signale un client déjà saisi aujourd'hui.
              </p>
            </div>

            <div className="tf-card">
              <div className="tf-cardhead"><span className="tf-cardtitle">Encaissements</span></div>
              <div className="tf-grid2">
                <NumField label="Recette du jour" unit="Ar" value={val("rec")} onOpen={() => open("rec", "Recette encaissée", "Ar")} />
                <NumField label="Vendu à crédit" unit="Ar" tone="brick" value={val("cred")} onOpen={() => open("cred", "Vendu à crédit", "Ar")} />
              </div>
              <div className="tf-live">
                <span className="tf-live-n">{fmt(val("rec") + val("cred") + totalClients)}</span>
                <span className="tf-live-l">Ar de chiffre d'affaires (caisse + clients)</span>
              </div>
            </div>

            <div className="tf-card">
              <div className="tf-cardhead"><span className="tf-cardtitle">Charges du point de vente</span></div>
              <NumField label="Total dépenses" unit="Ar" value={val("chgv")} onOpen={() => open("chgv", "Charges point de vente", "Ar")} />
            </div>
          </>
        )}

        {/* ---------------- CRÉANCES ---------------- */}
        {role === "creances" && (
          <>
            <p className="tf-eyebrow">Recouvrement</p>
            <h1 className="tf-h1">Livraisons impayées</h1>
            <p className="tf-sub">Appuie sur Encaissé quand le client règle. La ligne bascule en recette du jour.</p>

            <div className="tf-kpis">
              <div className="tf-kpi" data-hero="1" data-alert={stats.creanceTotale ? 1 : 0}>
                <div className="tf-kpi-n">{fmt(stats.creanceTotale)}</div>
                <div className="tf-kpi-l">Ar à recouvrer · {stats.impayes.length} livraison(s)</div>
              </div>
            </div>

            {stats.impayes.length === 0 && (
              <div className="tf-card"><p className="tf-empty">Aucune créance en cours. Tout est encaissé.</p></div>
            )}

            {(() => {
              const mois = today().slice(0, 7);
              const age = (d) => Math.round((new Date(today()) - new Date(d)) / 86400000);
              const bucket = [
                { l: "0 – 30 jours", n: stats.impayes.filter((e) => age(e.date) <= 30).reduce((s, e) => s + e.n, 0) },
                { l: "31 – 60 jours", n: stats.impayes.filter((e) => age(e.date) > 30 && age(e.date) <= 60).reduce((s, e) => s + e.n, 0) },
                { l: "Plus de 60 jours", n: stats.impayes.filter((e) => age(e.date) > 60).reduce((s, e) => s + e.n, 0) },
              ];
              const livreMois = entries
                .filter((e) => ((e.type === "vente" && e.credit) || e.type === "credit") && e.date.startsWith(mois))
                .reduce((s, e) => s + e.n, 0);
              const encaisseMois = entries
                .filter((e) => e.solde && e.dateSolde?.startsWith(mois))
                .reduce((s, e) => s + e.n, 0);
              return (
                <>
                  <div className="tf-card">
                    <div className="tf-cardhead">
                      <span className="tf-cardtitle">Ancienneté</span>
                      <span className="tf-tag">RELANCE À 30 J</span>
                    </div>
                    <div className="tf-ticket">
                      {bucket.map((b, i) => (
                        <div className="tf-ticket-row" key={b.l}>
                          <span style={i === 2 && b.n ? { color: "var(--brick)", fontWeight: 600 } : undefined}>{b.l}</span>
                          <span style={i === 2 && b.n ? { color: "var(--brick)", fontWeight: 600 } : undefined}>{fmt(b.n)} Ar</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="tf-card">
                    <div className="tf-cardhead">
                      <span className="tf-cardtitle">Mois en cours</span>
                      <span className="tf-tag">{new Date().toLocaleDateString("fr-FR", { month: "long", year: "numeric" }).toUpperCase()}</span>
                    </div>
                    <div className="tf-ticket">
                      <div className="tf-ticket-row"><span>Livré à crédit</span><span>{fmt(livreMois)} Ar</span></div>
                      <div className="tf-ticket-row"><span>Encaissé sur créances</span><span>{fmt(encaisseMois)} Ar</span></div>
                      <div className="tf-ticket-row">
                        <span style={{ fontWeight: 600 }}>Reste dû sur le mois</span>
                        <span style={{ fontWeight: 600 }}>{fmt(livreMois - encaisseMois)} Ar</span>
                      </div>
                    </div>
                  </div>
                </>
              );
            })()}

            {[...new Set(stats.impayes.map((e) => e.client || "Point de vente"))].map((nom) => {
              const lignes = stats.impayes.filter((e) => (e.client || "Point de vente") === nom);
              const total = lignes.reduce((s, e) => s + e.n, 0);
              return (
                <div className="tf-card" key={nom}>
                  <div className="tf-cardhead">
                    <span className="tf-cardtitle">{nom}</span>
                    <span className="tf-tag">{fmt(total)} AR</span>
                  </div>
                  {lignes.map((e) => {
                    const jours = Math.round((new Date(today()) - new Date(e.date)) / 86400000);
                    return (
                      <div className="tf-due" key={e.id}>
                        <div>
                          <div className="tf-due-l">{e.libelle}</div>
                          <div className="tf-due-d" data-late={jours > 30 ? 1 : 0}>
                            {dLabel(e.date)} · {jours} jour{jours > 1 ? "s" : ""}
                          </div>
                        </div>
                        <div className="tf-due-r">
                          <span className="tf-due-n">{fmt(e.n)}</span>
                          <button className="tf-due-btn" onClick={() => solder(e.id)}>Encaissé</button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </>
        )}

        {/* ---------------- BILAN ---------------- */}
        {role === "bilan" && (() => {
          const now = new Date();
          const from =
            periode === "mois"
              ? today().slice(0, 7) + "-01"
              : new Date(now.getTime() - (periode - 1) * 86400000).toISOString().slice(0, 10);
          const jours = Math.round((new Date(today()) - new Date(from)) / 86400000) + 1;
          const E = entries.filter((e) => e.date >= from);

          const ca = E.filter((e) => e.type === "vente").reduce((s, e) => s + e.n, 0);
          const oeufs = E.filter((e) => e.type === "ponte").reduce((s, e) => s + e.oeufs, 0);
          const kg = E.filter((e) => e.type === "provende").reduce((s, e) => s + e.n, 0);
          const chargesSaisies = E.filter((e) => e.type === "charge").reduce((s, e) => s + e.n, 0);
          const coutProvende = kg * params.provende;
          const amortissement = (params.poulette / (params.semaines * 7)) * stats.enPonte * jours;
          const total = chargesSaisies + coutProvende + amortissement;
          const benefice = ca - total;
          const revient = oeufs ? total / oeufs : 0;
          const prixMoyen = oeufs ? ca / oeufs : 0;
          const manquant = !params.provende || !params.poulette;

          const lignes = [
            ["Provende", coutProvende],
            ["Amortissement poulettes", amortissement],
            ["Charges saisies", chargesSaisies],
          ];

          return (
            <>
              <p className="tf-eyebrow">Compte de résultat</p>
              <h1 className="tf-h1">Chiffre d'affaires et bénéfice</h1>
              <p className="tf-sub">Production valorisée, charges complètes, résultat sur la période.</p>

              <div className="tf-chips">
                {[["7", "7 jours"], ["30", "30 jours"], ["mois", "Mois en cours"]].map(([k, l]) => (
                  <button key={k} className="tf-chip" data-on={String(periode) === k ? 1 : 0}
                    onClick={() => setPeriode(k === "mois" ? "mois" : Number(k))}>{l}</button>
                ))}
              </div>

              {manquant && (
                <div className="tf-card" style={{ borderLeft: "4px solid var(--brick)" }}>
                  <p className="tf-empty">
                    Renseigne le prix du kg de provende et le coût d'une poulette plus bas — sans ces deux chiffres,
                    le bénéfice affiché est faux.
                  </p>
                </div>
              )}

              <div className="tf-kpis">
                <div className="tf-kpi" data-hero="1">
                  <div className="tf-kpi-n">{fmt(ca)}</div>
                  <div className="tf-kpi-l">Chiffre d'affaires (Ar) · {jours} jours · {fmt(oeufs)} œufs</div>
                </div>
                <div className="tf-kpi" data-hero="1" data-alert={benefice < 0 ? 1 : 0}>
                  <div className="tf-kpi-n">{fmt(benefice)}</div>
                  <div className="tf-kpi-l">Bénéfice (Ar) — CA moins toutes les charges</div>
                </div>
                <div className="tf-kpi">
                  <div className="tf-kpi-n">{revient.toFixed(0)}</div>
                  <div className="tf-kpi-l">Prix de revient par œuf (Ar)</div>
                </div>
                <div className="tf-kpi" data-alert={prixMoyen && prixMoyen < revient ? 1 : 0}>
                  <div className="tf-kpi-n">{(prixMoyen - revient).toFixed(0)}</div>
                  <div className="tf-kpi-l">Marge par œuf (Ar)</div>
                </div>
              </div>

              <div className="tf-card">
                <div className="tf-cardhead">
                  <span className="tf-cardtitle">Détail des charges</span>
                  <span className="tf-tag">{fmt(total)} AR</span>
                </div>
                <div className="tf-ticket">
                  {lignes.map(([l, n]) => (
                    <div className="tf-ticket-row" key={l}>
                      <span>{l}</span>
                      <span>{fmt(n)} Ar · {total ? Math.round((n / total) * 100) : 0} %</span>
                    </div>
                  ))}
                </div>
                <p className="tf-note">
                  La provende et l'amortissement des poulettes pèsent normalement 75 à 85 % du coût d'un œuf.
                  Si tes charges saisies dépassent 25 %, il y a une fuite à chercher.
                </p>
              </div>

              <div className="tf-card">
                <div className="tf-cardhead"><span className="tf-cardtitle">Paramètres de coût</span></div>
                <div className="tf-fields">
                  <NumField label="Prix du kg de provende" unit="Ar" value={params.provende}
                    onOpen={() => setPad({ key: "p_provende", label: "Prix du kg de provende", unit: "Ar", value: params.provende })} />
                  <NumField label="Coût d'une poulette à l'entrée en ponte" unit="Ar" value={params.poulette}
                    onOpen={() => setPad({ key: "p_poulette", label: "Coût d'une poulette", unit: "Ar", value: params.poulette })} />
                  <NumField label="Durée de ponte prévue" unit="semaines" value={params.semaines}
                    onOpen={() => setPad({ key: "p_semaines", label: "Durée de ponte", unit: "sem", value: params.semaines })} />
                </div>
                <p className="tf-note">
                  Achat de la poulette + élevage jusqu'à la ponte, étalé sur la durée de ponte.
                  Mets à jour le prix de la provende à chaque changement de tarif fournisseur.
                </p>
              </div>
            </>
          );
        })()}

        {/* ---------------- DIRECTION ---------------- */}
        {role === "direction" && (
          <>
            <p className="tf-eyebrow">Tableau de bord</p>
            <h1 className="tf-h1">{dLabel(today())}</h1>
            <p className="tf-sub">Tout est calculé à partir des saisies de l'équipe.</p>

            <div className="tf-kpis">
              <div className="tf-kpi" data-hero="1">
                <div className="tf-kpi-n">{stats.jour.taux.toFixed(1)} %</div>
                <div className="tf-kpi-l">
                  Taux de ponte — {fmt(stats.jour.oeufs)} œufs sur {fmt(stats.enPonte)} poules en ponte
                </div>
              </div>
              <div className="tf-kpi">
                <div className="tf-kpi-n">{fmt(stats.cheptel)}</div>
                <div className="tf-kpi-l">Cheptel vivant</div>
              </div>
              <div className="tf-kpi">
                <div className="tf-kpi-n">{stats.jour.mort}</div>
                <div className="tf-kpi-l">Mortalité du jour</div>
              </div>
              <div className="tf-kpi">
                <div className="tf-kpi-n">
                  {stats.cheptel ? fmt((stats.jour.kg * 1000) / stats.cheptel) : 0}<span className="tf-unit">g</span>
                </div>
                <div className="tf-kpi-l">Provende par poule</div>
              </div>
              <div className="tf-kpi">
                <div className="tf-kpi-n">{fmt(stats.jour.valeur)}</div>
                <div className="tf-kpi-l">Valeur de la collecte (Ar)</div>
              </div>
              <div className="tf-kpi">
                <div className="tf-kpi-n">{fmt(stats.jour.valeur - stats.jour.charge)}</div>
                <div className="tf-kpi-l">Production nette des charges (Ar)</div>
              </div>
              <div className="tf-kpi">
                <div className="tf-kpi-n">{fmt(stats.jour.recette - stats.jour.charge)}</div>
                <div className="tf-kpi-l">Marge brute encaissée (Ar)</div>
              </div>
              <div className="tf-kpi">
                <div className="tf-kpi-n">{fmt(stats.jour.creance)}</div>
                <div className="tf-kpi-l">Livré à crédit aujourd'hui (Ar)</div>
              </div>
              <div className="tf-kpi" data-alert={stats.creanceTotale ? 1 : 0}>
                <div className="tf-kpi-n">{fmt(stats.creanceTotale)}</div>
                <div className="tf-kpi-l">Créances totales à recouvrer (Ar)</div>
              </div>
            </div>

            <div className="tf-card">
              <div className="tf-cardhead">
                <span className="tf-cardtitle">Taux de ponte — 7 jours</span>
                <span className="tf-tag">OBJECTIF 90 %</span>
              </div>
              <div className="tf-bars">
                {stats.days.map((d, i) => (
                  <div key={d.d} className="tf-bar" data-last={i === 6 ? 1 : 0}
                    style={{ height: `${Math.max(3, Math.min(100, d.taux))}%` }} />
                ))}
              </div>
              <div className="tf-barlabels">
                {stats.days.map((d) => (
                  <div key={d.d} className="tf-barlabel">{d.taux ? Math.round(d.taux) : "·"}</div>
                ))}
              </div>
            </div>

            <div className="tf-card">
              <div className="tf-cardhead"><span className="tf-cardtitle">Saisies du jour</span></div>
              <div className="tf-ticket">
                {entries.filter((e) => e.date === today()).length === 0 && (
                  <p className="tf-empty">Aucune saisie aujourd'hui. Les données apparaissent ici dès que l'équipe enregistre.</p>
                )}
                {entries.filter((e) => e.date === today()).map((e) => (
                  <div key={e.id} className="tf-ticket-row">
                    <span>{e.lot ? e.lot + " · " : ""}{e.libelle}</span>
                    <span>{fmt(e.oeufs || e.n)} {e.unite}</span>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </main>

      {/* ---------------- barre d'action ---------------- */}
      {role !== "direction" && role !== "creances" && role !== "bilan" && (
        <div className="tf-cta">
          <div className="tf-cta-in">
            <button className="tf-btn" disabled={!Object.entries(draft).some(([k, v]) => !k.startsWith("pay_") && v)}
              onClick={() => {
                if (role === "ferme") {
                  const rows = [];
                  if (val("kg")) rows.push({ type: "provende", lot, n: val("kg"), libelle: "Provende", unite: "kg" });
                  if (val("mort")) rows.push({ type: "mortalite", lot, n: val("mort"), libelle: "Mortalité", unite: "têtes" });
                  CATEGORIES.forEach((c) => {
                    if (val("ch_" + c.k)) rows.push({ type: "charge", n: val("ch_" + c.k), libelle: c.l, unite: "Ar" });
                  });
                  commit(rows, "Saisie ferme enregistrée.");
                } else if (role === "magasin") {
                  const o = oeufsDraft;
                  const rows = o || val("casse") || val("sale") ? [{
                    type: "ponte", oeufs: o, degats: val("casse") + val("sale"), valeur: valeurDraft,
                    tailles: Object.fromEntries(CALIBRES.filter((c) => val("c" + c)).map((c) => [c, val("c" + c)])),
                    libelle: `Ponte ${alvDraft} alv`, unite: "œufs",
                  }] : [];
                  commit(rows, "Fiche de ponte enregistrée.");
                } else {
                  const rows = [];
                  CLIENTS.forEach((cl) => CALIBRES.forEach((c) => {
                    const alv = val(`v_${cl.k}_${c}`);
                    if (alv) rows.push({
                      type: "vente", client: cl.l, taille: c, alv, pu: prixClient(cl, c),
                      credit: !paye(cl.k), n: alv * ALV * prixClient(cl, c),
                      libelle: `${cl.l} · ${c} · ${alv} alv${paye(cl.k) ? "" : " · CRÉDIT"}`, unite: "Ar",
                    });
                  }));
                  if (val("rec")) rows.push({ type: "vente", n: val("rec"), libelle: "Recette caisse", unite: "Ar" });
                  if (val("cred")) rows.push({ type: "credit", n: val("cred"), libelle: "Vendu à crédit", unite: "Ar" });
                  if (val("chgv")) rows.push({ type: "charge", n: val("chgv"), libelle: "Charges point de vente", unite: "Ar" });
                  commit(rows, "Caisse clôturée.");
                }
              }}>
              Enregistrer
            </button>
            <button className="tf-btn tf-btn-ghost" onClick={() => setDraft({})}>Effacer</button>
          </div>
        </div>
      )}

      {flash && <div className="tf-flash">{flash}</div>}
      <Keypad field={pad} onChange={setPadVal} onClose={() => setPad(null)} />
    </div>
  );
}
