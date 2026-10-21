/** Keep selected files across navigation/reload; JSON metadata remains in localStorage. */
function openDraftFiles(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (!globalThis.indexedDB) { reject(new Error("La sauvegarde des fichiers est indisponible dans ce navigateur.")); return; }
    const request = indexedDB.open("erp-wizard-files", 1);
    request.onupgradeneeded = () => request.result.createObjectStore("drafts");
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
  });
}

export async function saveDraftFiles(key: string, attachments: Array<{ id: string; file?: File }>): Promise<void> {
  const database = await openDraftFiles();
  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction("drafts", "readwrite");
      const store = transaction.objectStore("drafts");
      const previous = store.get(key);
      previous.onsuccess = () => {
        const stored: Record<string, File> = previous.result || {};
        store.put(Object.fromEntries(attachments.map(item => [item.id, item.file || stored[item.id]]).filter(([, file]) => file)), key);
      };
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(transaction.error);
    });
  } finally { database.close(); }
}

export async function readDraftFiles(key: string): Promise<Record<string, File>> {
  if (!globalThis.indexedDB) return {};
  const database = await openDraftFiles();
  try {
    return await new Promise((resolve, reject) => {
      const request = database.transaction("drafts", "readonly").objectStore("drafts").get(key);
      request.onsuccess = () => resolve(request.result || {});
      request.onerror = () => reject(request.error);
    });
  } finally { database.close(); }
}

export async function clearDraftFiles(key: string): Promise<void> {
  if (!globalThis.indexedDB) return;
  const database = await openDraftFiles();
  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction("drafts", "readwrite");
      transaction.objectStore("drafts").delete(key);
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
  } finally { database.close(); }
}
