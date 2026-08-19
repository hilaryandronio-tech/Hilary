import { useEffect, useState } from "react";
import NumField from "./NumField";
import Keypad from "./Keypad";
import { fmt } from "./format";
import { enqueue, onQueueChange, operationsEnAttente } from "../lib/offlineQueue";
import { lireEffectifs } from "../lib/effectifs";

// L'effectif vivant n'est pas stocké : la vue v_effectif le calcule comme
// `effectif_initial - mortalité cumulée`. Pour que la direction saisisse
// directement le nombre de poules réellement comptées, on remonte le calcul et
// on écrit dans `effectif_initial` la valeur qui redonnera ce vivant-là,
// mortalité déjà enregistrée comprise.
//
// Conséquence à connaître : après un comptage, `effectif_initial` ne désigne
// plus l'effectif du jour de la mise en place mais un point de départ
// recalculé. C'est le prix à payer pour corriger un cheptel sans toucher aux
// saisies de mortalité, qui sont des faits datés et ne doivent pas bouger.
export default function Cheptel() {
  const [lots, setLots] = useState([]);
  const [pad, setPad] = useState(null);
  const [flash, setFlash] = useState("");

  // Le rechargement se déclenche à chaque mouvement de la file, y compris sur
  // les écritures que cette carte vient d'émettre. Sans réappliquer ce qui est
  // encore en attente, il ramènerait la valeur du serveur et effacerait la
  // modification sous les yeux de la direction — visible seulement à la
  // synchro, donc jamais hors ligne.
  const charger = async () => {
    const [{ lots: data }, enAttente] = await Promise.all([
      lireEffectifs(),
      operationsEnAttente("lots"),
    ]);
    if (!data) return;
    const corrections = {};
    enAttente.forEach((op) => {
      if (op.kind === "update" && op.match?.id) {
        corrections[op.match.id] = { ...corrections[op.match.id], ...op.payload };
      }
    });
    setLots(
      data.map((l) => {
        const c = corrections[l.lot_id];
        if (!c) return l;
        // `effectif_initial` corrigé : le vivant s'en déduit, mortalité
        // cumulée déjà enregistrée comprise.
        const initial = c.effectif_initial ?? l.effectif_initial;
        const morts = l.effectif_initial - l.vivant;
        return { ...l, ...c, effectif_initial: initial, vivant: initial - morts };
      })
    );
  };

  useEffect(() => {
    charger();
    return onQueueChange(charger);
  }, []);

  const enregistrer = async (lotId, vivantVoulu) => {
    const lot = lots.find((l) => l.lot_id === lotId);
    if (!lot) return;
    const mortaliteCumulee = lot.effectif_initial - lot.vivant;
    const nouvelInitial = vivantVoulu + mortaliteCumulee;
    // `lots.effectif_initial` porte un check > 0 : un cheptel à zéro serait
    // refusé par la base. On le dit ici plutôt que de laisser l'écriture partir.
    if (nouvelInitial <= 0) {
      setFlash("L'effectif doit rester supérieur à zéro.");
      setTimeout(() => setFlash(""), 3000);
      return;
    }
    setLots((ls) =>
      ls.map((l) =>
        l.lot_id === lotId ? { ...l, vivant: vivantVoulu, effectif_initial: nouvelInitial } : l
      )
    );
    await enqueue({
      table: "lots",
      kind: "update",
      payload: { effectif_initial: nouvelInitial },
      match: { id: lotId },
    });
    setFlash(`${lotId} : ${fmt(vivantVoulu)} poules vivantes.`);
    setTimeout(() => setFlash(""), 2600);
  };

  // Le tarif du fournisseur pour ce bâtiment. Il ne touche pas aux saisies
  // déjà enregistrées : celles-ci ont figé leur prix le soir même.
  const enregistrerPrix = async (lotId, prix) => {
    setLots((ls) => ls.map((l) => (l.lot_id === lotId ? { ...l, prix_provende_kg: prix } : l)));
    await enqueue({
      table: "lots",
      kind: "update",
      payload: { prix_provende_kg: prix },
      match: { id: lotId },
    });
    setFlash(`${lotId} : provende à ${fmt(prix)} Ar/kg.`);
    setTimeout(() => setFlash(""), 2600);
  };

  // L'entrée en ponte d'une vague, vers 18-20 semaines. C'est ce réglage qui
  // fait apparaître le bâtiment chez la magasinière et qui le compte au
  // dénominateur du taux de ponte.
  const basculerPonte = async (lot, enPonte) => {
    if (lot.en_ponte === enPonte) return;
    setLots((ls) => ls.map((l) => (l.lot_id === lot.lot_id ? { ...l, en_ponte: enPonte } : l)));
    await enqueue({
      table: "lots",
      kind: "update",
      payload: { en_ponte: enPonte },
      match: { id: lot.lot_id },
    });
    setFlash(
      enPonte
        ? `${lot.lot_id} passe en ponte — la magasinière peut saisir sa collecte.`
        : `${lot.lot_id} repasse en poulettes — sa collecte n'est plus saisissable.`
    );
    setTimeout(() => setFlash(""), 4000);
  };

  const ouvrir = (lot) =>
    setPad({
      champ: "vivant",
      key: lot.lot_id,
      label: `${lot.lot_id} — poules vivantes`,
      unit: "poules",
      value: lot.vivant,
      depart: lot.vivant,
    });

  const ouvrirPrix = (lot) =>
    setPad({
      champ: "prix",
      key: lot.lot_id,
      label: `${lot.lot_id} — provende, prix du kilo`,
      unit: "Ar/kg",
      value: lot.prix_provende_kg ?? 0,
      depart: lot.prix_provende_kg ?? 0,
    });

  const fermer = () => {
    if (pad && pad.value !== pad.depart) {
      if (pad.champ === "prix") enregistrerPrix(pad.key, pad.value);
      else enregistrer(pad.key, pad.value);
    }
    setPad(null);
  };

  return (
    <div className="tf-card">
      <div className="tf-cardhead">
        <span className="tf-cardtitle">Cheptel par bâtiment</span>
        <span className="tf-tag">{fmt(lots.reduce((s, l) => s + l.vivant, 0))} POULES</span>
      </div>

      {lots.length === 0 ? (
        <p className="tf-empty">Bâtiments non chargés — vérifie la connexion.</p>
      ) : (
        <div className="tf-fields">
          {lots.map((l) => (
            <div className="tf-batiment" key={l.lot_id}>
              <div className="tf-grid2">
                <NumField
                  label={`${l.lot_id} · ${l.nom}`}
                  unit="poules"
                  value={l.vivant}
                  detail={
                    l.effectif_initial - l.vivant > 0
                      ? `${fmt(l.effectif_initial - l.vivant)} mortes`
                      : null
                  }
                  onOpen={() => ouvrir(l)}
                />
                <NumField
                  label="Provende"
                  unit="Ar/kg"
                  value={l.prix_provende_kg ?? 0}
                  detail={null}
                  onOpen={() => ouvrirPrix(l)}
                />
              </div>
              {/* Sans ce réglage, l'entrée en ponte d'une vague se ferait en
                  SQL — et personne n'y penserait le jour venu. Un bâtiment
                  qui n'est pas en ponte n'apparaît pas chez la magasinière :
                  tant qu'il n'est pas basculé, sa collecte est insaisissable. */}
              <div className="tf-toggle">
                <button className="tf-chip" data-on={l.en_ponte ? 1 : 0}
                  onClick={() => basculerPonte(l, true)}>En ponte</button>
                <button className="tf-chip" data-on={!l.en_ponte ? 1 : 0}
                  onClick={() => basculerPonte(l, false)}>Poulettes</button>
              </div>
            </div>
          ))}
        </div>
      )}

      <p className="tf-note">
        Saisis le nombre de poules réellement comptées dans le bâtiment. La mortalité déjà
        enregistrée reste déduite pour les jours suivants — un comptage corrige l'écart accumulé,
        il n'efface pas les saisies du chef de ferme.
        Le <strong>prix de la provende</strong> vaut par bâtiment, les vagues n'ayant ni le même
        aliment ni le même tarif ; le changer n'affecte que les saisies à venir, les précédentes
        ont figé leur prix le soir même.
        Bascule un bâtiment <strong>en ponte</strong> le jour où la vague commence à pondre, vers
        18 à 20 semaines : tant qu'il reste en poulettes, il n'apparaît pas chez la magasinière et
        sa collecte ne peut pas être saisie.
      </p>

      {flash && <div className="tf-flash">{flash}</div>}
      <Keypad field={pad} onChange={(v) => setPad({ ...pad, value: v })} onClose={fermer} />
    </div>
  );
}
