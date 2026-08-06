import { useEffect, useMemo, useRef, useState } from "react";
import Header from "../components/Header";
import NumField from "../components/NumField";
import Keypad from "../components/Keypad";
import DateSelector from "../components/DateSelector";
import { fmt, today, dLabel } from "../components/format";
import { ALV, CALIBRES, SEED_LOTS } from "../data/constants";
import { supabase } from "../lib/supabaseClient";
import { enqueue, idStable, onQueueChange, operationsEnAttente } from "../lib/offlineQueue";
import { useAuth } from "../context/AuthContext";

const enPonteSeed = SEED_LOTS.filter((l) => l.en_ponte).map((l) => ({ id: l.id, nom: l.nom, vivant: l.effectif_initial }));

// Les cassés se vendent, donc ils figurent au relevé au même titre qu'un
// calibre — contrairement aux sales/fêlés, qui restent un pur dégât.
const LIGNES_RELEVE = [...CALIBRES, "CASSE"];
const libelleLigne = (c) => (c === "CASSE" ? "Cassés" : c);

export default function Magasiniere() {
  const { profil } = useAuth();
  const [lots, setLots] = useState(enPonteSeed);
  const [lotId, setLotId] = useState(enPonteSeed[0]?.id ?? null);
  const [date, setDate] = useState(today());
  const [draft, setDraft] = useState({});
  const [pad, setPad] = useState(null);
  const [flash, setFlash] = useState("");
  const [dejaEnregistre, setDejaEnregistre] = useState(false);

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

  // Ce qui est déjà collecté ce jour-là, calibre par calibre et bâtiment par
  // bâtiment, vient de deux sources qu'il faut additionner :
  //   - `serveur` : ce que Supabase a enregistré ;
  //   - `file`    : ce qui est saisi mais attend la synchro.
  // Ignorer la seconde — ce que faisait cet écran — c'est afficher un total
  // qui ne bouge pas quand la magasinière vient d'enregistrer hors ligne.
  const [serveur, setServeur] = useState({}); // { [lot_id]: { [calibre]: oeufs } }
  const [file, setFile] = useState({});
  const requete = useRef(0);

  const chargerServeur = async (jeton) => {
    const { data, error } = await supabase
      .from("pontes")
      .select("lot_id, ponte_lignes(calibre, oeufs)")
      .eq("date", date)
      .not("lot_id", "is", null);
    // Deux requêtes lancées coup sur coup peuvent revenir dans le désordre :
    // seule la dernière demandée a le droit d'écrire dans l'état.
    if (jeton !== requete.current) return;
    if (error || !data) return; // hors ligne : on garde ce qu'on savait déjà
    const parLot = {};
    data.forEach((p) => {
      const lignes = (parLot[p.lot_id] ??= {});
      (p.ponte_lignes ?? []).forEach((l) => {
        lignes[l.calibre] = (lignes[l.calibre] ?? 0) + l.oeufs;
      });
    });
    setServeur(parLot);
  };

  const chargerFile = async () => {
    const [entetes, lignes] = await Promise.all([
      operationsEnAttente("pontes"),
      operationsEnAttente("ponte_lignes"),
    ]);
    // L'en-tête porte la date et le bâtiment, les lignes n'ont que ponte_id.
    const lotParPonte = {};
    entetes.forEach((op) => {
      if (op.payload?.date === date) lotParPonte[op.payload.id] = op.payload.lot_id;
    });
    const parLot = {};
    lignes.forEach((op) => {
      [].concat(op.payload).forEach((l) => {
        const lotId = lotParPonte[l.ponte_id];
        if (!lotId) return;
        // Ces écritures sont des upsert : à la synchro elles remplaceront la
        // valeur du serveur pour ce calibre, pas s'y ajouter.
        (parLot[lotId] ??= {})[l.calibre] = l.oeufs;
      });
    });
    setFile(parLot);
  };

  useEffect(() => {
    const jeton = ++requete.current;
    setServeur({}); // sinon, hors ligne, les chiffres de la veille restent sous la nouvelle date
    setFile({});
    const relire = () => { chargerServeur(jeton); chargerFile(); };
    relire();
    // se rafraîchit aussi quand la file bouge (saisie ajoutée, sync qui rattrape)
    return onQueueChange(relire);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date]);

  const collecte = useMemo(() => {
    const fusion = {};
    for (const lotId of new Set([...Object.keys(serveur), ...Object.keys(file)])) {
      fusion[lotId] = { ...serveur[lotId], ...file[lotId] };
    }
    return fusion;
  }, [serveur, file]);
  const totalLot = (lotId) => Object.values(collecte[lotId] ?? {}).reduce((s, n) => s + n, 0);
  const totalGeneral = lots.reduce((s, l) => s + totalLot(l.id), 0);
  const enAttente = Object.keys(file).length > 0;

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

  const enregistrer = async () => {
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
    const ponteId = await idStable("ponte", date, lotId);
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

        {lots.length > 0 && (
          <div className="tf-card">
            <div className="tf-cardhead">
              <span className="tf-cardtitle">Œufs collectés · {lots.map((l) => l.id).join(" + ")}</span>
              <span className="tf-tag">{date === today() ? "AUJOURD'HUI" : dLabel(date).toUpperCase()}</span>
            </div>
            {/* Tous les calibres sont listés, même à zéro : à position fixe d'un
                jour sur l'autre, un calibre oublié se repère d'un coup d'œil. */}
            <div className="tf-releve-cadre">
            <table className="tf-releve">
              <thead>
                <tr>
                  <th>Calibre</th>
                  {lots.map((l) => <th key={l.id}>{l.id}</th>)}
                  <th>Total</th>
                </tr>
              </thead>
              <tbody>
                {LIGNES_RELEVE.map((c) => {
                  const parLot = lots.map((l) => collecte[l.id]?.[c] ?? 0);
                  const total = parLot.reduce((s, n) => s + n, 0);
                  return (
                    <tr key={c}>
                      <th>{libelleLigne(c)}</th>
                      {parLot.map((n, i) => <td key={lots[i].id}>{fmt(n)}</td>)}
                      <td>{fmt(total)}</td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr>
                  <th>Total œufs</th>
                  {lots.map((l) => <td key={l.id}>{fmt(totalLot(l.id))}</td>)}
                  <td>{fmt(totalGeneral)}</td>
                </tr>
              </tfoot>
            </table>
            </div>
            <div className="tf-live">
              <span className="tf-live-n">{fmt(totalGeneral)}</span>
              <span className="tf-live-l">œufs déjà enregistrés, tous bâtiments confondus</span>
            </div>
            {enAttente && (
              <p className="tf-note">Les saisies pas encore synchronisées sont comprises dans ces chiffres.</p>
            )}
          </div>
        )}

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
