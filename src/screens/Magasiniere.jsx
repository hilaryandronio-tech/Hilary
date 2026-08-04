import { useEffect, useMemo, useState } from "react";
import Header from "../components/Header";
import NumField from "../components/NumField";
import Keypad from "../components/Keypad";
import { fmt, today } from "../components/format";
import { ALV, CALIBRES, PRIX_BASE, PRIX_CASSE } from "../data/constants";
import { supabase } from "../lib/supabaseClient";
import { enqueue } from "../lib/offlineQueue";
import { useAuth } from "../context/AuthContext";

export default function Magasiniere() {
  const { profil } = useAuth();
  const [enPonte, setEnPonte] = useState(null); // poules en ponte, pour le taux
  const [draft, setDraft] = useState({});
  const [pad, setPad] = useState(null);
  const [flash, setFlash] = useState("");

  useEffect(() => {
    supabase
      .from("v_effectif")
      .select("vivant, en_ponte")
      .then(({ data, error }) => {
        if (error || !data) return; // hors ligne : pas de taux de ponte affiché
        setEnPonte(data.filter((l) => l.en_ponte).reduce((s, l) => s + l.vivant, 0));
      });
  }, []);

  const val = (k) => draft[k] || 0;
  const open = (k, label, unit) => setPad({ key: k, label, unit, value: val(k) });
  const setPadVal = (v) => {
    setDraft({ ...draft, [pad.key]: v });
    setPad({ ...pad, value: v });
  };

  const alvDraft = useMemo(() => CALIBRES.reduce((s, c) => s + val("c" + c), 0), [draft]);
  const oeufsDraft = alvDraft * ALV;
  const valeurDraft = useMemo(
    () => CALIBRES.reduce((s, c) => s + val("c" + c) * ALV * PRIX_BASE[c], 0) + val("casse") * PRIX_CASSE,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [draft]
  );
  const tauxPonte = enPonte ? (oeufsDraft / enPonte) * 100 : 0;

  const peutEnregistrer = oeufsDraft > 0 || val("casse") > 0 || val("sale") > 0;

  const enregistrer = async () => {
    const auteur = profil?.id;
    const ponteId = crypto.randomUUID();

    await enqueue({
      table: "pontes",
      payload: { id: ponteId, date: today(), lot_id: null, oeufs_casses: val("casse"), oeufs_sales: val("sale"), auteur },
    });

    const lignes = CALIBRES.filter((c) => val("c" + c)).map((c) => ({
      ponte_id: ponteId,
      calibre: c,
      alveoles: val("c" + c),
    }));
    if (lignes.length) {
      await enqueue({ table: "ponte_lignes", payload: lignes });
    }

    setDraft({});
    setFlash("Fiche de ponte enregistrée.");
    setTimeout(() => setFlash(""), 2600);
  };

  return (
    <div className="tf">
      <Header />
      <main className="tf-body">
        <p className="tf-eyebrow">Fiche de ponte · en alvéoles</p>
        <h1 className="tf-h1">Collecte par calibre</h1>
        <p className="tf-sub">Compte en alvéoles de 30. La conversion en œufs est automatique.</p>

        <div className="tf-card">
          <div className="tf-cardhead">
            <span className="tf-cardtitle">Alvéoles collectées</span>
            <span className="tf-tag">1 ALV = 30 ŒUFS</span>
          </div>
          <div className="tf-grid4">
            {CALIBRES.map((c) => (
              <NumField key={c} label={`${c} · ${PRIX_BASE[c]}`} unit="" value={val("c" + c)}
                onOpen={() => open("c" + c, `Taille ${c} — ${PRIX_BASE[c]} Ar/œuf`, "alv")} />
            ))}
          </div>
          <div className="tf-live">
            <span className="tf-live-n">{fmt(oeufsDraft)}</span>
            <span className="tf-live-l">
              œufs · taux de ponte {enPonte ? tauxPonte.toFixed(1) : "—"} %
            </span>
          </div>
          <div className="tf-live">
            <span className="tf-live-n">{fmt(valeurDraft)}</span>
            <span className="tf-live-l">Ar — valeur de la collecte</span>
          </div>
        </div>

        <div className="tf-card">
          <div className="tf-cardhead"><span className="tf-cardtitle">Dégâts</span></div>
          <div className="tf-grid2">
            <NumField label="Cassés" unit="œufs" tone="brick" value={val("casse")} onOpen={() => open("casse", "Œufs cassés", "œufs")} />
            <NumField label="Sales / fêlés" unit="œufs" tone="brick" value={val("sale")} onOpen={() => open("sale", "Œufs sales ou fêlés", "œufs")} />
          </div>
          <p className="tf-note">Au-delà de 2 % de la collecte, il y a un problème de nid, de ramassage ou de calcium.</p>
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
