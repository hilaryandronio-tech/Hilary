import { useEffect, useMemo, useRef, useState } from "react";
import { fmt, dLabel } from "./format";
import { supabase } from "../lib/supabaseClient";
import { lectureCachee } from "../lib/cacheLecture";
import { onQueueChange, operationsEnAttente } from "../lib/offlineQueue";
import { useAlveoles } from "../lib/useAlveoles";

// Le compte des alvéoles prêtées à un client : ce qui est parti, ce qui est
// revenu, ce qui reste chez lui.
//
// Le solde vient de la vue, qui compte tout depuis le début. La liste en
// dessous ne montre que les derniers passages : sans elle le nombre serait à
// croire sur parole, et un écart n'aurait aucune date où se chercher.

const MOUVEMENTS = 60;

export default function Alveoles({ client }) {
  const soldes = useAlveoles();
  const [serveur, setServeur] = useState([]);
  const [file, setFile] = useState([]);
  const requete = useRef(0);

  // Une entrée dans la vue, c'est un client qui emprunte nos alvéoles.
  const solde = client?.id ? soldes[client.id] : null;

  useEffect(() => {
    const jeton = ++requete.current;
    setServeur([]);
    setFile([]);
    const charger = async () => {
      if (!client?.id || !solde) return;
      const { data } = await lectureCachee(`alveoles:${client.id}`, () =>
        supabase.from("mouvements_alveoles")
          .select("id, date, sorties, rendues")
          .eq("client_id", client.id)
          .order("date", { ascending: false })
          .limit(MOUVEMENTS));
      if (jeton !== requete.current) return;
      if (data) setServeur(data);
      const ops = await operationsEnAttente("mouvements_alveoles");
      if (jeton !== requete.current) return;
      setFile(ops.map((op) => op.payload).filter((m) => m?.client_id === client.id));
    };
    charger();
    return onQueueChange(charger);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [client?.id, !!solde]);

  const mouvements = useMemo(() => {
    // Un mouvement déjà revenu du serveur ne doit pas s'afficher deux fois.
    const ids = new Set(serveur.map((m) => m.id));
    return [...file.filter((m) => !ids.has(m.id)).map((m) => ({ ...m, enAttente: true })), ...serveur]
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [serveur, file]);

  if (!solde) return null;

  return (
    <div className="tf-card">
      <div className="tf-cardhead">
        <span className="tf-cardtitle">Alvéoles de la ferme</span>
        {solde.dernier && <span className="tf-tag">DEPUIS LE {dLabel(solde.dernier).toUpperCase()}</span>}
      </div>

      <div className="tf-live" data-alerte={solde.chez < 0 ? 1 : 0}>
        <span className="tf-live-n">{fmt(solde.chez)}</span>
        <span className="tf-live-l">
          alvéoles chez {client.nom} — {fmt(solde.sorties)} sorties, {fmt(solde.rendues)} rendues
        </span>
      </div>

      {mouvements.length > 0 && (
        <div className="tf-releve-cadre" data-long="1">
          <table className="tf-releve">
            <thead>
              <tr><th>Jour</th><th>Sorties</th><th>Rendues</th></tr>
            </thead>
            <tbody>
              {mouvements.map((m, i) => (
                <tr key={m.id ?? i}>
                  <th>
                    {dLabel(m.date)}
                    {m.enAttente && <span className="tf-sous">en attente</span>}
                  </th>
                  <td>{m.sorties ? fmt(m.sorties) : "—"}</td>
                  <td>{m.rendues ? fmt(m.rendues) : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {mouvements.length === 0 && (
        <p className="tf-empty">Aucun mouvement noté. Les alvéoles se comptent à la caisse.</p>
      )}

      {solde.chez < 0 && (
        <p className="tf-note" data-alerte="1">
          Le compte est négatif : il est revenu plus d'alvéoles qu'il n'en est parti. Des sorties
          n'ont pas été notées — compte ce qui reste chez {client.nom} et note l'écart.
        </p>
      )}
    </div>
  );
}
