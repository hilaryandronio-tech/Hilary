import { useEffect, useMemo, useRef, useState } from "react";
import { fmt, today, dLabel } from "./format";
import { CALIBRES, POIDS } from "../data/constants";
import { supabase } from "../lib/supabaseClient";
import { enqueue, onQueueChange, operationsEnAttente } from "../lib/offlineQueue";
import AlerteEchecs from "./AlerteEchecs";

const TABLES = ["ventes", "vente_lignes"];

// Les œufs vendus dans la journée, calibre par calibre, en face du relevé de
// collecte : ce qui est rentré d'un côté, ce qui est sorti de l'autre.

const LIGNES = [...CALIBRES, "CASSE"];
const libelle = (c) => (c === "CASSE" ? "Cassés" : c);
const CANAUX = [
  { code: "client", nom: "Clients" },
  { code: "detail", nom: "Détail" },
];

const vide = () => ({ client: {}, detail: {} });

export default function ReleveVentes({ date }) {
  const [serveur, setServeur] = useState([]);
  const [file, setFile] = useState(vide);
  // Les ventes saisies en montant global (recette du jour, crédit) n'ont pas
  // de détail par calibre : elles pèsent en ariary, pas en œufs. Sans le dire,
  // le relevé passerait pour incomplet. Comptées des deux côtés, sinon la
  // mention disparaîtrait hors ligne, quand tout est encore en file.
  const [globalesFile, setGlobalesFile] = useState({ nombre: 0, montant: 0 });
  // Les suppressions encore en file. Une vente supprimée doit quitter les
  // totaux tout de suite, sans attendre le réseau : hors ligne, l'opération
  // peut rester en attente des heures, et laisser la ligne à l'écran ferait
  // croire que le bouton n'a rien fait.
  const [aSupprimer, setASupprimer] = useState(() => new Set());
  const requete = useRef(0);

  const chargerServeur = async (jeton) => {
    const { data, error } = await supabase
      .from("ventes")
      .select("id, canal, montant, credit, clients(nom), vente_lignes(calibre, oeufs), reglements(montant)")
      .eq("date", date);
    // Seule la dernière requête demandée a le droit d'écrire dans l'état.
    if (jeton !== requete.current) return { ids: new Set() };
    if (error || !data) return { ids: new Set() }; // hors ligne : on garde ce qu'on savait
    setServeur(data);
    return { ids: new Set(data.map((v) => v.id)) };
  };

  const chargerFile = async (dejaSurLeServeur) => {
    const [entetes, lignes] = await Promise.all([
      operationsEnAttente("ventes"),
      operationsEnAttente("vente_lignes"),
    ]);
    setASupprimer(
      new Set(entetes.filter((op) => op.kind === "delete").map((op) => op.match?.id))
    );
    // Une vente porte un identifiant tiré au sort à la saisie : contrairement
    // à une fiche de ponte, elle s'ajoute au serveur au lieu de le corriger.
    // D'où le garde-fou : si la ligne vient d'être synchronisée mais n'a pas
    // encore quitté la file, elle serait comptée deux fois.
    const canalParVente = {};
    entetes.forEach((op) => {
      const v = op.payload;
      if (v?.date === date && !dejaSurLeServeur.has(v.id)) canalParVente[v.id] = v.canal;
    });
    const parCanal = vide();
    const avecDetail = new Set();
    lignes.forEach((op) => {
      [].concat(op.payload).forEach((l) => {
        const canal = canalParVente[l.vente_id];
        if (!canal) return;
        avecDetail.add(l.vente_id);
        const seau = parCanal[canal] ?? (parCanal[canal] = {});
        seau[l.calibre] = (seau[l.calibre] ?? 0) + l.oeufs;
      });
    });
    setFile(parCanal);

    // Une vente en file sans ligne de détail est un encaissement global.
    const globales = entetes.filter(
      (op) =>
        canalParVente[op.payload?.id] !== undefined && !avecDetail.has(op.payload.id)
    );
    setGlobalesFile({
      nombre: globales.length,
      montant: globales.reduce((s, op) => s + (op.payload.montant ?? 0), 0),
    });
  };

  useEffect(() => {
    const jeton = ++requete.current;
    setServeur([]);
    setFile(vide());
    setGlobalesFile({ nombre: 0, montant: 0 });
    const relire = async () => {
      const { ids } = await chargerServeur(jeton);
      await chargerFile(ids);
    };
    relire();
    return onQueueChange(relire);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date]);

  // Ici la file s'additionne au serveur — ce sont de nouvelles ventes, pas la
  // correction d'une fiche existante comme au relevé de collecte.
  const { vendu, globales, ventes } = useMemo(() => {
    const parCanal = vide();
    const liste = [];
    let nombre = 0;
    let montant = 0;
    serveur.forEach((v) => {
      if (aSupprimer.has(v.id)) return;
      const lignes = v.vente_lignes ?? [];
      liste.push({
        id: v.id,
        client: v.clients?.nom ?? "Comptoir",
        montant: v.montant ?? 0,
        credit: v.credit,
        regle: (v.reglements ?? []).reduce((s, r) => s + r.montant, 0),
        detail: lignes.length
          ? lignes.map((l) => `${fmt(l.oeufs)} ${libelle(l.calibre)}`).join(" · ")
          : "montant global, sans détail",
      });
      if (!lignes.length) {
        nombre += 1;
        montant += v.montant ?? 0;
        return;
      }
      const seau = parCanal[v.canal] ?? (parCanal[v.canal] = {});
      lignes.forEach((l) => {
        seau[l.calibre] = (seau[l.calibre] ?? 0) + l.oeufs;
      });
    });
    for (const { code } of CANAUX) {
      const seau = parCanal[code] ?? (parCanal[code] = {});
      Object.entries(file[code] ?? {}).forEach(([calibre, oeufs]) => {
        seau[calibre] = (seau[calibre] ?? 0) + oeufs;
      });
    }
    return {
      vendu: parCanal,
      globales: {
        nombre: nombre + globalesFile.nombre,
        montant: montant + globalesFile.montant,
      },
      ventes: liste,
    };
  }, [serveur, file, aSupprimer, globalesFile]);

  const supprimer = async (v) => {
    const ok = window.confirm(
      `Supprimer la vente « ${v.client} » de ${fmt(v.montant)} Ar ?\n\n${v.detail}\n\n` +
        "Elle ne comptera plus dans la recette du jour. C'est définitif."
    );
    if (!ok) return;
    // Les lignes par calibre partent avec, la base s'en charge en cascade.
    await enqueue({ table: "ventes", kind: "delete", match: { id: v.id } });
  };

  const totalCanal = (code) => Object.values(vendu[code] ?? {}).reduce((s, n) => s + n, 0);
  const totalGeneral = CANAUX.reduce((s, c) => s + totalCanal(c.code), 0);
  const enAttente = CANAUX.some((c) => Object.keys(file[c.code] ?? {}).length > 0);

  return (
    <div className="tf-card">
      <div className="tf-cardhead">
        <span className="tf-cardtitle">Œufs vendus</span>
        <span className="tf-tag">{date === today() ? "AUJOURD'HUI" : dLabel(date).toUpperCase()}</span>
      </div>
      {/* Même forme que le relevé de collecte : tous les calibres, même à
          zéro, à position fixe d'un jour sur l'autre. */}
      <div className="tf-releve-cadre">
        <table className="tf-releve">
          <thead>
            <tr>
              <th>Calibre</th>
              {CANAUX.map((c) => <th key={c.code}>{c.nom}</th>)}
              <th>Total</th>
            </tr>
          </thead>
          <tbody>
            {LIGNES.map((cal) => {
              const parCanal = CANAUX.map((c) => vendu[c.code]?.[cal] ?? 0);
              const total = parCanal.reduce((s, n) => s + n, 0);
              return (
                <tr key={cal}>
                  <th>
                    {libelle(cal)}
                    <span className="tf-sous">{POIDS[cal]}</span>
                  </th>
                  {parCanal.map((n, i) => <td key={CANAUX[i].code}>{fmt(n)}</td>)}
                  <td>{fmt(total)}</td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr>
              <th>Total œufs</th>
              {CANAUX.map((c) => <td key={c.code}>{fmt(totalCanal(c.code))}</td>)}
              <td>{fmt(totalGeneral)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
      <div className="tf-live">
        <span className="tf-live-n">{fmt(totalGeneral)}</span>
        <span className="tf-live-l">œufs vendus, clients et détail confondus</span>
      </div>

      {/* Le détail vente par vente. Le tableau ci-dessus additionne : une
          erreur de calibre y devient un total, impossible à corriger sans
          savoir de quelle vente il vient. */}
      {ventes.length > 0 && (
        <>
          <p className="tf-eyebrow" style={{ margin: "14px 0 6px" }}>Ventes de la journée</p>
          {ventes.map((v) => (
            <div className="tf-due" key={v.id}>
              <div>
                <div className="tf-due-l">{v.client}</div>
                <div className="tf-due-d">
                  {v.detail} · {fmt(v.montant)} Ar{v.credit ? " · CRÉDIT" : ""}
                </div>
              </div>
              <div className="tf-due-r">
                {v.regle > 0 ? (
                  <span className="tf-tag">ENCAISSÉE</span>
                ) : (
                  <button className="tf-due-btn" data-danger="1" onClick={() => supprimer(v)}>
                    Supprimer
                  </button>
                )}
              </div>
            </div>
          ))}
          <p className="tf-note">
            Une vente encaissée ne se supprime pas : effacer la vente effacerait la trace de
            l'argent reçu. Annule d'abord l'encaissement depuis l'écran Créances.
          </p>
        </>
      )}

      {globales.nombre > 0 && (
        <p className="tf-note">
          En plus : {globales.nombre} encaissement{globales.nombre > 1 ? "s" : ""} saisi
          {globales.nombre > 1 ? "s" : ""} en montant global ({fmt(globales.montant)} Ar), sans détail
          par calibre — ces œufs-là ne sont pas comptés ci-dessus.
        </p>
      )}
      {enAttente && (
        <p className="tf-note">Les saisies pas encore synchronisées sont comprises dans ces chiffres.</p>
      )}
      <AlerteEchecs tables={TABLES} />
    </div>
  );
}
