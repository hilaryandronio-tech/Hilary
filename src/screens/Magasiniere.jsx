import { useEffect, useMemo, useState } from "react";
import Header from "../components/Header";
import NumField from "../components/NumField";
import Keypad from "../components/Keypad";
import DateSelector from "../components/DateSelector";
import ReleveCollecte from "../components/ReleveCollecte";
import { fmt, today, dLabel } from "../components/format";
import { ALV, CALIBRES } from "../data/constants";
import { enqueue, idStable } from "../lib/offlineQueue";
import { useLotsEnPonte } from "../lib/useLotsEnPonte";
import { useAuth } from "../context/AuthContext";

export default function Magasiniere() {
  const { profil } = useAuth();
  const lots = useLotsEnPonte();
  const [lotId, setLotId] = useState(lots[0]?.id ?? null);
  const [date, setDate] = useState(today());
  const [draft, setDraft] = useState({});
  const [pad, setPad] = useState(null);
  const [flash, setFlash] = useState("");
  const [dejaEnregistre, setDejaEnregistre] = useState(false);

  // Le bâtiment sélectionné doit rester dans la liste chargée depuis Supabase :
  // sinon on saisirait sur un bâtiment qui n'est plus en ponte.
  useEffect(() => {
    setLotId((id) => (lots.some((l) => l.id === id) ? id : lots[0]?.id ?? null));
  }, [lots]);

  const val = (k) => draft[k] || 0;
  const open = (k, label, unit) => setPad({ key: k, label, unit, value: val(k) });
  const setPadVal = (v) => {
    setDraft({ ...draft, [pad.key]: v });
    setPad({ ...pad, value: v });
    setDejaEnregistre(false);
  };

  const lot = lots.find((l) => l.id === lotId) ?? lots[0];
  const alvDraft = useMemo(() => CALIBRES.reduce((s, c) => s + val("c" + c), 0), [draft]);
  // Collecte au détail (en œufs, pas forcément un multiple de 30) — distinct
  // de la grille en alvéoles, qui reste le mode de saisie habituel.
  const detailOeufsDraft = useMemo(() => CALIBRES.reduce((s, c) => s + val("d" + c), 0), [draft]);
  // Les cassés se vendent (500 Ar) donc comptent dans le total et le taux de
  // ponte, contrairement aux sales/fêlés qui restent un pur dégât (prix à 0).
  const oeufsDraft = alvDraft * ALV + detailOeufsDraft + val("casse");
  const tauxPonte = lot?.vivant ? (oeufsDraft / lot.vivant) * 100 : 0;

  const peutEnregistrer = !dejaEnregistre && (oeufsDraft > 0 || val("casse") > 0 || val("sale") > 0);

  // Une exception ici interrompait la fonction sans un mot : pas de ligne en
  // file, donc pas de badge non plus, et la fiche semblait enregistrée alors
  // que rien n'était parti. Toute panne doit se voir à l'écran.
  const enregistrer = async () => {
    try {
      await poserEnFile();
    } catch (e) {
      console.error("Enregistrement interrompu", e);
      setFlash(`Enregistrement impossible : ${e.message}. Note tes chiffres avant de quitter l'écran.`);
      setTimeout(() => setFlash(""), 10000);
    }
  };

  const poserEnFile = async () => {
    const auteur = profil?.id;

    // Un seul en-tête pontes par (date, bâtiment) — la grille alvéoles et la
    // collecte au détail alimentent les mêmes lignes, sommées par calibre,
    // sinon deux en-têtes le même jour pour le même bâtiment violeraient la
    // contrainte d'unicité de la table.
    //
    // L'identifiant se déduit de (date, bâtiment) : ré-enregistrer une fiche
    // corrige celle du jour au lieu d'être rejetée par cette contrainte. Les
    // lignes partent toutes, y compris à zéro, sans quoi un calibre saisi par
    // erreur puis retiré resterait dans la fiche corrigée.
    const ponteId = idStable("ponte", date, lotId);
    // Les cassés se vendent (500 Ar), donc comptent aussi comme production —
    // pas seulement comme dégât — en plus de rester dans oeufs_casses ci-dessous.
    const lignes = [
      ...CALIBRES.map((c) => ({ calibre: c, oeufs: val("c" + c) * ALV + val("d" + c) })),
      { calibre: "CASSE", oeufs: val("casse") },
    ];

    // En file d'attente l'un après l'autre : les lignes portent une clé
    // étrangère vers l'en-tête, elles doivent partir après lui.
    await enqueue({
      table: "pontes",
      conflict: "id",
      groupe: ponteId,
      payload: { id: ponteId, date, lot_id: lotId, oeufs_casses: val("casse"), oeufs_sales: val("sale"), auteur },
    });
    await enqueue({
      table: "ponte_lignes",
      conflict: "ponte_id,calibre",
      groupe: ponteId,
      payload: lignes.map((l) => ({ ponte_id: ponteId, calibre: l.calibre, oeufs: l.oeufs })),
    });

    setDejaEnregistre(true);
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

        <DateSelector value={date} onChange={(d) => { setDate(d); setDraft({}); setDejaEnregistre(false); }} />

        <div className="tf-lots">
          {lots.map((l) => (
            <button key={l.id} className="tf-lot" data-on={lotId === l.id ? 1 : 0}
              onClick={() => { setLotId(l.id); setDraft({}); setDejaEnregistre(false); }}>
              <div className="tf-lot-id">{l.id}</div>
              <div className="tf-lot-m">{fmt(l.vivant)}</div>
            </button>
          ))}
        </div>

        <ReleveCollecte date={date} lots={lots} />

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
          <button className="tf-btn" disabled={!peutEnregistrer} onClick={enregistrer}>
            {dejaEnregistre ? "Enregistré" : "Enregistrer"}
          </button>
          <button className="tf-btn tf-btn-ghost" onClick={() => { setDraft({}); setDejaEnregistre(false); }}>Effacer</button>
        </div>
      </div>

      {flash && <div className="tf-flash">{flash}</div>}
      <Keypad field={pad} onChange={setPadVal} onClose={() => setPad(null)} />
    </div>
  );
}
