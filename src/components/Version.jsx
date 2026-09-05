// La version en place sur ce téléphone. Trois appareils se mettent à jour
// chacun à leur rythme derrière le service worker : sans ce repère, « ferme et
// rouvre l'application » reste un conseil que personne ne peut vérifier.
//
// Les trois valeurs sont figées à la compilation (voir vite.config.js) : le
// numéro de version, la date du déploiement, et le commit — ce dernier pour
// désigner sans ambiguïté ce qui tourne quand on cherche une panne.

const dateLisible = (iso) =>
  new Date(iso + "T12:00:00").toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

export default function Version({ complet = false }) {
  const date = dateLisible(__DATE_BUILD__);
  return (
    <span className="tf-version" title={`Commit ${__COMMIT__}`}>
      v{__VERSION__} · {complet ? date : date.replace(/ \d{4}$/, "")}
      {complet && ` · ${__COMMIT__}`}
    </span>
  );
}
