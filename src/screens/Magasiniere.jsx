import { useEffect, useMemo, useState } from "react";
import Header from "../components/Header";
import NumField from "../components/NumField";
import Keypad from "../components/Keypad";
import DateSelector from "../components/DateSelector";
import { fmt, today, dLabel } from "../components/format";
import { ALV, CALIBRES, SEED_LOTS } from "../data/constants";
import { supabase } from "../lib/supabaseClient";
import { enqueue } from "../lib/offlineQueue";
import { useAuth } from "../context/AuthContext";

const enPonteSeed = SEED_LOTS.filter((l) => l.en_ponte).map((l) => ({ id: l.id, nom: l.nom, vivant: l.effectif_initial }));

export default function Magasiniere() {
  const { profil } = useAuth();
  const [lots, setLots] = useState(enPonteSeed);
  const [lotId, setLotId] = useState(enPonteSeed[0]?.id ?? null);
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
        const enPonte = data.filter((l) => l.en_ponte).map((l) => ({ id: l.lot_id, nom: l.nom, vivant: l.vivant }));
        setLots(enPonte);
        setLotId((id) => (enPonte.some((l) => l.id === id) ? id : enPonte[0]?.id ?? null));
      });
  }, []);

  const val = (k) => draft[k] || 0;
  const open = (k, label, unit) => setPad({ key: k, label, unit, value: val(k) });
  const setPadVal = (v) => {
    setDraft({ ...draft, [pad.key]: v });
    setPad({ ...pad, value: v });
  };

  const lot = lots.find((l) => l.id === lotId) ?? lots[0];
  const alvDraft = useMemo(() => CALIBRES.reduce((s, c) => s + val("c" + c), 0), [draft]);
  // Collecte au détail (en œufs, pas forcément un multiple de 30) — distinct
  // de la grille en alvéoles, qui reste le mode de saisie habituel.
  const detailOeufsDraft = useMemo(() => CALIBRES.reduce((s, c) => s + val("d" + c), 0), [draft]);
  const oeufsDraft = alvDraft * ALV + detailOeufsDraft;
  const tauxPonte = lot?.vivant ? (oeufsDraft / lot.vivant) * 100 : 0;

  const peutEnregistrer = oeufsDraft > 0 || val("casse") > 0 || val("sale") > 0;

  const enregistrer = async () => {
    const auteur = profil?.id;
    const jobs = [];

    // Un seul en-tête pontes par (date, bâtiment) — la grille alvéoles et la
    // collecte au détail alimentent les mêmes lignes, sommées par calibre,
    // sinon deux en-têtes le même jour pour le même bâtiment violeraient la
    // contrainte d'unicité de la table.
    const lignes = CALIBRES.map((c) => ({ calibre: c, oeufs: val("c" + c) * ALV + val("d" + c) }))
      .filter((l) => l.oeufs > 0);

    if (lignes.length || val("casse") || val("sale")) {
      const ponteId = crypto.randomUUID();
      jobs.push(
        enqueue({
          table: "pontes",
          payload: { id: ponteId, date, lot_id: lotId, oeufs_casses: val("casse"), oeufs_sales: val("sale"), auteur },
        })
      );
      if (lignes.length) {
        jobs.push(
          enqueue({
            table: "ponte_lignes",
            payload: lignes.map((l) => ({ ponte_id: ponteId, calibre: l.calibre, oeufs: l.oeufs })),
          })
        );
      }
    }

    await Promise.all(jobs);
    setDraft({});
    setFlash(date === today() ? "Fiche de ponte enregistrée." : `Fiche de ponte enregistrée pour le ${dLabel(date)}.`);
    setTimeout(() => setFlash(""), 2600);
  };

  return (
    <div className="tf">
      <Header />
      <main className="tf-body">
        <p className="tf-eyebrow">Fiche de ponte · en alvéoles</p>
        <h1 className="tf-h1">Collecte par calibre</h1>
        <p className="tf-sub">Choisis le bâtiment, compte en alvéoles de 30. La conversion en œufs est automatique.</p>

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
            <span className="tf-cardtitle">{lot?.id ?? "—"} — alvéoles collectées</span>
            <span className="tf-tag">1 ALV = 30 ŒUFS</span>
          </div>
          <div className="tf-grid4">
            {CALIBRES.map((c) => (
              <NumField key={c} label={c} unit="alv" value={val("c" + c)}
                detail={val("c" + c) ? `${fmt(val("c" + c) * ALV)} œufs` : null}
                onOpen={() => open("c" + c, `Taille ${c}`, "alv")} />
            ))}
          </div>
          <div className="tf-live">
            <span className="tf-live-n">{fmt(oeufsDraft)}</span>
            <span className="tf-live-l">
              œufs · taux de ponte {lot?.vivant ? tauxPonte.toFixed(1) : "—"} %
            </span>
          </div>
        </div>

        <div className="tf-card">
          <div className="tf-cardhead">
            <span className="tf-cardtitle">Collecte au détail</span>
            <span className="tf-tag">EN ŒUFS</span>
          </div>
          <div className="tf-grid4">
            {CALIBRES.map((c) => (
              <NumField key={c} label={c} unit="œufs" value={val("d" + c)}
                onOpen={() => open("d" + c, `Taille ${c}`, "œufs")} />
            ))}
          </div>
          <p className="tf-note">Pour compter des œufs hors alvéole complète — ramassage partiel, casier entamé.</p>
        </div>

        <div className="tf-card">
          <div className="tf-cardhead"><span className="tf-cardtitle">Dégâts</span></div>
          <div className="tf-grid2">
            <NumField label="Cassés" unit="œufs" tone="brick" value={val("casse")} onOpen={() => open("casse", "Œufs cassés", "œufs")} />
            <NumField label="Sales / fêlés" unit="œufs" tone="brick" value={val("sale")} onOpen={() => open("sale", "Œufs sales ou fêlés", "œufs")} />
          </div>
          <p className="tf-note">Au-delà de 2 % de la collecte, il y a un problème de nid, de ramassage ou de calcium.</p>
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
