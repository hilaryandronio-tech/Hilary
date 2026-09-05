import { useEffect, useMemo, useState } from "react";
import Header from "../components/Header";
import NumField from "../components/NumField";
import Keypad from "../components/Keypad";
import DateSelector from "../components/DateSelector";
import ReleveCollecte from "../components/ReleveCollecte";
import StockOeufs from "../components/StockOeufs";
import { fmt, today, dLabel } from "../components/format";
import { ALV, CALIBRES, POIDS, PRIX_CASSE } from "../data/constants";
import { enqueue, idStable, operationsEnAttente } from "../lib/offlineQueue";
import { supabase } from "../lib/supabaseClient";
import { useLotsEnPonte } from "../lib/useLotsEnPonte";
import { useAuth } from "../context/AuthContext";

export default function Magasiniere() {
  const { profil } = useAuth();
  const lots = useLotsEnPonte();
  const [lotId, setLotId] = useState(lots[0]?.id ?? null);
  const [date, setDate] = useState(today());
  const [draft, setDraft] = useState({});
  const [pad, setPad] = useState(null);
  const [flash, setFlash] = useState("");
  const [dejaEnregistre, setDejaEnregistre] = useState(false);
  const [ficheExistante, setFicheExistante] = useState(false);

  // Le bâtiment sélectionné doit rester dans la liste chargée depuis Supabase :
  // sinon on saisirait sur un bâtiment qui n'est plus en ponte.
  useEffect(() => {
    setLotId((id) => (lots.some((l) => l.id === id) ? id : lots[0]?.id ?? null));
  }, [lots]);

  // Relire la fiche du jour choisi et la remettre dans les champs. Sans ça
  // l'écran repartait vide : corriger un seul calibre obligeait à retaper tous
  // les autres, et une magasinière qui saisissait la seule valeur fautive
  // remettait tout le reste à zéro — l'enregistrement écrit toutes les lignes,
  // y compris celles laissées vides.
  useEffect(() => {
    if (!lotId || !date) return;
    let vivant = true;
    (async () => {
      const ponteId = idStable("ponte", date, lotId);
      const { data } = await supabase
        .from("pontes")
        .select("oeufs_casses, oeufs_sales, oeufs_perdus, ponte_lignes(calibre, oeufs)")
        .eq("date", date)
        .eq("lot_id", lotId)
        .maybeSingle();

      // Une fiche encore en file n'est pas sur le serveur : c'est pourtant
      // elle qui fait foi, elle est plus récente que tout ce qu'on lirait.
      const [entetes, lignes] = await Promise.all([
        operationsEnAttente("pontes"),
        operationsEnAttente("ponte_lignes"),
      ]);
      const enFile = entetes.map((op) => op.payload).find((p) => p?.id === ponteId);
      const lignesEnFile = lignes
        .flatMap((op) => [].concat(op.payload))
        .filter((l) => l?.ponte_id === ponteId);

      if (!vivant) return;
      const source = enFile ?? data;
      if (!source) {
        setDraft({});
        setFicheExistante(false);
        setDejaEnregistre(false);
        return;
      }
      const parCalibre = {};
      (lignesEnFile.length ? lignesEnFile : data?.ponte_lignes ?? []).forEach((l) => {
        parCalibre[l.calibre] = l.oeufs;
      });
      const repris = {
        casse: source.oeufs_casses ?? 0,
        sale: source.oeufs_sales ?? 0,
        perdu: source.oeufs_perdus ?? 0,
      };
      // Les lignes sont stockées en œufs. On les repose comme elles ont été
      // saisies : les alvéoles pleines d'un côté, le reste au détail.
      CALIBRES.forEach((c) => {
        const oeufs = parCalibre[c] ?? 0;
        repris["c" + c] = Math.floor(oeufs / ALV);
        repris["d" + c] = oeufs % ALV;
      });
      setDraft(repris);
      setFicheExistante(true);
      // Rien n'a encore changé : le bouton reste éteint jusqu'à la première
      // correction, pour ne pas réécrire une fiche à l'identique.
      setDejaEnregistre(true);
    })();
    return () => { vivant = false; };
  }, [date, lotId]);

  const val = (k) => draft[k] || 0;
  // Saisie directe à la souris : même effet que le pavé, sans passer par lui.
  const poser = (k, v) => {
    setDraft((d) => ({ ...d, [k]: v }));
    setDejaEnregistre(false);
  };
  const open = (k, label, unit) => setPad({ key: k, label, unit, value: val(k) });
  const setPadVal = (v) => {
    setDraft({ ...draft, [pad.key]: v });
    setPad({ ...pad, value: v });
    setDejaEnregistre(false);
  };

  const lot = lots.find((l) => l.id === lotId) ?? lots[0];
  const alvDraft = useMemo(() => CALIBRES.reduce((s, c) => s + val("c" + c), 0), [draft]);
  // Collecte au détail (en œufs, pas forcément un multiple de 30) — distinct
  // de la grille en alvéoles, qui reste le mode de saisie habituel.
  const detailOeufsDraft = useMemo(() => CALIBRES.reduce((s, c) => s + val("d" + c), 0), [draft]);
  // Les cassés se vendent (500 Ar) donc comptent dans le total et le taux de
  // ponte, contrairement aux sales/fêlés qui restent un pur dégât (prix à 0).
  const oeufsDraft = alvDraft * ALV + detailOeufsDraft + val("casse");
  const tauxPonte = lot?.vivant ? (oeufsDraft / lot.vivant) * 100 : 0;

  const peutEnregistrer =
    !dejaEnregistre &&
    (oeufsDraft > 0 || val("casse") > 0 || val("sale") > 0 || val("perdu") > 0);

  // Une exception ici interrompait la fonction sans un mot : pas de ligne en
  // file, donc pas de badge non plus, et la fiche semblait enregistrée alors
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

    // Un seul en-tête pontes par (date, bâtiment) — la grille alvéoles et la
    // collecte au détail alimentent les mêmes lignes, sommées par calibre,
    // sinon deux en-têtes le même jour pour le même bâtiment violeraient la
    // contrainte d'unicité de la table.
    //
    // On vise (date, bâtiment) et non l'identifiant : une fiche créée hors de
    // l'application — import des feuilles, correction en SQL — porte un
    // identifiant tiré au sort, et viser le nôtre butait sur la contrainte
    // d'unicité. En cas de conflit, la fiche existante est adoptée : son
    // identifiant devient le nôtre et ses lignes suivent par cascade
    // (docs/13-migration-identifiants-fiches.sql).
    //
    // Les lignes partent toutes, y compris à zéro, sans quoi un calibre saisi
    // par erreur puis retiré resterait dans la fiche corrigée.
    const ponteId = idStable("ponte", date, lotId);
    // Les cassés se vendent (500 Ar), donc comptent aussi comme production —
    // pas seulement comme dégât — en plus de rester dans oeufs_casses ci-dessous.
    const lignes = [
      ...CALIBRES.map((c) => ({ calibre: c, oeufs: val("c" + c) * ALV + val("d" + c) })),
      { calibre: "CASSE", oeufs: val("casse") },
    ];

    // En file d'attente l'un après l'autre : les lignes portent une clé
    // étrangère vers l'en-tête, elles doivent partir après lui.
    await enqueue({
      table: "pontes",
      conflict: "date,lot_id",
      groupe: ponteId,
      payload: {
        id: ponteId, date, lot_id: lotId,
        oeufs_casses: val("casse"),   // récupérables, vendus à part
        oeufs_sales: val("sale"),     // nettoyés, comptés dans leur calibre
        oeufs_perdus: val("perdu"),   // irrécupérables, seule vraie perte
        auteur,
      },
    });
    await enqueue({
      table: "ponte_lignes",
      conflict: "ponte_id,calibre",
      groupe: ponteId,
      payload: lignes.map((l) => ({ ponte_id: ponteId, calibre: l.calibre, oeufs: l.oeufs })),
    });

    setDejaEnregistre(true);
    setFlash(date === today() ? "Fiche de ponte enregistrée." : `Fiche de ponte enregistrée pour le ${dLabel(date)}.`);
    setTimeout(() => setFlash(""), 2600);
  };

  return (
    <div className="tf">
      <Header />
      <main className="tf-body">
        <p className="tf-eyebrow">Fiche de ponte · en alvéoles</p>
        <h1 className="tf-h1">Collecte par calibre</h1>
        <p className="tf-sub">Choisis le bâtiment, compte en alvéoles de 30. La conversion en œufs est automatique.</p>

        {/* Le changement de date déclenche la relecture ci-dessus : inutile de
            vider les champs ici, ce serait un clignotement pour rien. */}
        <DateSelector value={date} onChange={setDate} />

        {ficheExistante && (
          <p className="tf-note">
            Fiche déjà saisie pour {dLabel(date)} — les chiffres ci-dessous sont ceux enregistrés.
            Corrige la case fautive, le reste ne bouge pas.
          </p>
        )}

        <div className="tf-lots">
          {lots.map((l) => (
            <button key={l.id} className="tf-lot" data-on={lotId === l.id ? 1 : 0}
              onClick={() => setLotId(l.id)}>
              <div className="tf-lot-id">{l.id}</div>
              <div className="tf-lot-m">{fmt(l.vivant)}</div>
            </button>
          ))}
        </div>

        {/* Sur ordinateur, le relevé passe à droite et reste à l'écran
            pendant qu'on descend dans la saisie. Sur téléphone, rien ne
            change : il reste au-dessus, comme dans le flux du texte. */}
        <div className="tf-deux-colonnes">
        <div className="tf-colonne-releve">
        <ReleveCollecte date={date} lots={lots} />
        <StockOeufs />
        </div>
        <div className="tf-colonne-saisie">

        <div className="tf-card">
          <div className="tf-cardhead">
            <span className="tf-cardtitle">{lot?.id ?? "—"} — alvéoles collectées</span>
            <span className="tf-tag">1 ALV = 30 ŒUFS</span>
          </div>
          <div className="tf-grid4">
            {CALIBRES.map((c) => (
              <NumField key={c} label={c} sous={POIDS[c]} unit="alv" value={val("c" + c)}
                detail={val("c" + c) ? `${fmt(val("c" + c) * ALV)} œufs` : null}
                onOpen={() => open("c" + c, `${c} · ${POIDS[c]}`, "alv")}
                onChange={(v) => poser("c" + c, v)} />
            ))}
          </div>
          <div className="tf-live">
            <span className="tf-live-n">{fmt(oeufsDraft)}</span>
            <span className="tf-live-l">
              œufs · taux de ponte {lot?.vivant ? tauxPonte.toFixed(1) : "—"} %
            </span>
          </div>
        </div>

        <div className="tf-card">
          <div className="tf-cardhead">
            <span className="tf-cardtitle">Collecte au détail</span>
            <span className="tf-tag">EN ŒUFS</span>
          </div>
          <div className="tf-grid4">
            {CALIBRES.map((c) => (
              <NumField key={c} label={c} sous={POIDS[c]} unit="œufs" value={val("d" + c)}
                onOpen={() => open("d" + c, `${c} · ${POIDS[c]}`, "œufs")}
                onChange={(v) => poser("d" + c, v)} />
            ))}
          </div>
          <p className="tf-note">Pour compter des œufs hors alvéole complète — ramassage partiel, casier entamé.</p>
        </div>

        {/* Trois sorts différents, et un seul est une perte. Les nommer
            « Dégâts » en bloc, en brique, poussait à ne pas compter dans leur
            calibre des œufs qui se vendent — la production du jour s'en
            trouvait sous-évaluée. */}
        <div className="tf-card">
          <div className="tf-cardhead">
            <span className="tf-cardtitle">Casse, sales, perte</span>
          </div>
          <div className="tf-grid4">
            <NumField label="Cassés" unit="œufs" value={val("casse")}
              detail={val("casse") ? `${fmt(val("casse") * PRIX_CASSE)} Ar` : null}
              onOpen={() => open("casse", `Cassés vendables — ${PRIX_CASSE} Ar`, "œufs")}
                onChange={(v) => poser("casse", v)} />
            <NumField label="Sales" unit="œufs" value={val("sale")}
              onOpen={() => open("sale", "Sales à nettoyer", "œufs")}
                onChange={(v) => poser("sale", v)} />
            <NumField label="Perdus" unit="œufs" tone="brick" value={val("perdu")}
              onOpen={() => open("perdu", "Irrécupérables — perdus et fêlés", "œufs")}
                onChange={(v) => poser("perdu", v)} />
          </div>
          <p className="tf-note">
            <strong>Cassés</strong> : récupérables, vendus à part à {PRIX_CASSE} Ar — déjà compris
            dans le total plus haut. <strong>Sales</strong> : nettoyés puis vendus au prix normal,
            donc <strong>compte-les aussi dans leur calibre</strong> ; ce compteur-ci ne suit que la
            qualité du ramassage. <strong>Perdus</strong> : irrécupérables, <strong>fêlés compris</strong> — la seule vraie perte.
            Au-delà de 2 % de la collecte, il y a un problème de nid, de ramassage ou de calcium.
          </p>
        </div>
        </div>
        </div>

      </main>

      <div className="tf-cta">
        <div className="tf-cta-in">
          <button className="tf-btn" disabled={!peutEnregistrer} onClick={enregistrer}>
            {dejaEnregistre ? "Enregistré" : ficheExistante ? "Corriger la fiche" : "Enregistrer"}
          </button>
          <button className="tf-btn tf-btn-ghost" onClick={() => { setDraft({}); setDejaEnregistre(false); }}>Effacer</button>
        </div>
      </div>

      {flash && <div className="tf-flash">{flash}</div>}
      <Keypad field={pad} onChange={setPadVal} onClose={() => setPad(null)} />
    </div>
  );
}
