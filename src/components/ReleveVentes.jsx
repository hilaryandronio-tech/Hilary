import { useEffect, useMemo, useRef, useState } from "react";
import { fmt, today, dLabel } from "./format";
import { CALIBRES, POIDS } from "../data/constants";
import { supabase } from "../lib/supabaseClient";
import { onQueueChange, operationsEnAttente } from "../lib/offlineQueue";
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
  const [serveur, setServeur] = useState(vide);
  const [file, setFile] = useState(vide);
  // Les ventes saisies en montant global (recette du jour, crédit) n'ont pas
  // de détail par calibre : elles pèsent en ariary, pas en œufs. Sans le dire,
  // le relevé passerait pour incomplet. Comptées des deux côtés, sinon la
  // mention disparaîtrait hors ligne, quand tout est encore en file.
  const [globalesServeur, setGlobalesServeur] = useState({ nombre: 0, montant: 0 });
  const [globalesFile, setGlobalesFile] = useState({ nombre: 0, montant: 0 });
  const requete = useRef(0);

  const chargerServeur = async (jeton) => {
    const { data, error } = await supabase
      .from("ventes")
      .select("id, canal, montant, vente_lignes(calibre, oeufs)")
      .eq("date", date);
    // Seule la dernière requête demandée a le droit d'écrire dans l'état.
    if (jeton !== requete.current) return { ids: new Set() };
    if (error || !data) return { ids: new Set() }; // hors ligne : on garde ce qu'on savait
    const parCanal = vide();
    let nombre = 0;
    let montant = 0;
    data.forEach((v) => {
      const lignes = v.vente_lignes ?? [];
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
    setServeur(parCanal);
    setGlobalesServeur({ nombre, montant });
    return { ids: new Set(data.map((v) => v.id)) };
  };

  const chargerFile = async (dejaSurLeServeur) => {
    const [entetes, lignes] = await Promise.all([
      operationsEnAttente("ventes"),
      operationsEnAttente("vente_lignes"),
    ]);
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
    setServeur(vide());
    setFile(vide());
    setGlobalesServeur({ nombre: 0, montant: 0 });
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
  const vendu = useMemo(() => {
    const somme = vide();
    for (const { code } of CANAUX) {
      const seau = (somme[code] = { ...serveur[code] });
      Object.entries(file[code] ?? {}).forEach(([calibre, oeufs]) => {
        seau[calibre] = (seau[calibre] ?? 0) + oeufs;
      });
    }
    return somme;
  }, [serveur, file]);

  const globales = {
    nombre: globalesServeur.nombre + globalesFile.nombre,
    montant: globalesServeur.montant + globalesFile.montant,
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
