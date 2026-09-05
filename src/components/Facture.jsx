import { fmt } from "./format";
import { FERME, ADRESSE, PAIEMENT, SIGNATURE, MOTS } from "../data/ferme";

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

export default function Facture({ vente, client, commande, onFermer }) {
  const langue = client?.langue === "en" ? "en" : "fr";
  const m = MOTS[langue];
  const paquet = client?.conditionnement > 0 ? client.conditionnement : 30;
  const lignes = vente.lignes ?? [];
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
  const total = rendues.reduce((s, l) => s + l.montant, 0);
  const delai = client?.delai_paiement_jours ?? 0;

  return (
    <div className="tf-facture-fond" onClick={onFermer}>
      <div className="tf-facture-cadre" onClick={(e) => e.stopPropagation()}>
        <div className="tf-facture-barre">
          <button className="tf-btn" onClick={() => window.print()}>Imprimer</button>
          <button className="tf-btn tf-btn-ghost" onClick={onFermer}>Fermer</button>
        </div>

        <article className="tf-facture">
          <header className="tf-facture-tete">
            <img src="/icones/icone-marron-192.png" alt="" />
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

              <p className="tf-facture-num">{m.facture} {numeroFacture(vente.created_at)}</p>
              {commande?.numero && <p className="tf-facture-num">{m.commande}: {commande.numero}</p>}
              <p className="tf-facture-date">{m.date}: <b>{dateLongue(vente.date)}</b></p>
            </div>

            <div className="tf-facture-eux">
              <p>{m.client}: <strong>{client?.nom}</strong></p>
              {client?.adresse && <p className="tf-facture-multi">{client.adresse}</p>}
              {client?.nif && <p>NIF {client.nif}{client.stat ? ` STAT: ${client.stat}` : ""}</p>}
              {client?.refs_legales && <p className="tf-facture-multi">{client.refs_legales}</p>}
              {client?.telephone_fac && <p>{m.tel} : {client.telephone_fac}</p>}
            </div>
          </div>

          <table className="tf-facture-table">
            <thead>
              <tr>
                <th>{m.designation}</th>
                <th>{m.code}</th>
                <th>{m.quantite}</th>
                <th>{m.prixUnit}</th>
                <th>{m.montant}</th>
              </tr>
            </thead>
            <tbody>
              {rendues.map((l) => (
                <tr key={l.calibre}>
                  <td>{l.designation}</td>
                  <td>{FERME.codeArticle}</td>
                  <td>{l.quantite}</td>
                  <td>{fmt(l.prixUnit)}</td>
                  <td>{fmt(l.montant)}</td>
                </tr>
              ))}
              <tr className="tf-facture-total">
                <td colSpan={3} />
                <td>{m.total}</td>
                <td>{fmt(total)}</td>
              </tr>
            </tbody>
          </table>

          <div className="tf-facture-bas">
            {client?.coordonnees_paiement && (
              <p className="tf-facture-multi">
                {m.mvola} {PAIEMENT.mvola}{"\n"}{m.titulaire} {PAIEMENT.titulaire}{"\n"}
                {m.banque}{"\n"}{PAIEMENT.banque}
              </p>
            )}
            <p>{delai > 0 ? m.conditions(delai) : m.comptant}</p>
          </div>

          <footer className="tf-facture-signature">
            <div>{m.gerant}</div>
            <div><b>{FERME.gerant.nom}</b></div>
            <div>Tél: {FERME.gerant.telephone}</div>
            {SIGNATURE
              ? <img src={SIGNATURE} alt="" className="tf-facture-paraphe" />
              : <div className="tf-facture-paraphe" />}
            <div className="tf-facture-merci">{m.merci}</div>
          </footer>
        </article>
      </div>
    </div>
  );
}
