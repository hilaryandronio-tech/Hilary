import { useState } from "react";
import Header from "../components/Header";
import DateSelector from "../components/DateSelector";
import ReleveCollecte from "../components/ReleveCollecte";
import { today } from "../components/format";
import { useLotsEnPonte } from "../lib/useLotsEnPonte";

// Le relevé de la magasinière, consulté depuis le point de vente : savoir ce
// qui est rentré aujourd'hui, calibre par calibre, avant de vendre. Écran de
// consultation seulement — la collecte se saisit à un seul endroit, et les
// policies RLS réservent de toute façon l'écriture sur `pontes` à la
// magasinière et à la direction.
export default function Collecte() {
  const lots = useLotsEnPonte();
  const [date, setDate] = useState(today());

  return (
    <div className="tf">
      <Header />
      <main className="tf-body">
        <p className="tf-eyebrow">Collecte du jour · consultation</p>
        <h1 className="tf-h1">Œufs disponibles</h1>
        <p className="tf-sub">
          Ce que la magasinière a enregistré, par calibre et par bâtiment. Saisie réservée à la magasinière.
        </p>

        <DateSelector value={date} onChange={setDate} />

        <ReleveCollecte date={date} lots={lots} />
      </main>
    </div>
  );
}
