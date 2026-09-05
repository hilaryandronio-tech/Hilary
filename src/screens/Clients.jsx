import { useEffect, useMemo, useRef, useState } from "react";
import Header from "../components/Header";
import { fmt, dLabel, today } from "../components/format";
import { supabase } from "../lib/supabaseClient";
import { onQueueChange, operationsEnAttente } from "../lib/offlineQueue";
import AlerteEchecs from "../components/AlerteEchecs";
import ChoixClient from "../components/ChoixClient";
import Facture from "../components/Facture";
import NouveauClient from "../components/NouveauClient";
import { useClients } from "../lib/useClients";

const TABLES = ["ventes", "vente_lignes"];

// Le compte d'un client grossiste : l'historique de ses livraisons, réglées
// ou non. L'écran Créances ne montre que les impayées — une livraison
// encaissée hier n'y est plus consultable nulle part.

const moisCourant = () => today().slice(0, 7);

const jourPlus = (iso, n) => {
  const d = new Date(iso + "T12:00:00");
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
};

// La dernière semaine complète, lundi au dimanche — le rythme des factures
// hebdomadaires envoyées jusqu'ici.
const derniereSemaine = () => {
  const d = new Date(today() + "T12:00:00");
  const depuisLundi = (d.getDay() + 6) % 7;          // dimanche = 6, lundi = 0
  const dimanche = jourPlus(today(), -depuisLundi - 1);
  return { du: jourPlus(dimanche, -6), au: dimanche };
};

const bornesMois = (mois) => {
  const [a, m] = mois.split("-").map(Number);
  const dernier = new Date(Date.UTC(a, m, 0)).getUTCDate();
  return [`${mois}-01`, `${mois}-${String(dernier).padStart(2, "0")}`];
};

const decalerMois = (mois, n) => {
  const [a, m] = mois.split("-").map(Number);
  return new Date(Date.UTC(a, m - 1 + n, 1)).toISOString().slice(0, 7);
};

const labelMois = (mois) =>
  new Date(mois + "-01T12:00:00").toLocaleDateString("fr-FR", { month: "long", year: "numeric" });

// Le règlement n'est plus un drapeau sur la vente mais une somme de lignes
// datées (docs/05-migration-encaissement-partiel.sql) : une livraison peut
// être réglée en plusieurs fois, et le statut doit le dire.
const totalRegle = (l) => (l.reglements ?? []).reduce((s, r) => s + r.montant, 0);

function statut(l) {
  if (l.enAttente) return { texte: "En attente de synchronisation", alerte: false };
  if (!l.credit) return { texte: "Payée comptant", alerte: false };
  const regle = totalRegle(l);
  if (regle >= l.montant) {
    const dernier = (l.reglements ?? []).map((r) => r.date).sort().at(-1);
    return { texte: `Encaissée le ${dLabel(dernier)}`, alerte: false };
  }
  if (regle > 0) {
    return { texte: `À crédit · ${fmt(regle)} sur ${fmt(l.montant)} réglés`, alerte: true };
  }
  return { texte: "À crédit · non réglée", alerte: true };
}

export default function Clients() {
  const clients = useClients();
  const [clientNom, setClientNom] = useState(null);
  const [mois, setMois] = useState(moisCourant());
  const [serveur, setServeur] = useState([]);
  const [file, setFile] = useState([]);
  const [aFacturer, setAFacturer] = useState(null);
  const [panne, setPanne] = useState(null);
  const [semaine, setSemaine] = useState(derniereSemaine);
  const [periode, setPeriode] = useState(null);
  const [cherche, setCherche] = useState(false);
  const requete = useRef(0);

  const client = clients.find((c) => c.nom === clientNom) ?? clients[0];

  const chargerServeur = async (jeton) => {
    if (!client?.id) return { ids: new Set() };
    const [debut, fin] = bornesMois(mois);
    const { data, error } = await supabase
      .from("ventes")
      .select("id, date, created_at, numero_commande, numero_facture, montant, credit, vente_lignes(calibre, oeufs, prix_unit), reglements(date, montant), commandes(numero)")
      .eq("client_id", client.id)
      .gte("date", debut)
      .lte("date", fin)
      .order("date", { ascending: false });
    // Seule la dernière requête demandée a le droit d'écrire dans l'état.
    if (jeton !== requete.current) return { ids: new Set() };
    // Une requête refusée — colonne absente, droits manquants — rendait un
    // écran vide indiscernable d'un client sans livraison. Deux fois déjà ce
    // silence a fait chercher des données perdues qui ne l'étaient pas.
    // Une panne de réseau, elle, reste muette : c'est le régime normal ici,
    // et on garde ce qu'on savait.
    if (error && error.code) {
      setPanne(`Lecture refusée par la base : ${error.message}`);
      return { ids: new Set() };
    }
    if (error || !data) return { ids: new Set() }; // hors ligne : on garde ce qu'on savait
    setPanne(null);
    setServeur(data.map((v) => ({ ...v, lignes: v.vente_lignes ?? [] })));
    return { ids: new Set(data.map((v) => v.id)) };
  };

  const chargerFile = async (dejaSurLeServeur) => {
    if (!client?.id) return setFile([]);
    const [debut, fin] = bornesMois(mois);
    const [entetes, lignes] = await Promise.all([
      operationsEnAttente("ventes"),
      operationsEnAttente("vente_lignes"),
    ]);
    // Une livraison qui vient d'être synchronisée mais n'a pas encore quitté
    // la file apparaîtrait deux fois : le serveur fait foi.
    const enAttente = entetes
      .map((op) => op.payload)
      .filter(
        (v) =>
          v?.client_id === client.id &&
          v.date >= debut &&
          v.date <= fin &&
          !dejaSurLeServeur.has(v.id)
      );
    const parVente = {};
    lignes.forEach((op) => {
      [].concat(op.payload).forEach((l) => {
        (parVente[l.vente_id] ??= []).push(l);
      });
    });
    setFile(enAttente.map((v) => ({ ...v, lignes: parVente[v.id] ?? [], enAttente: true })));
  };

  useEffect(() => {
    const jeton = ++requete.current;
    setServeur([]);
    setFile([]);
    const relire = async () => {
      const { ids } = await chargerServeur(jeton);
      await chargerFile(ids);
    };
    relire();
    return onQueueChange(relire);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [client?.id, mois]);

  const editerPeriode = async () => {
    if (!client?.id) return;
    setCherche(true);
    const { data, error } = await supabase
      .from("ventes")
      .select("id, date, numero_commande, numero_facture, vente_lignes(calibre, oeufs, prix_unit), commandes(numero)")
      .eq("client_id", client.id)
      .gte("date", semaine.du)
      .lte("date", semaine.au)
      .order("date");
    setCherche(false);
    if (error || !data?.length) {
      window.alert("Aucune livraison sur cette période.");
      return;
    }
    setPeriode({
      du: semaine.du,
      au: semaine.au,
      // Les factures existantes sont émises le lendemain de la période.
      emise: jourPlus(semaine.au, 1),
      ventes: data.map((v) => ({ ...v, lignes: v.vente_lignes ?? [] })),
    });
  };

  const livraisons = useMemo(
    () => [...file, ...serveur].sort((a, b) => b.date.localeCompare(a.date)),
    [file, serveur]
  );
  const totalMois = livraisons.reduce((s, l) => s + (l.montant ?? 0), 0);
  // Reste dû = ce qui a été livré à crédit moins ce qui a été réglé dessus,
  // règlements partiels compris.
  const restantDu = livraisons
    .filter((l) => l.credit)
    .reduce((s, l) => s + Math.max(0, (l.montant ?? 0) - totalRegle(l)), 0);
  const moisFutur = decalerMois(mois, 1) > moisCourant();

  return (
    <div className="tf">
      <Header />
      <main className="tf-body">
        <p className="tf-eyebrow">Compte client</p>
        <h1 className="tf-h1">Historique des livraisons</h1>
        <p className="tf-sub">Toutes les livraisons du client, réglées ou non, mois par mois.</p>

        {/* Créer le client depuis l'écran qui montre déjà toute la liste :
            c'est là qu'on constate qu'il manque. Sélectionné aussitôt créé,
            pour enchaîner sur sa fiche sans le rechercher. */}
        <NouveauClient clients={clients} onCree={setClientNom} />

        <ChoixClient clients={clients} selection={client?.nom} onSelect={setClientNom} />

        <div className="tf-dateselect">
          <button className="tf-dateselect-nav" onClick={() => setMois(decalerMois(mois, -1))}
            aria-label="Mois précédent">‹</button>
          <div className="tf-dateselect-val">{labelMois(mois)}</div>
          <button className="tf-dateselect-nav" onClick={() => setMois(decalerMois(mois, 1))}
            disabled={moisFutur} aria-label="Mois suivant">›</button>
          {mois !== moisCourant() && (
            <button className="tf-dateselect-today" onClick={() => setMois(moisCourant())}>Ce mois</button>
          )}
        </div>

        <div className="tf-kpis">
          <div className="tf-kpi" data-hero="1">
            <div className="tf-kpi-n">{fmt(totalMois)}</div>
            <div className="tf-kpi-l">Ar livrés · {livraisons.length} livraison{livraisons.length > 1 ? "s" : ""}</div>
          </div>
          <div className="tf-kpi" data-alert={restantDu ? 1 : 0}>
            <div className="tf-kpi-n">{fmt(restantDu)}</div>
            <div className="tf-kpi-l">Ar restant dû sur le mois</div>
          </div>
        </div>

        {/* Certains clients — Mercy Ships — reçoivent une facture par semaine
            plutôt qu'une par livraison. La période est libre : la semaine
            écoulée est proposée, elle se change à la main. */}
        <div className="tf-card">
          <div className="tf-cardhead">
            <span className="tf-cardtitle">Facture de période</span>
            <span className="tf-tag">PLUSIEURS LIVRAISONS</span>
          </div>
          <div className="tf-grid2">
            <label className="tf-field">
              <span className="tf-label">Du</span>
              <input className="tf-saisie" type="date" value={semaine.du} max={semaine.au}
                onChange={(e) => setSemaine((s) => ({ ...s, du: e.target.value }))} />
            </label>
            <label className="tf-field">
              <span className="tf-label">Au</span>
              <input className="tf-saisie" type="date" value={semaine.au} min={semaine.du} max={today()}
                onChange={(e) => setSemaine((s) => ({ ...s, au: e.target.value }))} />
            </label>
          </div>
          <div className="tf-cta-in" style={{ marginTop: 8 }}>
            <button className="tf-btn" onClick={editerPeriode} disabled={!client?.id || cherche}>
              {cherche ? "…" : "Éditer la facture"}
            </button>
          </div>
        </div>

        {panne && (
          <div className="tf-card">
            <p className="tf-livraison-s" data-alerte="1">{panne}</p>
            <p className="tf-note">
              L'historique affiché est peut-être incomplet. Ce n'est pas une coupure réseau :
              la base a répondu, en refusant. Une migration non exécutée en est la cause la
              plus fréquente.
            </p>
          </div>
        )}

        <AlerteEchecs tables={TABLES} />

        {!client?.id && (
          <div className="tf-card">
            <p className="tf-empty">
              Client pas encore synchronisé — l'historique demande une connexion au moins une fois.
            </p>
          </div>
        )}

        {client?.id && livraisons.length === 0 && (
          <div className="tf-card">
            <p className="tf-empty">Aucune livraison à {client.nom} sur {labelMois(mois)}.</p>
          </div>
        )}

        {livraisons.map((l) => {
          const s = statut(l);
          return (
            <div className="tf-card" key={l.id}>
              <div className="tf-cardhead">
                <span className="tf-cardtitle">{dLabel(l.date)}</span>
                <span className="tf-tag">{fmt(l.montant)} AR</span>
              </div>
              <div className="tf-livraison-s" data-alerte={s.alerte ? 1 : 0}>{s.texte}</div>
              {/* Une livraison encore en file n'a ni heure d'enregistrement ni
                  numéro : sa facture serait sans référence. */}
              {!l.enAttente && l.lignes.length > 0 && (
                <div className="tf-due-actions">
                  <button className="tf-due-btn" onClick={() => setAFacturer(l)}>Facture</button>
                </div>
              )}
              {l.lignes.length > 0 ? (
                <div className="tf-ticket">
                  {l.lignes.map((ligne) => (
                    <div className="tf-ticket-row" key={ligne.calibre}>
                      <span>{ligne.calibre === "CASSE" ? "Cassés" : ligne.calibre}</span>
                      <span>{fmt(ligne.oeufs)} œufs × {fmt(ligne.prix_unit)} Ar</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="tf-note">Livraison saisie en montant global, sans détail par calibre.</p>
              )}
            </div>
          );
        })}
      </main>

      {periode && (
        <Facture vente={{}} client={client} periode={periode} onFermer={() => setPeriode(null)} />
      )}

      {aFacturer && (
        <Facture
          vente={aFacturer}
          client={client}
          commande={aFacturer.commandes?.[0]}
          onFermer={() => setAFacturer(null)}
        />
      )}
    </div>
  );
}
