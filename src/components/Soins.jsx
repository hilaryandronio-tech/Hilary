import { useEffect, useMemo, useRef, useState } from "react";
import NumField from "./NumField";
import Keypad from "./Keypad";
import DateSelector from "./DateSelector";
import AlerteEchecs from "./AlerteEchecs";
import { fmt, dLabel, today } from "./format";
import { supabase } from "../lib/supabaseClient";
import { enqueue, onQueueChange, operationsEnAttente, uuid } from "../lib/offlineQueue";
import { lectureCachee } from "../lib/cacheLecture";
import { useAuth } from "../context/AuthContext";

// Ce que le chef de ferme donne au quotidien, distinct du calendrier du Shop :
// l'eau bue, le coquillage, et les produits administrés au besoin.
//
// L'eau se mesure en litres et n'est pas là pour la forme : une baisse de la
// buvée précède la baisse de consommation d'aliment de plusieurs jours, et la
// chute de ponte d'encore plus. C'est le signal d'alerte le plus précoce d'un
// poulailler, et il ne se voit que dans la série.

const TABLES = ["soins"];

// Les références habituelles de la ferme, pré-remplies pour n'être retapées
// qu'en cas de changement de produit.
const POSTES = [
  { code: "eau", nom: "Eau", unite: "litres", quantifie: true },
  { code: "coquillage", nom: "Coquillage", unite: "kg", quantifie: true },
  // `court` et non l'initiale : Vitamine et Vermifuge commencent tous deux
  // par V, et un relevé qu'on ne peut pas relire ne sert à rien.
  { code: "vitamine", nom: "Vitamine", court: "Vit", produit: "Vitbio" },
  { code: "vermifuge", nom: "Vermifuge", court: "Verm", produit: "Levamisole" },
  { code: "antibiotique", nom: "Antibiotique vitaminé", court: "Anti", produit: "Tétracolivit + Antitox" },
];
const QUANTIFIES = POSTES.filter((p) => p.quantifie);
const PRODUITS = POSTES.filter((p) => !p.quantifie);
const JOURS = 14;

export default function Soins({ lotId }) {
  const { profil } = useAuth();
  const [date, setDate] = useState(today());
  const [draft, setDraft] = useState({});
  const [pad, setPad] = useState(null);
  const [flash, setFlash] = useState("");
  const [historique, setHistorique] = useState([]);
  const [file, setFile] = useState({});
  const requete = useRef(0);

  const val = (k) => draft[k] || 0;
  const donne = (k) => !!draft[`d_${k}`];

  const chargerServeur = async (jeton) => {
    const { data } = await lectureCachee(`soins:${lotId}`, () =>
      supabase
        .from("soins")
        .select("date, poste, quantite, produit")
        .eq("lot_id", lotId)
        .order("date", { ascending: false })
        .limit(JOURS * POSTES.length)
    );
    if (jeton !== requete.current) return;
    if (data) setHistorique(data);
  };

  const chargerFile = async () => {
    const ops = await operationsEnAttente("soins");
    const parCle = {};
    ops.forEach((op) => {
      const s = op.payload;
      if (s?.lot_id === lotId) parCle[`${s.date}|${s.poste}`] = s;
    });
    setFile(parCle);
  };

  useEffect(() => {
    const jeton = ++requete.current;
    setHistorique([]);
    setFile({});
    const relire = () => { chargerServeur(jeton); chargerFile(); };
    relire();
    return onQueueChange(relire);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lotId]);

  // La saisie en file remplace celle du serveur : c'est un upsert sur
  // (bâtiment, jour, poste).
  const parJour = useMemo(() => {
    const jours = {};
    historique.forEach((s) => { (jours[s.date] ??= {})[s.poste] = s; });
    Object.values(file).forEach((s) => { (jours[s.date] ??= {})[s.poste] = s; });
    return Object.entries(jours)
      .sort((a, b) => b[0].localeCompare(a[0]))
      .slice(0, JOURS);
  }, [historique, file]);

  // Ce qui est déjà noté pour la date affichée, pour que le brouillon reparte
  // de l'existant plutôt que de zéro.
  useEffect(() => {
    const dejaLa = parJour.find(([d]) => d === date)?.[1] ?? {};
    const rempli = {};
    POSTES.forEach((p) => {
      const s = dejaLa[p.code];
      if (!s) return;
      if (p.quantifie) rempli[p.code] = Number(s.quantite ?? 0);
      else { rempli[`d_${p.code}`] = true; rempli[`p_${p.code}`] = s.produit ?? p.produit; }
    });
    setDraft(rempli);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date, lotId, historique]);

  const peutEnregistrer =
    QUANTIFIES.some((p) => val(p.code) > 0) || PRODUITS.some((p) => donne(p.code));

  const enregistrer = async () => {
    try {
      for (const p of QUANTIFIES) {
        if (!val(p.code)) continue;
        await enqueue({
          table: "soins", conflict: "lot_id,date,poste",
          payload: { lot_id: lotId, date, poste: p.code, quantite: val(p.code), auteur: profil?.id },
        });
      }
      for (const p of PRODUITS) {
        if (!donne(p.code)) continue;
        await enqueue({
          table: "soins", conflict: "lot_id,date,poste",
          payload: {
            lot_id: lotId, date, poste: p.code,
            produit: draft[`p_${p.code}`] ?? p.produit, auteur: profil?.id,
          },
        });
      }
      setFlash(date === today() ? "Soins enregistrés." : `Soins enregistrés pour le ${dLabel(date)}.`);
      setTimeout(() => setFlash(""), 2600);
    } catch (e) {
      console.error("Soins non enregistrés", e);
      setFlash(`Enregistrement impossible : ${e.message}.`);
      setTimeout(() => setFlash(""), 10000);
    }
  };

  return (
    <div className="tf-card">
      <div className="tf-cardhead">
        <span className="tf-cardtitle">Soins et compléments · {lotId}</span>
        <span className="tf-tag">{date === today() ? "AUJOURD'HUI" : dLabel(date).toUpperCase()}</span>
      </div>

      <DateSelector value={date} onChange={setDate} />

      <div className="tf-grid2">
        {QUANTIFIES.map((p) => (
          <NumField key={p.code} label={p.nom} unit={p.unite} value={val(p.code)}
            onOpen={() => setPad({ key: p.code, label: `${p.nom} — ${lotId}`, unit: p.unite, value: val(p.code) })} />
        ))}
      </div>

      <p className="tf-label" style={{ marginTop: 12 }}>Produits donnés</p>
      <div className="tf-chips">
        {PRODUITS.map((p) => (
          <button key={p.code} className="tf-chip" data-on={donne(p.code) ? 1 : 0}
            onClick={() => setDraft({
              ...draft,
              [`d_${p.code}`]: !donne(p.code),
              [`p_${p.code}`]: draft[`p_${p.code}`] ?? p.produit,
            })}>
            {p.nom}
          </button>
        ))}
      </div>
      <p className="tf-note">
        {PRODUITS.filter((p) => donne(p.code))
          .map((p) => `${p.nom} : ${draft[`p_${p.code}`] ?? p.produit}`)
          .join(" · ") || "Appuie sur un produit pour le noter comme donné aujourd'hui."}
      </p>

      <div className="tf-cta-in">
        <button className="tf-btn" disabled={!peutEnregistrer} onClick={enregistrer}>Enregistrer</button>
        <button className="tf-btn tf-btn-ghost" onClick={() => setDraft({})}>Effacer</button>
      </div>

      <AlerteEchecs tables={TABLES} />

      {parJour.length > 0 && (
        <>
          <div className="tf-releve-cadre" data-long="1">
            <table className="tf-releve">
              <thead>
                <tr>
                  <th>Jour</th>
                  <th>Eau</th>
                  <th>Coquillage</th>
                  <th>Produits</th>
                </tr>
              </thead>
              <tbody>
                {parJour.map(([d, postes]) => (
                  <tr key={d}>
                    <th>
                      {dLabel(d)}
                      {d === today() && <span className="tf-sous">aujourd'hui</span>}
                    </th>
                    <td>{postes.eau ? fmt(postes.eau.quantite) : "—"}</td>
                    <td>{postes.coquillage ? fmt(postes.coquillage.quantite) : "—"}</td>
                    <td>
                      {PRODUITS.filter((p) => postes[p.code]).map((p) => p.court).join(" ") || "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="tf-note">
            Les quatorze derniers jours notés. Sous « Produits » : <strong>Vit</strong> pour
            vitamine, <strong>Verm</strong> pour vermifuge, <strong>Anti</strong> pour
            l'antibiotique vitaminé.
            Surveille l'eau plus que le reste : une buvée qui baisse précède de plusieurs jours la
            baisse de consommation d'aliment, et la chute de ponte d'encore plus.
          </p>
        </>
      )}

      {flash && <div className="tf-flash">{flash}</div>}
      <Keypad
        field={pad}
        onChange={(v) => { setDraft({ ...draft, [pad.key]: v }); setPad({ ...pad, value: v }); }}
        onClose={() => setPad(null)}
      />
    </div>
  );
}
