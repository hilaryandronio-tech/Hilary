import { useEffect, useMemo, useState } from "react";
import Header from "../components/Header";
import NumField from "../components/NumField";
import Keypad from "../components/Keypad";
import DateSelector from "../components/DateSelector";
import { fmt, today, dLabel } from "../components/format";
import { SEED_LOTS, CATEGORIES_CHARGES } from "../data/constants";
import { supabase } from "../lib/supabaseClient";
import { enqueue, idStable } from "../lib/offlineQueue";
import { useAuth } from "../context/AuthContext";

// Reference port of the prototype's Chef de ferme screen (docs/tama-app.jsx)
// onto Supabase + the offline write queue. The other five screens still need
// the same treatment — this one shows the pattern: fetch reference/view data
// with a local fallback, keep the draft in memory, submit through enqueue()
// instead of calling supabase directly.
export default function ChefFerme() {
  const { profil } = useAuth();
  const [lots, setLots] = useState(SEED_LOTS.map((l) => ({ ...l, vivant: l.effectif_initial })));
  const [lotId, setLotId] = useState(profil?.lot_id ?? SEED_LOTS[0].id);
  const [date, setDate] = useState(today());
  const [draft, setDraft] = useState({});
  const [pad, setPad] = useState(null);
  const [flash, setFlash] = useState("");

  useEffect(() => {
    supabase
      .from("v_effectif")
      .select("lot_id, nom, en_ponte, vivant")
      .then(({ data, error }) => {
        if (error || !data) return; // hors ligne : on garde le seed local
        setLots(data.map((l) => ({ id: l.lot_id, nom: l.nom, en_ponte: l.en_ponte, vivant: l.vivant })));
      });
  }, []);

  const val = (k) => draft[k] || 0;
  const open = (k, label, unit) => setPad({ key: k, label, unit, value: val(k) });
  const setPadVal = (v) => {
    setDraft({ ...draft, [pad.key]: v });
    setPad({ ...pad, value: v });
  };

  const lot = lots.find((l) => l.id === lotId) ?? lots[0];
  const totalCharges = useMemo(
    () => CATEGORIES_CHARGES.reduce((s, c) => s + val("ch_" + c), 0),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [draft]
  );
  const grammesParPoule = val("kg") && lot?.vivant ? (val("kg") * 1000) / lot.vivant : 0;

  const peutEnregistrer = Object.values(draft).some(Boolean);

  const enregistrer = async () => {
    const auteur = profil?.id;
    const jobs = [];

    if (val("kg") || val("mort")) {
      // La table n'accepte qu'une saisie par (date, bâtiment). En dérivant
      // l'identifiant de ce couple, ressaisir le même soir corrige la ligne
      // au lieu de buter sur la contrainte d'unicité.
      const saisieId = await idStable("saisie_ferme", date, lotId);
      jobs.push(
        enqueue({
          table: "saisies_ferme",
          conflict: "id",
          payload: { id: saisieId, date, lot_id: lotId, provende_kg: val("kg"), mortalite: val("mort"), auteur },
        })
      );
    }
    for (const c of CATEGORIES_CHARGES) {
      if (val("ch_" + c)) {
        // Identifiant tiré au sort à chaque enregistrement, et non déduit de
        // (date, catégorie) : rien n'interdit deux dépenses de carburant le
        // même jour. L'identifiant sert juste à ce qu'une re-synchro rejoue
        // la même ligne au lieu d'en créer une deuxième.
        jobs.push(
          enqueue({
            table: "charges",
            conflict: "id",
            payload: { id: crypto.randomUUID(), date, categorie: c, montant: val("ch_" + c), origine: "ferme", auteur },
          })
        );
      }
    }
    await Promise.all(jobs);
    setDraft({});
    setFlash(date === today() ? "Saisie enregistrée." : `Saisie enregistrée pour le ${dLabel(date)}.`);
    setTimeout(() => setFlash(""), 2600);
  };

  return (
    <div className="tf">
      <Header />
      <main className="tf-body">
        <p className="tf-eyebrow">Saisie du soir · 30 secondes</p>
        <h1 className="tf-h1">Provende, mortalité, charges</h1>
        <p className="tf-sub">Choisis le bâtiment, tape les chiffres, enregistre.</p>

        <DateSelector value={date} onChange={(d) => { setDate(d); setDraft({}); }} />

        <div className="tf-lots">
          {lots.map((l) => (
            <button key={l.id} className="tf-lot" data-on={lotId === l.id ? 1 : 0}
              onClick={() => { setLotId(l.id); setDraft({}); }}>
              <div className="tf-lot-id">{l.id}</div>
              <div className="tf-lot-m">{fmt(l.vivant)}</div>
            </button>
          ))}
        </div>

        <div className="tf-card">
          <div className="tf-cardhead">
            <span className="tf-cardtitle">{lot?.id} — {date === today() ? "aujourd'hui" : dLabel(date)}</span>
            <span className="tf-tag">{lot?.en_ponte ? "EN PONTE" : "POULETTES"}</span>
          </div>
          <div className="tf-grid2">
            <NumField label="Provende" unit="kg" value={val("kg")} onOpen={() => open("kg", "Provende distribuée", "kg")} />
            <NumField label="Mortalité" unit="têtes" tone="brick" value={val("mort")} onOpen={() => open("mort", "Mortalité du jour", "têtes")} />
          </div>
          <div className="tf-live">
            <span className="tf-live-n">{grammesParPoule ? fmt(grammesParPoule) : "—"}</span>
            <span className="tf-live-l">grammes par poule · norme 110–125 g</span>
          </div>
        </div>

        <div className="tf-card">
          <div className="tf-cardhead">
            <span className="tf-cardtitle">Charges ferme</span>
            <span className="tf-tag">{CATEGORIES_CHARGES.filter((c) => val("ch_" + c)).length} / {CATEGORIES_CHARGES.length}</span>
          </div>
          <div className="tf-cats">
            {CATEGORIES_CHARGES.map((c) => (
              <NumField key={c} label={c} unit="Ar" value={val("ch_" + c)} onOpen={() => open("ch_" + c, c, "Ar")} />
            ))}
          </div>
          <div className="tf-live">
            <span className="tf-live-n">{fmt(totalCharges)}</span>
            <span className="tf-live-l">Ar de charges aujourd'hui</span>
          </div>
          <p className="tf-note">Laisse à zéro les postes sans dépense aujourd'hui. Seules les catégories remplies sont enregistrées.</p>
        </div>
      </main>

      <div className="tf-cta">
        <div className="tf-cta-in">
          <button className="tf-btn" disabled={!peutEnregistrer} onClick={enregistrer}>Enregistrer</button>
          <button className="tf-btn tf-btn-ghost" onClick={() => setDraft({})}>Effacer</button>
        </div>
      </div>

      {flash && <div className="tf-flash">{flash}</div>}
      <Keypad field={pad} onChange={setPadVal} onClose={() => setPad(null)} />
    </div>
  );
}
