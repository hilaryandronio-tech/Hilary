import { useEffect, useMemo, useState } from "react";
import Header from "../components/Header";
import NumField from "../components/NumField";
import Keypad from "../components/Keypad";
import { fmt, today } from "../components/format";
import { ALV, CALIBRES, PRIX_BASE, CLIENTS_FALLBACK } from "../data/constants";
import { supabase } from "../lib/supabaseClient";
import { enqueue } from "../lib/offlineQueue";
import { useAuth } from "../context/AuthContext";

const slug = (nom) => nom.toLowerCase().replace(/[^a-z0-9]+/g, "_");
const prixClient = (cl, calibre) => cl?.tarifs?.[calibre] ?? PRIX_BASE[calibre];

export default function PointVente() {
  const { profil } = useAuth();
  const [clients, setClients] = useState(CLIENTS_FALLBACK);
  const [clientKey, setClientKey] = useState(slug(CLIENTS_FALLBACK[0].nom));
  const [draft, setDraft] = useState({});
  const [pad, setPad] = useState(null);
  const [flash, setFlash] = useState("");

  useEffect(() => {
    supabase
      .from("clients")
      .select("id, nom, tarifs_clients(calibre, prix)")
      .eq("actif", true)
      .then(({ data, error }) => {
        if (error || !data?.length) return; // hors ligne : liste sans id, non vendable
        const withTarifs = data.map((c) => ({
          id: c.id,
          nom: c.nom,
          tarifs: Object.fromEntries((c.tarifs_clients ?? []).map((t) => [t.calibre, t.prix])),
        }));
        setClients(withTarifs);
        setClientKey(slug(withTarifs[0].nom));
      });
  }, []);

  const val = (k) => draft[k] || 0;
  const open = (k, label, unit) => setPad({ key: k, label, unit, value: val(k) });
  const setPadVal = (v) => {
    setDraft({ ...draft, [pad.key]: v });
    setPad({ ...pad, value: v });
  };
  const paye = (k) => draft[`pay_${k}`] !== "credit";

  const client = clients.find((c) => slug(c.nom) === clientKey) ?? clients[0];
  const venteClient = (cl, c) => val(`v_${slug(cl.nom)}_${c}`) * ALV * prixClient(cl, c);
  const totalClients = useMemo(
    () => clients.reduce((s, cl) => s + CALIBRES.reduce((t, c) => t + venteClient(cl, c), 0), 0),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [draft, clients]
  );
  const totalClientCourant = CALIBRES.reduce((s, c) => s + venteClient(client, c), 0);

  const peutEnregistrer =
    totalClients > 0 || val("rec") > 0 || val("cred") > 0 || val("chgv") > 0;

  const enregistrer = async () => {
    const auteur = profil?.id;
    const jobs = [];

    for (const cl of clients) {
      const lignesCalibre = CALIBRES.filter((c) => val(`v_${slug(cl.nom)}_${c}`) > 0);
      if (!lignesCalibre.length) continue;
      if (!cl.id) {
        setFlash(`${cl.nom} : client non synchronisé, vente non enregistrée. Réessaie une fois en ligne.`);
        continue;
      }
      const venteId = crypto.randomUUID();
      const montant = lignesCalibre.reduce((s, c) => s + venteClient(cl, c), 0);
      jobs.push(
        enqueue({
          table: "ventes",
          payload: { id: venteId, date: today(), canal: "client", client_id: cl.id, montant, credit: !paye(slug(cl.nom)), auteur },
        })
      );
      jobs.push(
        enqueue({
          table: "vente_lignes",
          payload: lignesCalibre.map((c) => ({
            vente_id: venteId,
            calibre: c,
            alveoles: val(`v_${slug(cl.nom)}_${c}`),
            prix_unit: prixClient(cl, c),
          })),
        })
      );
    }

    if (val("rec")) {
      jobs.push(enqueue({ table: "ventes", payload: { date: today(), canal: "detail", montant: val("rec"), credit: false, auteur } }));
    }
    if (val("cred")) {
      jobs.push(enqueue({ table: "ventes", payload: { date: today(), canal: "detail", montant: val("cred"), credit: true, auteur } }));
    }
    if (val("chgv")) {
      jobs.push(enqueue({ table: "charges", payload: { date: today(), categorie: "Point de vente", montant: val("chgv"), origine: "point_vente", auteur } }));
    }

    await Promise.all(jobs);
    setDraft({});
    setFlash((f) => f || "Caisse clôturée.");
    setTimeout(() => setFlash(""), 3200);
  };

  return (
    <div className="tf">
      <Header />
      <main className="tf-body">
        <p className="tf-eyebrow">Clôture de caisse</p>
        <h1 className="tf-h1">Recettes et dépenses</h1>
        <p className="tf-sub">Ce que la caisse a encaissé aujourd'hui, et ce qui reste à encaisser.</p>

        <div className="tf-card">
          <div className="tf-cardhead">
            <span className="tf-cardtitle">Vente client</span>
            <span className="tf-tag">EN ALVÉOLES</span>
          </div>
          <div className="tf-chips">
            {clients.map((cl) => (
              <button key={cl.nom} className="tf-chip" data-on={clientKey === slug(cl.nom) ? 1 : 0}
                data-dot={CALIBRES.some((c) => val(`v_${slug(cl.nom)}_${c}`)) ? 1 : 0}
                onClick={() => setClientKey(slug(cl.nom))}>{cl.nom}</button>
            ))}
          </div>
          {client && (
            <>
              <div className="tf-grid4">
                {CALIBRES.map((c) => (
                  <NumField key={c} label={`${c} · ${prixClient(client, c)}`} unit=""
                    value={val(`v_${slug(client.nom)}_${c}`)}
                    onOpen={() => open(`v_${slug(client.nom)}_${c}`, `${client.nom} — ${c} à ${prixClient(client, c)} Ar`, "alv")} />
                ))}
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
          <div className="tf-cardhead"><span className="tf-cardtitle">Encaissements</span></div>
          <div className="tf-grid2">
            <NumField label="Recette du jour" unit="Ar" value={val("rec")} onOpen={() => open("rec", "Recette encaissée", "Ar")} />
            <NumField label="Vendu à crédit" unit="Ar" tone="brick" value={val("cred")} onOpen={() => open("cred", "Vendu à crédit", "Ar")} />
          </div>
          <div className="tf-live">
            <span className="tf-live-n">{fmt(val("rec") + val("cred") + totalClients)}</span>
            <span className="tf-live-l">Ar de chiffre d'affaires (caisse + clients)</span>
          </div>
        </div>

        <div className="tf-card">
          <div className="tf-cardhead"><span className="tf-cardtitle">Charges du point de vente</span></div>
          <NumField label="Total dépenses" unit="Ar" value={val("chgv")} onOpen={() => open("chgv", "Charges point de vente", "Ar")} />
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
