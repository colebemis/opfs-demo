import LightningFS from "@isomorphic-git/lightning-fs";

const DB_NAME = "fs";

// TODO: Investigate replacing lightning-fs with memfs + OPFS for better performance
export const fs = new LightningFS(DB_NAME);

/** Delete file system database */
export function fsWipe() {
  window.indexedDB.deleteDatabase(DB_NAME);
}
