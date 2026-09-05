import { useEffect } from "react";
import { fmt } from "./format";
import { FERME, ADRESSE, PAIEMENT, SIGNATURE, MOTS } from "../data/ferme";
import { sommeArrettee, sumInWords } from "../lib/enLettres";

// La facture d'une livraison, reproduite d'après les modèles existants
// (Leader Price du 2026-09-03 en français, Mercy Ships du 2026-09-05 en
// anglais). Elle s'imprime depuis le navigateur : « Enregistrer au format
// PDF » donne le fichier à envoyer, et rien ne dépend du réseau.

// Le numéro reprend le format du carnet — F-AAAAMMJJ-HHMMSS — dérivé de
// l'heure d'enregistrement de la vente, déjà en base. Il est donc stable :
// rouvrir la facture d'une livraison rend toujours le même numéro, sans
// colonne supplémentaire ni compteur à tenir.
export function numeroFacture(created_at) {
  const d = new Date(created_at);
  const p = (n) => String(n).padStart(2, "0");
  return `F-${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-` +
    `${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
}

// « 03 Septembre 2026 » : les deux modèles écrivent le mois en français, y
// compris la facture anglaise. On les suit.
const dateLongue = (iso) => {
  const d = new Date(iso + "T12:00:00");
  const mois = d.toLocaleDateString("fr-FR", { month: "long" });
  return `${String(d.getDate()).padStart(2, "0")} ${mois[0].toUpperCase()}${mois.slice(1)} ${d.getFullYear()}`;
};

// La signature, recadrée sur l'encre. Une image dans une fenêtre plutôt qu'une
// image de fond : les navigateurs suppriment couramment les fonds à
// l'impression, et une facture sans paraphe n'a pas d'intérêt.
function Paraphe() {
  if (!SIGNATURE?.fichier) return <div className="tf-facture-paraphe" />;
  const { fichier, image, cadre, largeurRendue } = SIGNATURE;
  const e = largeurRendue / cadre.l;
  return (
    <div className="tf-facture-paraphe"
         style={{ width: largeurRendue, height: Math.round(cadre.h * e) }}>
      <img src={fichier} alt="" style={{
        width: Math.round(image[0] * e), maxWidth: "none",
        marginLeft: -Math.round(cadre.x * e), marginTop: -Math.round(cadre.y * e),
      }} />
    </div>
  );
}

const dateAnglaise = (iso, avecAnnee = true) => {
  const d = new Date(iso + "T12:00:00");
  const mois = d.toLocaleDateString("en-US", { month: "long" });
  return `${mois} ${d.getDate()}${avecAnnee ? `, ${d.getFullYear()}` : ""}`;
};
const dateFrancaise = (iso, avecAnnee = true) => {
  const d = new Date(iso + "T12:00:00");
  const mois = d.toLocaleDateString("fr-FR", { month: "long" });
  return `${d.getDate()} ${mois}${avecAnnee ? ` ${d.getFullYear()}` : ""}`;
};

// Poppins et Source Serif ne servent qu'ici. On les charge à l'ouverture
// d'une facture plutôt qu'au démarrage : l'équipe saisit sur des téléphones
// et une connexion de ferme, deux familles de plus au chargement seraient
// payées par tout le monde pour un écran que trois personnes ouvrent.
const POLICES = "https://fonts.googleapis.com/css2?family=Poppins:wght@400;700;900&family=Source+Serif+4:opsz,wght@8..60,400&display=swap";

function usePolicesFacture() {
  useEffect(() => {
    if (document.getElementById("polices-facture")) return;
    const lien = document.createElement("link");
    lien.id = "polices-facture";
    lien.rel = "stylesheet";
    lien.href = POLICES;
    document.head.append(lien);
  }, []);
}

export default function Facture({ vente, client, commande, periode, onFermer }) {
  usePolicesFacture();
  const langue = client?.langue === "en" ? "en" : "fr";
  const m = MOTS[langue];
  const paquet = client?.conditionnement > 0 ? client.conditionnement : 30;
  const lignes = periode ? [] : (vente.lignes ?? []);
  const plusieurs = lignes.length > 1;

  // Le prix facturé n'est pas toujours celui qu'encaisse la ferme : Mercy
  // Ships paie 1 000 Ar l'œuf, dont 200 vont à l'intermédiaire qui a trouvé le
  // contrat. La caisse enregistre les 800 qui reviennent à la ferme, la
  // facture affiche les 1 000 que le client paie. Sans tarif de facturation,
  // c'est le prix figé à la vente qui s'imprime — le cas de tous les autres.
  const prixFacture = (l) => client?.tarifsFacture?.[l.calibre] ?? l.prix_unit;

  const rendues = lignes.map((l) => {
    // L'application compte en œufs ; la facture compte en paquets. Une
    // quantité qui ne tombe pas juste est affichée telle quelle plutôt
    // qu'arrondie : mieux vaut un « 60,5 » qui fait tiquer qu'un total faux.
    const quantite = l.oeufs / paquet;
    return {
      calibre: l.calibre,
      // Le calibre n'apparaît pas sur les modèles — une livraison n'y porte
      // qu'une seule sorte d'œuf. Dès qu'il y en a plusieurs, il faut bien
      // distinguer les lignes.
      designation: (paquet > 1 ? m.paquet(paquet) : m.oeufs) +
        (plusieurs ? ` — ${l.calibre === "CASSE" ? "cassés" : l.calibre}` : ""),
      quantite: Number.isInteger(quantite) ? quantite : quantite.toFixed(2).replace(".", ","),
      prixUnit: prixFacture(l) * paquet,
      montant: l.oeufs * prixFacture(l),
    };
  });
  const dateCourte = langue === "en" ? dateAnglaise : dateFrancaise;
  // Une facture de période reprend une semaine de livraisons, chacune avec sa
  // date et son bon de commande. Une livraison à plusieurs calibres donne
  // plusieurs lignes : le modèle n'a qu'un prix unitaire par ligne.
  const renduesPeriode = (periode?.ventes ?? []).flatMap((v) =>
    (v.lignes ?? []).map((l) => ({
      cle: `${v.id}-${l.calibre}`,
      date: dateCourte(v.date),
      commande: v.commandes?.[0]?.numero ?? "",
      quantite: l.oeufs / paquet,
      prixUnit: prixFacture(l) * paquet,
      montant: l.oeufs * prixFacture(l),
    }))
  );
  const total = periode
    ? renduesPeriode.reduce((s, l) => s + l.montant, 0)
    : rendues.reduce((s, l) => s + l.montant, 0);
  const delai = client?.delai_paiement_jours ?? 0;
  const complet = client?.modele === "complet";
  const nomImprime = client?.nom_facture || client?.nom;

  // Mada-Rest exige la date de ponte et celle de péremption. Les factures
  // existantes prennent la veille de la livraison, et vingt et un jours de
  // conservation — 26 août pondu, 16 septembre périmé.
  const jourPlus = (iso, n) => {
    const d = new Date(iso + "T12:00:00");
    d.setDate(d.getDate() + n);
    return d.toISOString().slice(0, 10);
  };
  // Une facture de période n'a pas de livraison unique : pas de date de ponte
  // à en tirer, et `vente` y est vide.
  const ponte = periode ? null : jourPlus(vente.date, -1);

  // Le navigateur nomme le PDF d'après le titre de la page. Sans ça, chaque
  // facture enregistrée s'appelait « Tama Ferme — Gestion.pdf » et il fallait
  // les renommer une par une avant de les envoyer.
  const nomFichier = periode
    ? `Facture ${nomImprime} du ${periode.du} au ${periode.au}`
    : `${numeroFacture(vente.created_at)} ${nomImprime}`;
  useEffect(() => {
    const avant = document.title;
    document.title = nomFichier;
    return () => { document.title = avant; };
  }, [nomFichier]);

  return (
    <div className="tf-facture-fond" onClick={onFermer}>
      <div className="tf-facture-cadre" onClick={(e) => e.stopPropagation()}>
        <div className="tf-facture-barre">
          <button className="tf-btn" onClick={() => window.print()}>Télécharger en PDF</button>
          <button className="tf-btn tf-btn-ghost" onClick={onFermer}>Fermer</button>
        </div>
        <p className="tf-facture-aide">
          Dans la fenêtre qui s'ouvre, choisis <b>« Enregistrer au format PDF »</b> comme
          destination. Le fichier s'appellera <b>{nomFichier}.pdf</b> — prêt à envoyer.
        </p>

        <article className="tf-facture" data-periode={periode ? 1 : 0}>
          <header className="tf-facture-tete">
            <img src="/icones/icone-blanc-512.png" alt="" />
            <span>Tama Ferme</span>
          </header>

          <div className="tf-facture-parties">
            <div className="tf-facture-nous">
              <strong>{FERME.raison}</strong>
              {ADRESSE[langue].map((l) => <div key={l}>{l}</div>)}
              <div>{m.tel}: {FERME.telephone}</div>
              <div>Email: {FERME.emails[0]}</div>
              {FERME.emails.slice(1).map((e) => <div key={e}>{e}</div>)}
              <div>NIF: {FERME.nif}</div>
              <div>STAT: {FERME.stat}</div>

              {periode ? (
                <p className="tf-facture-periode">
                  {m.titrePeriode(dateCourte(periode.du, false), dateCourte(periode.au, false))}
                </p>
              ) : (
                <>
                  <p className="tf-facture-num">{m.facture} {numeroFacture(vente.created_at)}</p>
                  {commande?.numero && <p className="tf-facture-num">{m.commande}: {commande.numero}</p>}
                </>
              )}
              <p className="tf-facture-date">{m.date}: <b>{dateLongue(periode ? periode.emise : vente.date)}</b></p>
              {periode && <p className="tf-facture-desc"><b>{m.description}</b> {m.oeufs}</p>}
            </div>

            <div className="tf-facture-eux">
              <p>{m.client}: <strong>{nomImprime}</strong></p>
              {client?.adresse && <p className="tf-facture-multi">{client.adresse}</p>}
              {client?.nif && <p>NIF {client.nif}{client.stat ? ` STAT: ${client.stat}` : ""}</p>}
              {client?.refs_legales && <p className="tf-facture-multi">{client.refs_legales}</p>}
              {client?.telephone_fac && <p>{m.tel} : {client.telephone_fac}</p>}
              {!periode && client?.dates_oeufs && (
                <>
                  <p className="tf-facture-oeufs">Date de Ponte :<br /><b>{dateLongue(ponte)}</b></p>
                  <p className="tf-facture-oeufs">Date de Péremption :<br /><b>{dateLongue(jourPlus(ponte, 21))}</b></p>
                </>
              )}
            </div>
          </div>

          <table className="tf-facture-table">
            <thead>
              <tr>
                {periode && <><th>{m.colDate}</th><th>{m.colCommande}</th></>}
                {!periode && <th>{complet ? m.designation : m.categorie}</th>}
                {!periode && complet && <th>{m.code}</th>}
                <th>{m.quantite}</th>
                <th>{m.prixUnit}</th>
                <th>{m.montant}</th>
              </tr>
            </thead>
            <tbody>
              {periode && renduesPeriode.map((l) => (
                <tr key={l.cle}>
                  <td className="tf-facture-jour">{l.date}</td>
                  <td>{l.commande}</td>
                  <td>{l.quantite}</td>
                  <td>{fmt(l.prixUnit)}</td>
                  <td>{fmt(l.montant)}</td>
                </tr>
              ))}
              {!periode && rendues.map((l) => (
                <tr key={l.calibre}>
                  <td>{l.designation}</td>
                  {complet && <td>{FERME.codeArticle}</td>}
                  <td>{l.quantite}</td>
                  <td>{fmt(l.prixUnit)}{complet ? "" : "Ar"}</td>
                  <td className={complet ? undefined : "tf-facture-gras"}>{fmt(l.montant)}</td>
                </tr>
              ))}
              {/* Toujours une ligne de total, même à une seule ligne : c'est
                  ce que le lecteur cherche en premier. */}
              {(
                <tr className="tf-facture-total">
                  <td colSpan={periode || complet ? 3 : 2} />
                  <td>{m.total}</td>
                  <td>{fmt(total)}</td>
                </tr>
              )}
            </tbody>
          </table>

          <div className="tf-facture-bas">
            {client?.coordonnees_paiement && (
              <p className="tf-facture-multi">
                {m.mvola} {PAIEMENT.mvola}{"\n"}{m.titulaire} {PAIEMENT.titulaire}{"\n"}
                {m.banque}{"\n"}{PAIEMENT.banque}
              </p>
            )}
            {(periode || client?.montant_lettres) && (
              <p><b>{m.arrete}</b>{" "}
                {langue === "en" ? sumInWords(total) : sommeArrettee(total)}</p>
            )}
            {periode && (
              <p className="tf-facture-multi">{m.banque}{"\n"}{PAIEMENT.banque}</p>
            )}
            {/* La facture de période n'annonce pas de délai : elle solde une
                semaine déjà livrée, et le modèle n'en porte pas. */}
            {!periode && client?.afficher_conditions !== false && (
              <p>{delai > 0 ? m.conditions(delai) : m.comptant}</p>
            )}
          </div>

          <footer className="tf-facture-signature">
            <div>{m.gerant}</div>
            <div><b>{FERME.gerant.nom}</b> {FERME.gerant.suite}</div>
            <div>Tél: {FERME.gerant.telephone}</div>
            <Paraphe />
            <div className="tf-facture-merci">{m.merci}</div>
            {client?.rib_pied && <div className="tf-facture-rib">RIB: {PAIEMENT.banque}</div>}
          </footer>
        </article>
      </div>
    </div>
  );
}
