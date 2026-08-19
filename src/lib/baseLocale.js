import { openDB } from "idb";

// La base locale du téléphone, partagée par la file d'attente d'écriture et le
// cache de lecture. Une seule ouverture, une seule version : deux modules qui
// ouvriraient la même base à des versions différentes se bloqueraient l'un
// l'autre.
//
//   v1  file d'attente
//   v2  échecs définitifs, mis de côté pour ne pas bloquer la file
//   v3  cache des lectures, pour que les référentiels survivent à une coupure

export const DB_NAME = "tama-ferme";
export const FILE = "queue";
export const ECHECS = "echecs";
export const CACHE = "cache";

export const dbPromise = openDB(DB_NAME, 3, {
  upgrade(db, ancienneVersion) {
    if (ancienneVersion < 1) db.createObjectStore(FILE, { keyPath: "id", autoIncrement: true });
    if (ancienneVersion < 2) db.createObjectStore(ECHECS, { keyPath: "id", autoIncrement: true });
    if (ancienneVersion < 3) db.createObjectStore(CACHE, { keyPath: "cle" });
  },
});
