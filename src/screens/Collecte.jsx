import { useState } from "react";
import Header from "../components/Header";
import DateSelector from "../components/DateSelector";
import ReleveCollecte from "../components/ReleveCollecte";
import { today } from "../components/format";
import { useLotsEnPonte } from "../lib/useLotsEnPonte";
import { useClients } from "../lib/useClients";

// Le relevé de la magasinière, consulté depuis le point de vente : savoir ce
// qui est rentré aujourd'hui, calibre par calibre, avant de vendre. Écran de
// consultation seulement — la collecte se saisit à un seul endroit, et les
// policies RLS réservent de toute façon l'écriture sur `pontes` à la
// magasinière et à la direction.
export default function Collecte() {
  const lots = useLotsEnPonte();
  const clients = useClients();
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

        {/* Le prix n'est affiché que du côté vente : la magasinière saisit des
            œufs, pas des ariary, et son écran n'a pas à porter la valeur de
            ce qu'elle compte. */}
        <ReleveCollecte date={date} lots={lots} clients={clients} avecPrix />
      </main>
    </div>
  );
}
