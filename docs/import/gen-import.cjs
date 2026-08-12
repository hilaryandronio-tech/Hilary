const fs=require('fs'), parse=require('./csv.cjs'), dir='docs/import/';
const MOIS={janvier:1,'février':2,mars:3,avril:4,mai:5,juin:6,juillet:7,'août':8,septembre:9,octobre:10,novembre:11,'décembre':12};
const D=(s)=>{const m=(s||'').trim().match(/(\d{1,2})\s+([a-zéûî]+)\s+(\d{4})/i);
  if(!m)return null;const mo=MOIS[m[2].toLowerCase()];
  return mo?`${m[3]}-${String(mo).padStart(2,'0')}-${String(m[1]).padStart(2,'0')}`:null;};
const L=(f)=>parse(fs.readFileSync(dir+f,'utf8'));
const n=(x)=>{const v=Number(String(x||'').replace(/\s/g,'').replace(',','.'));return Number.isFinite(v)?v:0;};

const jour = {};                       // "date|lot" -> { mort, kg }
const pose = (d,l,champ,v) => { if (v>0) ((jour[d+'|'+l] ??= {mort:0,kg:0}))[champ] = v; };

L('Poulet 1 ère vague -Tama Ferme - Taux de Mortalité.csv').forEach(c=>{
  const d=D(c[0]); if(!d) return;
  pose(d,'V1','mort',n(c[4]));         // 1ère vague : colonnes 3-6
  pose(d,'V2','mort',n(c[8]));         // 2ème vague : colonnes 7-10
});
L('Poulet 3ème vague -Tama Ferme - Taux de Mortalité.csv').forEach(c=>{
  const d=D(c[0]); if(!d) return; pose(d,'V3','mort',n(c[4]));
});

const livraisons=[];
L("Poulet 3ème vague -Tama Ferme - Provende Moi d'Août.csv").forEach(c=>{
  const d=D(c[0]); if(!d) return;
  pose(d,'V3','kg',n(c[6]));                                   // Poids/kilos distribué
  if (n(c[4])>0) livraisons.push([d,'V3',n(c[4]),c[3]||null]); // sacs arrivés
});

const CAL=['S1','S2','M1','M2','L1','L2','XL1','XL2'];
const pontes=[];
for(const [f,lot] of [["Compta mois d'Août 2026 - Ponte 1ère vague.csv",'V1'],
                      ["Compta mois d'Août 2026 - Ponte 2eme vague.csv",'V2']]){
  L(f).forEach(c=>{
    const d=D(c[1]); if(!d) return;
    const v=c.slice(4,14).map(n);
    if(!v.some(x=>x>0)) return;
    pontes.push({d,lot,lignes:CAL.map((k,i)=>[k,v[i]]).concat([['CASSE',v[8]]]),perdus:v[9]});
  });
}

const q=(s)=>`'${String(s).replace(/'/g,"''")}'`;
const saisies=Object.entries(jour).sort();
let o=`-- =====================================================================
--  TAMA FERME — Import de l'historique des feuilles Google Sheets
--
--  Généré depuis docs/import/ par gen-import.cjs. Rejouable : rien de ce
--  que contient déjà l'application n'est écrasé.
--
--  Les feuilles courent jusqu'en 2028 mais ne sont remplies que jusqu'aux
--  premiers jours d'août — le reste n'est qu'un gabarit. Contenu réel :
--    saisies_ferme  ${saisies.length} jours (V1, V2, V3), 1er juin → 5 août 2026
--    livraisons     ${livraisons.length}
--    pontes         ${pontes.length} fiches (V1, V2), 1er → 6 août 2026
-- =====================================================================


-- ---------------------------------------------------------------------
--  1. Mortalité et provende distribuée
--  Là où l'application a déjà une saisie, on ne remplit que les colonnes
--  restées à zéro : ce que l'équipe a saisi fait foi sur la feuille.
-- ---------------------------------------------------------------------

insert into saisies_ferme (date, lot_id, mortalite, provende_kg) values
${saisies.map(([k,v])=>{const [d,l]=k.split('|');return `  (${q(d)}, ${q(l)}, ${v.mort||0}, ${v.kg||0})`;}).join(',\n')}
on conflict (date, lot_id) do update
  set mortalite   = case when saisies_ferme.mortalite   = 0 then excluded.mortalite   else saisies_ferme.mortalite   end,
      provende_kg = case when saisies_ferme.provende_kg = 0 then excluded.provende_kg else saisies_ferme.provende_kg end;

`;
if (livraisons.length) o+=`
-- ---------------------------------------------------------------------
--  2. Sacs de provende reçus
-- ---------------------------------------------------------------------

insert into livraisons_provende (lot_id, date, sacs, aliment)
select v.lot, v.d::date, v.sacs, v.aliment
from   (values
${livraisons.map(([d,l,s,a])=>`         (${q(d)}, ${q(l)}, ${s}, ${a?q(a):'null'})`).join(',\n')}
       ) as v(d, lot, sacs, aliment)
where  not exists (select 1 from livraisons_provende x
                   where x.lot_id = v.lot and x.date = v.d::date);

`;
o+=`
-- ---------------------------------------------------------------------
--  3. Fiches de ponte — une fiche déjà saisie n'est pas touchée
-- ---------------------------------------------------------------------

insert into pontes (date, lot_id, oeufs_casses, oeufs_sales, oeufs_perdus) values
${pontes.map(p=>`  (${q(p.d)}, ${q(p.lot)}, ${p.lignes.find(l=>l[0]==='CASSE')[1]}, 0, ${p.perdus})`).join(',\n')}
on conflict (date, lot_id) do nothing;


-- ---------------------------------------------------------------------
--  4. Détail par calibre, seulement pour les fiches encore vides :
--  on ne mélange pas les chiffres de la feuille et ceux de l'application.
-- ---------------------------------------------------------------------

insert into ponte_lignes (ponte_id, calibre, oeufs)
select p.id, v.calibre, v.oeufs
from   pontes p
join   (values
${pontes.flatMap(p=>p.lignes.filter(([,x])=>x>0).map(([c,x])=>`         (${q(p.d)}::date, ${q(p.lot)}, ${q(c)}, ${x})`)).join(',\n')}
       ) as v(d, lot, calibre, oeufs)
  on   p.date = v.d and p.lot_id = v.lot
where  not exists (select 1 from ponte_lignes pl where pl.ponte_id = p.id)
on conflict (ponte_id, calibre) do nothing;
`;
fs.writeFileSync('docs/12-import-historique.sql',o);
const parLot=(l)=>saisies.filter(([k])=>k.endsWith('|'+l)).length;
console.log(`saisies_ferme ${saisies.length}  (V1 ${parLot('V1')}, V2 ${parLot('V2')}, V3 ${parLot('V3')})`);
console.log(`livraisons ${livraisons.length}  ·  pontes ${pontes.length}  ·  ponte_lignes ${pontes.flatMap(p=>p.lignes.filter(([,x])=>x>0)).length}`);
console.log('morts totaux :', ['V1','V2','V3'].map(l=>l+' '+saisies.filter(([k])=>k.endsWith('|'+l)).reduce((s,[,v])=>s+(v.mort||0),0)).join('  '));
