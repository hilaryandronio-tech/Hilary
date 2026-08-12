// Analyseur CSV correct : gère les champs entre guillemets contenant des
// virgules ("0,15%") et des retours à la ligne (l'en-tête « Date d'arrivé
// \n Sacs » de la feuille provende). Le découpage naïf décalait les colonnes.
module.exports = function parse(texte) {
  const lignes = []; let champ = ''; let ligne = []; let dansGuillemets = false;
  for (let i = 0; i < texte.length; i++) {
    const c = texte[i];
    if (dansGuillemets) {
      if (c === '"') { if (texte[i+1] === '"') { champ += '"'; i++; } else dansGuillemets = false; }
      else champ += c;
    } else if (c === '"') dansGuillemets = true;
    else if (c === ',') { ligne.push(champ); champ = ''; }
    else if (c === '\n') { ligne.push(champ); lignes.push(ligne); ligne = []; champ = ''; }
    else if (c !== '\r') champ += c;
  }
  if (champ !== '' || ligne.length) { ligne.push(champ); lignes.push(ligne); }
  return lignes;
};
