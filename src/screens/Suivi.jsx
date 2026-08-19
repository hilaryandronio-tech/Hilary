import { useEffect, useMemo, useState } from "react";
import Header from "../components/Header";
import AlerteEchecs from "../components/AlerteEchecs";
import { dLabel, today } from "../components/format";
import { supabase } from "../lib/supabaseClient";
import { enqueue, onQueueChange, operationsEnAttente } from "../lib/offlineQueue";
import { lectureCachee } from "../lib/cacheLecture";
import { lireEffectifs } from "../lib/effectifs";
import { useAuth } from "../context/AuthContext";

// Le calendrier d'élevage du fournisseur : vaccins et traitements, chacun avec
// une fenêtre — l'anticoccidien tient sur trois jours, le vermifuge sur un.
// Ce que l'écran doit faire avant tout, c'est montrer ce qui est en retard :
// sur la fiche de la 1ère vague, le réalisé glissait de un à trois jours
// derrière le prévu, et un vaccin oublié ne se rattrape pas.

const TABLES = ["interventions"];

// Les consignes permanentes du Shop, reprises du FANAMARIHANA de la fiche.
// Elles vivent ici et non en base : `parametres.valeur` est de type numeric,
// il porte des prix. Ce sont de toute façon des instructions du fournisseur,
// pas une donnée de ferme qui bouge.
const CONSIGNES = [
  "Vitamine avant, pendant et après chaque vaccination et le débecquage.",
  "Débecquage à 7-10 jours, ou vers 10 semaines.",
  "Une fois les poules en ponte, vermifuge tous les 2 mois.",
];

function etat(i, aujourdhui) {
  if (i.date_realisee) return "fait";
  const fin = i.date_fin_prevue ?? i.date_prevue;
  if (fin < aujourdhui) return "retard";
  if (i.date_prevue <= aujourdhui) return "maintenant";
  return "avenir";
}

// « 13 juil. » porte déjà son point, « 19 juin » non : sans ça, une phrase sur
// deux se termine par un double point.
const finPhrase = (s) => (s.endsWith(".") ? s : `${s}.`);

const fenetre = (i) =>
  i.date_fin_prevue && i.date_fin_prevue !== i.date_prevue
    ? `${dLabel(i.date_prevue)} → ${dLabel(i.date_fin_prevue)}`
    : dLabel(i.date_prevue);

export default function Suivi() {
  const { profil } = useAuth();
  const [lots, setLots] = useState([]);
  const [lotId, setLotId] = useState(null);
  const [interventions, setInterventions] = useState([]);
  const [faitesEnFile, setFaitesEnFile] = useState({});
  const [flash, setFlash] = useState("");
  const [padDate, setPadDate] = useState(null);
  const jour = today();

  useEffect(() => {
    lireEffectifs().then(({ lots: data }) => {
      if (!data) return;
      setLots(data);
      setLotId((id) => id ?? data.find((l) => !l.en_ponte)?.lot_id ?? data[0]?.lot_id ?? null);
    });
  }, []);

  const charger = async () => {
    if (!lotId) return;
    // Le calendrier doit rester consultable au poulailler, sans réseau : c'est
    // là qu'on a besoin de savoir ce qui est dû aujourd'hui.
    const { data } = await lectureCachee(`interventions:${lotId}`, () =>
      supabase
        .from("interventions")
        .select("id, lot_id, type, libelle, age, date_prevue, date_fin_prevue, date_realisee, produit, technicien")
        .eq("lot_id", lotId)
        .order("date_prevue")
    );
    if (data) setInterventions(data);
  };

  // Une intervention cochée hors ligne doit apparaître faite tout de suite :
  // le chef vient de donner le produit, l'écran ne peut pas continuer à le
  // réclamer jusqu'au retour du réseau.
  const chargerFile = async () => {
    const ops = await operationsEnAttente("interventions");
    const parId = {};
    ops.forEach((op) => {
      // La valeur peut être `null` — c'est une annulation. On enregistre donc
      // la présence de l'opération, pas seulement une date non vide, sinon un
      // décochage fait hors ligne resterait invisible jusqu'à la synchro.
      if (op.match?.id && "date_realisee" in (op.payload ?? {})) {
        parId[op.match.id] = op.payload.date_realisee;
      }
    });
    setFaitesEnFile(parId);
  };

  useEffect(() => {
    const relire = () => { charger(); chargerFile(); };
    relire();
    return onQueueChange(relire);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lotId]);

  const lignes = useMemo(
    () =>
      interventions.map((i) => {
        const enrichie = {
          ...i,
          date_realisee: i.id in faitesEnFile ? faitesEnFile[i.id] : i.date_realisee,
        };
        return { ...enrichie, etat: etat(enrichie, jour) };
      }),
    [interventions, faitesEnFile, jour]
  );

  const par = (e) => lignes.filter((l) => l.etat === e);
  const enRetard = par("retard");
  const maintenant = par("maintenant");
  const aVenir = par("avenir");
  const faites = par("fait");

  // `date` à null décoche : cocher est un geste rapide, donc facile à faire
  // sur la mauvaise ligne, et il n'y avait aucun moyen de revenir en arrière
  // sans passer par le SQL.
  const marquer = async (i, date) => {
    await enqueue({
      table: "interventions",
      kind: "update",
      payload: { date_realisee: date, auteur: profil?.id },
      match: { id: i.id },
    });
    setFlash(date ? finPhrase(`${i.libelle} — noté au ${dLabel(date)}`) : `${i.libelle} — remis à faire.`);
    setTimeout(() => setFlash(""), 3000);
  };

  const lot = lots.find((l) => l.lot_id === lotId);

  const Bloc = ({ titre, tag, items, alerte }) =>
    items.length === 0 ? null : (
      <div className="tf-card">
        <div className="tf-cardhead">
          <span className="tf-cardtitle">{titre}</span>
          <span className="tf-tag">{tag}</span>
        </div>
        {items.map((i) => (
          <div className="tf-due" key={i.id}>
            <div>
              <div className="tf-due-l">
                {i.libelle}
                {i.type === "vaccination" && <span className="tf-tag"> · VACCIN</span>}
              </div>
              <div className="tf-due-d" data-late={alerte ? 1 : 0}>
                {i.age ? `${i.age} · ` : ""}
                {i.date_realisee ? `fait le ${dLabel(i.date_realisee)}` : fenetre(i)}
              </div>
            </div>
            {i.date_realisee ? (
              <div className="tf-due-r">
                <div className="tf-due-actions">
                  <button className="tf-due-btn" onClick={() => marquer(i, null)}>Annuler</button>
                </div>
              </div>
            ) : (
              <div className="tf-due-r">
                <div className="tf-due-actions">
                  <button className="tf-due-btn" onClick={() => marquer(i, jour)}>Fait</button>
                  {i.date_prevue < jour && (
                    <button className="tf-due-btn" onClick={() => marquer(i, i.date_prevue)}>
                      Fait le {dLabel(i.date_prevue).slice(5)}
                    </button>
                  )}
                  {/* Le réalisé tombe rarement sur le prévu ni sur aujourd'hui :
                      sur la fiche de la 1ère vague il traîne d'un à trois jours
                      derrière, à chaque fois. Il faut pouvoir saisir la vraie
                      date. */}
                  <button className="tf-due-btn"
                    onClick={() => setPadDate({ i, date: i.date_prevue })}>Autre date</button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    );

  return (
    <div className="tf">
      <Header />
      <main className="tf-body">
        <p className="tf-eyebrow">Suivi d'élevage</p>
        <h1 className="tf-h1">Vaccins et traitements</h1>
        <p className="tf-sub">
          Le calendrier du Shop, bâtiment par bâtiment. Appuie sur « Fait » le jour où c'est donné.
        </p>

        <div className="tf-chips">
          {lots.map((l) => (
            <button key={l.lot_id} className="tf-chip" data-on={lotId === l.lot_id ? 1 : 0}
              onClick={() => setLotId(l.lot_id)}>
              {l.lot_id}{l.en_ponte ? "" : " · poulettes"}
            </button>
          ))}
        </div>

        <AlerteEchecs tables={TABLES} />

        {lot && (
          <div className="tf-kpis">
            <div className="tf-kpi" data-hero="1" data-alert={enRetard.length ? 1 : 0}>
              <div className="tf-kpi-n">{enRetard.length + maintenant.length}</div>
              <div className="tf-kpi-l">
                à faire sur {lot.lot_id}
                {lot.age_semaines != null && ` · ${lot.age_semaines} semaines d'âge`}
              </div>
            </div>
          </div>
        )}

        {lignes.length === 0 && (
          <div className="tf-card">
            <p className="tf-empty">
              Aucun calendrier pour ce bâtiment — les vagues en ponte ont terminé leur programme.
            </p>
          </div>
        )}

        <Bloc titre="En retard" tag="À FAIRE D'URGENCE" items={enRetard} alerte />
        <Bloc titre="À faire maintenant" tag="DANS LA FENÊTRE" items={maintenant} />
        <Bloc titre="À venir" tag="PLANIFIÉ" items={aVenir} />
        <Bloc titre="Déjà fait" tag={`${faites.length} INTERVENTION(S)`} items={faites} />

        <div className="tf-card">
          <div className="tf-cardhead"><span className="tf-cardtitle">Consignes du Shop</span></div>
          <div className="tf-ticket">
            {CONSIGNES.map((c) => (
              <div className="tf-ticket-row" key={c}><span>{c}</span></div>
            ))}
          </div>
        </div>
      </main>

      {/* Le calendrier du téléphone plutôt que le sélecteur à flèches de
          l'application : une intervention de juin se note en août, et avancer
          d'un jour à la fois demanderait soixante appuis. Le futur est fermé,
          on ne note pas un geste qui n'a pas eu lieu. */}
      {padDate && (
        <div className="tf-pad" onClick={() => setPadDate(null)}>
          <div className="tf-pad-sheet" onClick={(e) => e.stopPropagation()}>
            <div className="tf-pad-head">
              <span className="tf-pad-label">{padDate.i.libelle} — date réelle</span>
              <button className="tf-role" data-on="1" onClick={() => setPadDate(null)}>Fermer</button>
            </div>
            <p className="tf-note">{finPhrase(`Prévu ${fenetre(padDate.i)}`)}</p>
            <input
              className="tf-recherche"
              type="date"
              value={padDate.date}
              max={jour}
              onChange={(e) => e.target.value && setPadDate({ ...padDate, date: e.target.value })}
              aria-label="Date réelle de l'intervention"
            />
            <div className="tf-cta-in">
              <button className="tf-btn"
                onClick={() => { marquer(padDate.i, padDate.date); setPadDate(null); }}>
                Noter au {dLabel(padDate.date)}
              </button>
            </div>
          </div>
        </div>
      )}

      {flash && <div className="tf-flash">{flash}</div>}
    </div>
  );
}
