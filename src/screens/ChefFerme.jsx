import { useEffect, useMemo, useState } from "react";
import Header from "../components/Header";
import NumField from "../components/NumField";
import Keypad from "../components/Keypad";
import DateSelector from "../components/DateSelector";
import HistoriqueFerme from "../components/HistoriqueFerme";
import { fmt, today, dLabel } from "../components/format";
import { SEED_LOTS, CATEGORIES_CHARGES } from "../data/constants";

// Un sac de provende fait 50 kg — vérifié sur la feuille d'août 2026,
// 167 kg distribués pour 3,34 sacs.
const SAC_KG = 50;
import { supabase } from "../lib/supabaseClient";
import { enqueue, onQueueChange, uuid } from "../lib/offlineQueue";
import { lectureCachee } from "../lib/cacheLecture";
import { lireEffectifs } from "../lib/effectifs";
import { useAuth } from "../context/AuthContext";

// Reference port of the prototype's Chef de ferme screen (docs/tama-app.jsx)
// onto Supabase + the offline write queue. The other five screens still need
// the same treatment — this one shows the pattern: fetch reference/view data
// with a local fallback, keep the draft in memory, submit through enqueue()
// instead of calling supabase directly.
export default function ChefFerme() {
  const { profil } = useAuth();
  const [lots, setLots] = useState(SEED_LOTS.map((l) => ({ ...l, vivant: l.effectif_initial })));
  const [lotId, setLotId] = useState(profil?.lot_id ?? SEED_LOTS[0].id);
  const [date, setDate] = useState(today());
  const [draft, setDraft] = useState({});
  const [pad, setPad] = useState(null);
  const [flash, setFlash] = useState("");

  useEffect(() => {
    lireEffectifs().then(({ lots: data }) => {
      if (!data) return; // jamais chargé et hors ligne : on garde le seed
      setLots(data.map((l) => ({
        id: l.lot_id, nom: l.nom, en_ponte: l.en_ponte, vivant: l.vivant,
        prixProvende: l.prix_provende_kg,
      })));
    });
  }, []);

  // Stock de provende : les livraisons reçues moins ce qui a été distribué.
  // Se recharge quand la file bouge, pour qu'une réception saisie hors ligne
  // se voie tout de suite.
  const [stock, setStock] = useState({});
  const chargerStock = () => {
    lectureCachee("v_stock_provende", () =>
      supabase.from("v_stock_provende").select("lot_id, stock_kg, conso_jour_kg, derniere_livraison")
    ).then(({ data }) => {
      if (!data) return;
      setStock(Object.fromEntries(data.map((s) => [s.lot_id, s])));
    });
  };
  useEffect(() => {
    chargerStock();
    return onQueueChange(chargerStock);
  }, []);

  const val = (k) => draft[k] || 0;
  // Saisie directe à la souris : même effet que le pavé, sans passer par lui.
  const poser = (k, v) => setDraft((d) => ({ ...d, [k]: v }));

  const open = (k, label, unit) => setPad({ key: k, label, unit, value: val(k) });
  const setPadVal = (v) => {
    // Le reste compté n'est pas une saisie du soir : il ne rejoint pas le
    // brouillon, il déclenche une correction de stock à la validation.
    if (pad.key !== "reste_reel") setDraft({ ...draft, [pad.key]: v });
    setPad({ ...pad, value: v });
  };

  // Cale le stock sur les sacs réellement comptés, en enregistrant l'écart
  // comme une entrée — négative si le magasin contient moins que prévu. On
  // vise la valeur affichée, brouillon du soir compris : c'est celle que le
  // chef a sous les yeux au moment de compter.
  const corrigerStock = async (resteVoulu) => {
    const ecartKg = resteVoulu - stockAffiche;
    if (Math.abs(ecartKg) < 1) return; // rien à corriger, et `sacs <> 0` le refuserait
    await enqueue({
      table: "livraisons_provende",
      conflict: "id",
      payload: {
        id: uuid(), lot_id: lotId, date,
        sacs: Number((ecartKg / SAC_KG).toFixed(2)),
        poids_sac: SAC_KG,
        motif: "comptage",
        auteur: profil?.id,
      },
    });
    setFlash(
      `${lotId} : stock calé sur ${fmt(resteVoulu)} kg — ` +
      `${ecartKg > 0 ? "+" : "−"}${fmt(Math.abs(ecartKg))} kg d'écart.`
    );
    setTimeout(() => setFlash(""), 4000);
  };

  const lot = lots.find((l) => l.id === lotId) ?? lots[0];
  const totalCharges = useMemo(
    () => CATEGORIES_CHARGES.reduce((s, c) => s + val("ch_" + c), 0),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [draft]
  );
  const grammesParPoule = val("kg") && lot?.vivant ? (val("kg") * 1000) / lot.vivant : 0;

  // Le stock tel qu'il sera une fois la saisie du soir enregistrée : les sacs
  // reçus entrent, les kilos distribués sortent. Le chef voit l'effet de sa
  // saisie avant de la valider.
  const stockLot = stock[lotId];
  const stockAffiche = (stockLot?.stock_kg ?? 0) + val("sacs") * SAC_KG - val("kg");
  const conso = Number(stockLot?.conso_jour_kg ?? 0);
  // Un stock négatif n'existe pas dans un magasin : il signale qu'il manque
  // des livraisons face à ce qui a déjà été distribué. Afficher « 0 kg » et
  // « −1 jour » dans la même carte revenait à se contredire — mieux vaut
  // nommer le trou que d'en déduire une autonomie qui n'a aucun sens.
  const stockIncoherent = stockAffiche < 0;
  const autonomie = !stockIncoherent && conso > 0 ? stockAffiche / conso : null;
  const derniereLivraison = stockLot?.derniere_livraison;

  const peutEnregistrer = Object.values(draft).some(Boolean);

  // Une exception ici interrompait la fonction sans un mot : pas de ligne en
  // file, donc pas de badge non plus, et la saisie semblait enregistrée alors
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
    const jobs = [];

    if (val("kg") || val("mort")) {
      // La table n'accepte qu'une saisie par (date, bâtiment), et c'est ce
      // couple qu'on vise : la ligne existante est corrigée quelle que soit
      // son origine. Viser un identifiant fabriqué ici butait sur la
      // contrainte dès que la ligne venait d'ailleurs — l'import des feuilles
      // en particulier, dont les identifiants sont tirés au sort. Rien ne
      // référence `saisies_ferme.id`, il n'y a donc pas à l'imposer.
      jobs.push(
        enqueue({
          table: "saisies_ferme",
          conflict: "date,lot_id",
          // Le prix est figé ici, comme `vente_lignes.prix_unit` l'est à la
          // vente : une hausse du fournisseur ne doit pas réécrire le coût
          // des mois déjà clos.
          payload: {
            date, lot_id: lotId,
            provende_kg: val("kg"), mortalite: val("mort"),
            prix_provende_kg: lot?.prixProvende ?? null,
            auteur,
          },
        })
      );
    }
    if (val("sacs")) {
      jobs.push(
        enqueue({
          table: "livraisons_provende",
          conflict: "id",
          payload: {
            id: uuid(), lot_id: lotId, date,
            sacs: val("sacs"), poids_sac: SAC_KG, auteur,
          },
        })
      );
    }
    for (const c of CATEGORIES_CHARGES) {
      if (val("ch_" + c)) {
        // Identifiant tiré au sort à chaque enregistrement, et non déduit de
        // (date, catégorie) : rien n'interdit deux dépenses de carburant le
        // même jour. L'identifiant sert juste à ce qu'une re-synchro rejoue
        // la même ligne au lieu d'en créer une deuxième.
        jobs.push(
          enqueue({
            table: "charges",
            conflict: "id",
            payload: { id: uuid(), date, categorie: c, montant: val("ch_" + c), origine: "ferme", auteur },
          })
        );
      }
    }
    await Promise.all(jobs);
    setDraft({});
    setFlash(date === today() ? "Saisie enregistrée." : `Saisie enregistrée pour le ${dLabel(date)}.`);
    setTimeout(() => setFlash(""), 2600);
  };

  return (
    <div className="tf">
      <Header />
      <main className="tf-body">
        <p className="tf-eyebrow">Saisie du soir · 30 secondes</p>
        <h1 className="tf-h1">Provende, mortalité, charges</h1>
        <p className="tf-sub">Choisis le bâtiment, tape les chiffres, enregistre.</p>

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
            <span className="tf-cardtitle">{lot?.id} — {date === today() ? "aujourd'hui" : dLabel(date)}</span>
            <span className="tf-tag">{lot?.en_ponte ? "EN PONTE" : "POULETTES"}</span>
          </div>
          <div className="tf-grid2">
            <NumField label="Provende" unit="kg" value={val("kg")} onOpen={() => open("kg", "Provende distribuée", "kg")}
                onChange={(v) => poser("kg", v)} />
            <NumField label="Mortalité" unit="têtes" tone="brick" value={val("mort")} onOpen={() => open("mort", "Mortalité du jour", "têtes")}
                onChange={(v) => poser("mort", v)} />
          </div>
          <div className="tf-live">
            <span className="tf-live-n">{grammesParPoule ? fmt(grammesParPoule) : "—"}</span>
            <span className="tf-live-l">grammes par poule · norme 110–125 g</span>
          </div>
        </div>

        <div className="tf-card">
          <div className="tf-cardhead">
            <span className="tf-cardtitle">Provende en stock</span>
            <span className="tf-tag">1 SAC = {SAC_KG} KG</span>
          </div>
          <div className="tf-grid2">
            <NumField label="Sacs reçus" unit="sacs" value={val("sacs")}
              detail={val("sacs") ? `${fmt(val("sacs") * SAC_KG)} kg` : null}
              onOpen={() => open("sacs", "Sacs de provende reçus", "sacs")}
                onChange={(v) => poser("sacs", v)} />
            {/* Le reste est calculé, donc il dérive : un sac non noté, une
                distribution oubliée, et l'écart s'installe. Ce champ devient
                modifiable pour caler l'application sur les sacs réellement
                comptés — la correction est enregistrée comme une entrée de
                stock, positive ou négative. */}
            <NumField label="Reste aujourd'hui" unit="kg" value={Math.max(0, stockAffiche)}
              detail={stockAffiche > 0 ? `${(stockAffiche / SAC_KG).toFixed(1)} sacs` : null}
              onOpen={() => setPad({
                key: "reste_reel",
                label: "Sacs réellement comptés en magasin",
                unit: "kg",
                value: Math.max(0, stockAffiche),
              })} />
          </div>
          {stockIncoherent ? (
            <div className="tf-live" data-alerte="1">
              <span className="tf-live-n">{fmt(-stockAffiche)}</span>
              <span className="tf-live-l">
                kg distribués de plus que ce qui a été reçu — il manque des livraisons
              </span>
            </div>
          ) : (
            <div className="tf-live" data-alerte={autonomie !== null && autonomie < 7 ? 1 : 0}>
              <span className="tf-live-n">{autonomie === null ? "—" : autonomie.toFixed(0)}</span>
              <span className="tf-live-l">
                jours d'autonomie
                {conso ? ` · ${fmt(conso)} kg par jour en moyenne` : " · consommation pas encore connue"}
              </span>
            </div>
          )}
          <p className="tf-note">
            {stockIncoherent
              ? "Saisis ce qui restait réellement en magasin comme des sacs reçus, à la date où le comptage a été fait : le calcul repartira juste."
              : "Note les sacs le jour où ils arrivent. Le reste est l'état du magasin à ce jour, toutes dates confondues — il ne suit pas la date affichée en haut : tout ce qui est entré, moins tout ce qui a été distribué."}
            {derniereLivraison && ` Dernière livraison le ${dLabel(derniereLivraison)}.`}
          </p>
        </div>

        <HistoriqueFerme lotId={lotId} vivant={lot?.vivant} />

        <div className="tf-card">
          <div className="tf-cardhead">
            <span className="tf-cardtitle">Charges ferme</span>
            <span className="tf-tag">{CATEGORIES_CHARGES.filter((c) => val("ch_" + c)).length} / {CATEGORIES_CHARGES.length}</span>
          </div>
          <div className="tf-cats">
            {CATEGORIES_CHARGES.map((c) => (
              <NumField key={c} label={c} unit="Ar" value={val("ch_" + c)} onOpen={() => open("ch_" + c, c, "Ar")}
                onChange={(v) => poser("ch_" + c, v)} />
            ))}
          </div>
          <div className="tf-live">
            <span className="tf-live-n">{fmt(totalCharges)}</span>
            <span className="tf-live-l">Ar de charges aujourd'hui</span>
          </div>
          <p className="tf-note">Laisse à zéro les postes sans dépense aujourd'hui. Seules les catégories remplies sont enregistrées.</p>
        </div>
      </main>

      <div className="tf-cta">
        <div className="tf-cta-in">
          <button className="tf-btn" disabled={!peutEnregistrer} onClick={enregistrer}>Enregistrer</button>
          <button className="tf-btn tf-btn-ghost" onClick={() => setDraft({})}>Effacer</button>
        </div>
      </div>

      {flash && <div className="tf-flash">{flash}</div>}
      <Keypad
        field={pad}
        onChange={setPadVal}
        onClose={() => {
          if (pad?.key === "reste_reel") corrigerStock(pad.value);
          setPad(null);
        }}
      />
    </div>
  );
}
