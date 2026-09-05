import { useEffect, useMemo, useState } from "react";
import Header from "../components/Header";
import NumField from "../components/NumField";
import Keypad from "../components/Keypad";
import DateSelector from "../components/DateSelector";
import ReleveVentes from "../components/ReleveVentes";
import ChoixClient from "../components/ChoixClient";
import { fmt, today, dLabel } from "../components/format";
import { CALIBRES, POIDS, PRIX_BASE, PRIX_CASSE, CLIENTS_FALLBACK, CATEGORIES_CHARGES_VENTE } from "../data/constants";
import { supabase } from "../lib/supabaseClient";
import { enqueue, uuid } from "../lib/offlineQueue";
import { lectureCachee } from "../lib/cacheLecture";
import { useClients } from "../lib/useClients";
import { useAuth } from "../context/AuthContext";

const slug = (nom) => nom.toLowerCase().replace(/[^a-z0-9]+/g, "_");
// Les cassés se vendent, mais pas aux clients grossistes (grille "Vente
// client") ni comme un calibre normal — juste à l'unité, au comptoir.
const CALIBRES_DETAIL = [...CALIBRES, "CASSE"];
const libelle = (c) => (c === "CASSE" ? "Cassés" : c);

export default function PointVente() {
  const { profil } = useAuth();
  const clients = useClients();
  const [clientKey, setClientKey] = useState(slug(CLIENTS_FALLBACK[0].nom));
  const [prixBase, setPrixBase] = useState({ ...PRIX_BASE, CASSE: PRIX_CASSE });
  const [date, setDate] = useState(today());
  const [draft, setDraft] = useState({});
  const [pad, setPad] = useState(null);
  const [flash, setFlash] = useState("");
  const peutModifierPrix = profil?.role === "direction";

  // Le client sélectionné doit rester dans la liste chargée depuis Supabase.
  useEffect(() => {
    setClientKey((k) => (clients.some((c) => slug(c.nom) === k) ? k : slug(clients[0].nom)));
  }, [clients]);

  useEffect(() => {
    lectureCachee("calibres", () => supabase.from("calibres").select("code, prix_base"))
      .then(({ data }) => {
        if (!data?.length) return; // jamais chargé et hors ligne : repli local
        // Fusion sur le repli, jamais remplacement : un calibre absent de la
        // table `calibres` laisserait sinon son prix indéfini, la ligne de
        // vente partirait sans prix_unit et Supabase la refuserait — la vente
        // disparaîtrait des relevés sans que personne comprenne pourquoi.
        setPrixBase((p) => ({ ...p, ...Object.fromEntries(data.map((c) => [c.code, c.prix_base])) }));
      });
  }, []);

  const prixClient = (cl, calibre) => cl?.tarifs?.[calibre] ?? prixBase[calibre];

  const val = (k) => draft[k] || 0;
  // Saisie directe à la souris : même effet que le pavé, sans passer par lui.
  const poser = (k, v) => setDraft((d) => ({ ...d, [k]: v }));

  const open = (k, label, unit) => setPad({ key: k, label, unit, value: val(k) });
  const modifierPrixBase = async (calibre, prix) => {
    setPrixBase((p) => ({ ...p, [calibre]: prix }));
    await enqueue({ table: "calibres", kind: "update", payload: { prix_base: prix }, match: { code: calibre } });
  };
  const setPadVal = (v) => {
    if (pad.key.startsWith("prix_")) {
      modifierPrixBase(pad.key.slice(5), v);
    } else {
      setDraft({ ...draft, [pad.key]: v });
    }
    setPad({ ...pad, value: v });
  };
  const paye = (k) => draft[`pay_${k}`] !== "credit";

  const client = clients.find((c) => slug(c.nom) === clientKey) ?? clients[0];
  const venteClient = (cl, c) => val(`v_${slug(cl.nom)}_${c}`) * prixClient(cl, c);
  const totalClients = useMemo(
    () => clients.reduce((s, cl) => s + CALIBRES.reduce((t, c) => t + venteClient(cl, c), 0), 0),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [draft, clients]
  );
  const totalClientCourant = CALIBRES.reduce((s, c) => s + venteClient(client, c), 0);

  // Vente au comptoir, prix de base — distincte de la grille clients
  // grossistes (tarifs négociés), les deux comptent en œufs à l'unité pour
  // pouvoir saisir une commande qui n'est pas un multiple de 30.
  const totalDetail = useMemo(
    () => CALIBRES_DETAIL.reduce((s, c) => s + val("d" + c) * prixBase[c], 0),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [draft, prixBase]
  );

  const totalCharges = useMemo(
    () => CATEGORIES_CHARGES_VENTE.reduce((s, c) => s + val("ch_" + c), 0),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [draft]
  );

  const peutEnregistrer =
    totalClients > 0 || totalDetail > 0 || val("rec") > 0 || val("cred") > 0 || totalCharges > 0;

  // Les lignes portent une clé étrangère vers l'en-tête de vente : tout part
  // en file d'attente dans l'ordre de saisie, jamais en parallèle.
  // Une exception ici interrompait la fonction sans un mot : pas de ligne en
  // file, donc pas de badge non plus, et la caisse semblait enregistrée alors
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

    for (const cl of clients) {
      const lignesCalibre = CALIBRES.filter((c) => val(`v_${slug(cl.nom)}_${c}`) > 0);
      if (!lignesCalibre.length) continue;
      if (!cl.id) {
        setFlash(`${cl.nom} : client non synchronisé, vente non enregistrée. Réessaie une fois en ligne.`);
        continue;
      }
      // `vente_lignes.prix_unit` est NOT NULL : une ligne sans prix serait
      // refusée par Supabase et la vente entière partirait en échec. Mieux
      // vaut le dire ici, tant que la saisie est encore à l'écran.
      const sansPrix = lignesCalibre.filter((c) => !(prixClient(cl, c) > 0));
      if (sansPrix.length) {
        setFlash(`${cl.nom} : prix inconnu pour ${sansPrix.join(", ")}. Vente non enregistrée.`);
        continue;
      }
      const venteId = uuid();
      const montant = lignesCalibre.reduce((s, c) => s + venteClient(cl, c), 0);
      await enqueue({
        table: "ventes",
        conflict: "id",
        groupe: venteId,
        payload: { id: venteId, date, canal: "client", client_id: cl.id, montant, credit: !paye(slug(cl.nom)), auteur },
      });
      await enqueue({
        table: "vente_lignes",
        conflict: "vente_id,calibre",
        groupe: venteId,
        payload: lignesCalibre.map((c) => ({
          vente_id: venteId,
          calibre: c,
          oeufs: val(`v_${slug(cl.nom)}_${c}`),
          prix_unit: prixClient(cl, c),
        })),
      });
    }

    const lignesDetail = CALIBRES_DETAIL.filter((c) => val("d" + c) > 0);
    const detailSansPrix = lignesDetail.filter((c) => !(prixBase[c] > 0));
    if (detailSansPrix.length) {
      setFlash(`Vente au détail : prix inconnu pour ${detailSansPrix.join(", ")}. Non enregistrée.`);
    } else if (lignesDetail.length) {
      const venteId = uuid();
      await enqueue({
        table: "ventes",
        conflict: "id",
        groupe: venteId,
        payload: { id: venteId, date, canal: "detail", montant: totalDetail, credit: false, auteur },
      });
      await enqueue({
        table: "vente_lignes",
        conflict: "vente_id,calibre",
        groupe: venteId,
        payload: lignesDetail.map((c) => ({
          vente_id: venteId,
          calibre: c,
          oeufs: val("d" + c),
          prix_unit: prixBase[c],
        })),
      });
    }

    // Identifiants tirés au sort, pas déduits du jour : deux clôtures de caisse
    // le même jour restent deux recettes distinctes. Ils servent uniquement à
    // ce qu'une re-synchro rejoue la même ligne au lieu de la dupliquer.
    if (val("rec")) {
      await enqueue({
        table: "ventes",
        conflict: "id",
        payload: { id: uuid(), date, canal: "detail", montant: val("rec"), credit: false, auteur },
      });
    }
    if (val("cred")) {
      await enqueue({
        table: "ventes",
        conflict: "id",
        payload: { id: uuid(), date, canal: "detail", montant: val("cred"), credit: true, auteur },
      });
    }
    for (const c of CATEGORIES_CHARGES_VENTE) {
      if (val("ch_" + c)) {
        await enqueue({
          table: "charges",
          conflict: "id",
          payload: { id: uuid(), date, categorie: c, montant: val("ch_" + c), origine: "point_vente", auteur },
        });
      }
    }

    setDraft({});
    setFlash((f) => f || (date === today() ? "Caisse clôturée." : `Caisse clôturée pour le ${dLabel(date)}.`));
    setTimeout(() => setFlash(""), 3200);
  };

  return (
    <div className="tf">
      <Header />
      <main className="tf-body">
        <p className="tf-eyebrow">Clôture de caisse</p>
        <h1 className="tf-h1">Recettes et dépenses</h1>
        <p className="tf-sub">Ce que la caisse a encaissé aujourd'hui, et ce qui reste à encaisser.</p>

        <DateSelector value={date} onChange={(d) => { setDate(d); setDraft({}); }} />

        {/* Ce qui est déjà sorti ce jour-là, avant d'en ajouter. */}
        <ReleveVentes date={date} />

        <div className="tf-card">
          <div className="tf-cardhead">
            <span className="tf-cardtitle">Vente client</span>
            <span className="tf-tag">EN ŒUFS</span>
          </div>
          <ChoixClient
            clients={clients}
            selection={client?.nom}
            onSelect={(nom) => setClientKey(slug(nom))}
            marque={(cl) => CALIBRES.some((c) => val(`v_${slug(cl.nom)}_${c}`))}
          />
          {/* Sans identifiant Supabase, la commande sera refusée à
              l'enregistrement. Le dire ici, en clair et en permanence : le
              message de trois secondes après l'appui passait inaperçu, et
              c'est une commande entière qui disparaissait. */}
          {client && !client.id && (
            <p className="tf-note" data-alerte="1">
              {client.nom} n'est pas synchronisé depuis Supabase : impossible d'enregistrer une
              commande à son nom. Reconnecte-toi une fois en ligne, puis recharge l'écran.
            </p>
          )}
          {client && (
            <>
              {/* Le nom du client destinataire, juste au-dessus de la grille :
                  chercher un client sans cliquer sur sa pastille puis saisir
                  enverrait la commande au précédent. */}
              <div className="tf-destinataire">
                Commande de <strong>{client.nom}</strong>
              </div>
              <div className="tf-grid4">
                {CALIBRES.map((c) => {
                  const n = val(`v_${slug(client.nom)}_${c}`);
                  // Le prix va dans la ligne déjà réservée sous la valeur, pas
                  // dans le titre : un libellé long passait à la ligne et
                  // cassait l'alignement des rangées.
                  return (
                    <NumField key={c} label={c} sous={POIDS[c]}
                      unit="œufs" value={n}
                      detail={n ? `${fmt(n * prixClient(client, c))} Ar` : `${prixClient(client, c)} Ar/œuf`}
                      onOpen={client.id
                        ? () => open(`v_${slug(client.nom)}_${c}`,
                            `${client.nom} — ${c} (${POIDS[c]}) à ${prixClient(client, c)} Ar`, "œufs")
                        : undefined}
                      onChange={client.id ? (v) => poser(`v_${slug(client.nom)}_${c}`, v) : undefined} />
                  );
                })}
              </div>
              <div className="tf-live">
                <span className="tf-live-n">{fmt(totalClientCourant)}</span>
                <span className="tf-live-l">Ar — commande {client.nom}</span>
              </div>
              <div className="tf-toggle">
                <button className="tf-chip" data-on={paye(slug(client.nom)) ? 1 : 0}
                  onClick={() => setDraft({ ...draft, [`pay_${slug(client.nom)}`]: "paye" })}>Payé</button>
                <button className="tf-chip" data-warn="1" data-on={!paye(slug(client.nom)) ? 1 : 0}
                  onClick={() => setDraft({ ...draft, [`pay_${slug(client.nom)}`]: "credit" })}>À crédit</button>
              </div>
            </>
          )}
          <p className="tf-note">
            Les tailles négociées avec ce client s'appliquent automatiquement, les autres partent au prix de base.
            Le point orange signale un client déjà saisi aujourd'hui.
          </p>
        </div>

        <div className="tf-card">
          <div className="tf-cardhead">
            <span className="tf-cardtitle">Vente au détail par calibre</span>
            <span className="tf-tag">EN ŒUFS</span>
          </div>
          <div className="tf-grid4">
            {CALIBRES_DETAIL.map((c) => (
              <NumField key={c} label={libelle(c)} sous={POIDS[c]}
                unit="œufs" value={val("d" + c)}
                detail={val("d" + c) ? `${fmt(val("d" + c) * prixBase[c])} Ar` : `${prixBase[c]} Ar/œuf`}
                onOpen={() => open("d" + c, `${libelle(c)} (${POIDS[c]}) — ${prixBase[c]} Ar/œuf`, "œufs")}
                onChange={(v) => poser("d" + c, v)} />
            ))}
          </div>
          <div className="tf-live">
            <span className="tf-live-n">{fmt(totalDetail)}</span>
            <span className="tf-live-l">Ar — vente au détail</span>
          </div>
          <p className="tf-note">Pour un client de passage qui n'achète pas une alvéole complète — au prix de base, pas de tarif négocié. Les cassés se vendent aussi ici.</p>
        </div>

        <div className="tf-card">
          <div className="tf-cardhead"><span className="tf-cardtitle">Encaissements</span></div>
          <div className="tf-grid2">
            <NumField label="Recette du jour" unit="Ar" value={val("rec")} onOpen={() => open("rec", "Recette encaissée", "Ar")}
                onChange={(v) => poser("rec", v)} />
            <NumField label="Vendu à crédit" unit="Ar" tone="brick" value={val("cred")} onOpen={() => open("cred", "Vendu à crédit", "Ar")}
                onChange={(v) => poser("cred", v)} />
          </div>
          <div className="tf-live">
            <span className="tf-live-n">{fmt(val("rec") + val("cred") + totalClients + totalDetail)}</span>
            <span className="tf-live-l">Ar de chiffre d'affaires (caisse + clients + détail)</span>
          </div>
        </div>

        <div className="tf-card">
          <div className="tf-cardhead">
            <span className="tf-cardtitle">Charges du point de vente</span>
            <span className="tf-tag">{CATEGORIES_CHARGES_VENTE.filter((c) => val("ch_" + c)).length} / {CATEGORIES_CHARGES_VENTE.length}</span>
          </div>
          <div className="tf-cats">
            {CATEGORIES_CHARGES_VENTE.map((c) => (
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

        <div className="tf-card">
          <div className="tf-cardhead">
            <span className="tf-cardtitle">Prix des œufs par calibre</span>
            <span className="tf-tag">{peutModifierPrix ? "MODIFIABLE" : "DIRECTION SEULE"}</span>
          </div>
          <div className="tf-grid4">
            {CALIBRES_DETAIL.map((c) => (
              <NumField key={c} label={libelle(c)} sous={POIDS[c]} unit="Ar" value={prixBase[c]}
                onOpen={peutModifierPrix
                  ? () => setPad({ key: `prix_${c}`, label: `Prix ${libelle(c)} (${POIDS[c]})`, unit: "Ar", value: prixBase[c] })
                  : undefined} />
            ))}
          </div>
          <p className="tf-note">
            {peutModifierPrix
              ? "S'applique aux nouvelles ventes uniquement — les ventes déjà enregistrées gardent leur prix figé."
              : "Modifiable uniquement par un compte Direction."}
          </p>
        </div>
      </main>

      <div className="tf-cta">
        <div className="tf-cta-in">
          <button className="tf-btn" disabled={!peutEnregistrer} onClick={enregistrer}>Enregistrer</button>
          <button className="tf-btn tf-btn-ghost" onClick={() => setDraft({})}>Effacer</button>
        </div>
      </div>

      {flash && <div className="tf-flash">{flash}</div>}
      <Keypad field={pad} onChange={setPadVal} onClose={() => setPad(null)} />
    </div>
  );
}
