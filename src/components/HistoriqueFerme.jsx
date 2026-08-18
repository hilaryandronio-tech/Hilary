import { useEffect, useMemo, useRef, useState } from "react";
import { fmt, dLabel, today } from "./format";
import { supabase } from "../lib/supabaseClient";
import { onQueueChange, operationsEnAttente } from "../lib/offlineQueue";

// Les derniers jours saisis pour un bâtiment. L'écran ne montrait que le jour
// en cours : impossible de vérifier qu'on n'avait pas oublié la veille, ni de
// voir une provende aberrante au milieu d'une série.

const JOURS = 31;

export default function HistoriqueFerme({ lotId, vivant }) {
  const [serveur, setServeur] = useState([]);
  const [file, setFile] = useState({});
  const requete = useRef(0);

  const chargerServeur = async (jeton) => {
    const { data, error } = await supabase
      .from("saisies_ferme")
      .select("date, provende_kg, mortalite")
      .eq("lot_id", lotId)
      .order("date", { ascending: false })
      .limit(JOURS);
    if (jeton !== requete.current) return; // une réponse en retard n'écrase pas
    if (error || !data) return;
    setServeur(data);
  };

  // Une saisie encore en file doit apparaître : le chef vient de l'enregistrer,
  // le relevé ne peut pas continuer à montrer la journée comme vide.
  const chargerFile = async () => {
    const ops = await operationsEnAttente("saisies_ferme");
    const parDate = {};
    ops.forEach((op) => {
      const s = op.payload;
      if (s?.lot_id === lotId) parDate[s.date] = { provende_kg: s.provende_kg, mortalite: s.mortalite };
    });
    setFile(parDate);
  };

  useEffect(() => {
    const jeton = ++requete.current;
    setServeur([]);
    setFile({});
    const relire = () => { chargerServeur(jeton); chargerFile(); };
    relire();
    return onQueueChange(relire);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lotId]);

  const lignes = useMemo(() => {
    const parDate = {};
    serveur.forEach((s) => { parDate[s.date] = { ...s }; });
    Object.entries(file).forEach(([d, s]) => { parDate[d] = { date: d, ...s, enAttente: true }; });
    return Object.values(parDate).sort((a, b) => b.date.localeCompare(a.date)).slice(0, JOURS);
  }, [serveur, file]);

  const totalKg = lignes.reduce((s, l) => s + (l.provende_kg ?? 0), 0);
  const totalMorts = lignes.reduce((s, l) => s + (l.mortalite ?? 0), 0);
  const enAttente = lignes.some((l) => l.enAttente);

  return (
    <div className="tf-card">
      <div className="tf-cardhead">
        <span className="tf-cardtitle">Derniers jours · {lotId}</span>
        <span className="tf-tag">{lignes.length} JOUR(S)</span>
      </div>

      {lignes.length === 0 ? (
        <p className="tf-empty">Aucune saisie enregistrée pour ce bâtiment.</p>
      ) : (
        <>
          {/* Un mois de lignes repousserait le reste de l'écran hors de vue :
              la zone défile, en-tête et total restant collés aux bords. */}
          <div className="tf-releve-cadre" data-long="1">
            <table className="tf-releve">
              <thead>
                <tr>
                  <th>Jour</th>
                  <th>Provende</th>
                  <th>Mortalité</th>
                  <th>g/poule</th>
                </tr>
              </thead>
              <tbody>
                {lignes.map((l) => {
                  // Rapporté à l'effectif d'aujourd'hui : sur deux semaines
                  // l'écart reste négligeable, et c'est le repère que le chef
                  // a déjà sous les yeux au moment de saisir.
                  const g = vivant && l.provende_kg ? (l.provende_kg * 1000) / vivant : 0;
                  const horsNorme = g > 0 && (g < 110 || g > 125);
                  return (
                    <tr key={l.date}>
                      <th>
                        {dLabel(l.date)}
                        {l.date === today() && <span className="tf-sous">aujourd'hui</span>}
                        {l.enAttente && <span className="tf-sous">en attente</span>}
                      </th>
                      <td>{fmt(l.provende_kg)}</td>
                      <td data-alerte={l.mortalite > 0 ? 1 : 0}>{fmt(l.mortalite)}</td>
                      <td data-alerte={horsNorme ? 1 : 0}>{g ? g.toFixed(0) : "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr>
                  <th>Total</th>
                  <td>{fmt(totalKg)} kg</td>
                  <td>{fmt(totalMorts)}</td>
                  <td>—</td>
                </tr>
              </tfoot>
            </table>
          </div>
          <p className="tf-note">
            Les trente et un derniers jours saisis — fais défiler la liste. La colonne g/poule
            compare la provende à la norme 110–125 g ; hors de cette fourchette, elle passe en brique.
            {enAttente && " Les saisies pas encore synchronisées y figurent."}
          </p>
        </>
      )}
    </div>
  );
}
