/**
 * UniSat API Service
 * Erstellt Inskriptionen über die UniSat OpenAPI
 */

const INSCRIPTION_API_URL = import.meta.env.VITE_INSCRIPTION_API_URL || 'http://localhost:3003';

export interface UnisatInscriptionRequest {
  file: File;
  address: string;
  feeRate: number;
  postage?: number; // Default: 330 sats
  delegateMetadata?: string; // JSON-String mit Metadaten für Delegate-Inscriptions
}

export interface UnisatInscriptionResponse {
  orderId: string;
  payAddress?: string; // Adresse für Inskriptions-Fees Zahlung
  amount?: number; // Betrag der bezahlt werden muss (in BTC)
  txid?: string;
  inscriptionId: string;
  status: string;
}

/**
 * Erstellt eine Inskription über die UniSat API
 */
export const createUnisatInscription = async (
  request: UnisatInscriptionRequest
): Promise<UnisatInscriptionResponse> => {
  const { file, address, feeRate, postage = 330, delegateMetadata } = request;

  if (!address.startsWith('bc1p')) {
    throw new Error(
      'Inscriptions require a Taproot address (bc1p...).\n\n' +
      'In UniSat: Click your address → Settings → Address Type → Taproot (P2TR)\n' +
      'Then reconnect your wallet.\n\n' +
      'Xverse and OKX wallets handle this automatically.'
    );
  }

  const formData = new FormData();
  formData.append('file', file); // Backend erwartet 'file' (Singular), nicht 'files'
  formData.append('address', address);
  formData.append('feeRate', feeRate.toString());
  formData.append('postage', postage.toString());
  
  // Füge Metadaten hinzu, falls vorhanden (für Delegate-Inscriptions mit Bildern)
  if (delegateMetadata) {
    formData.append('delegateMetadata', delegateMetadata);
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 60000); // 60 Sekunden Timeout

    const response = await fetch(`${INSCRIPTION_API_URL}/api/unisat/inscribe`, {
      method: 'POST',
      body: formData,
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
      throw new Error(errorData.error || errorData.message || 'Fehler beim Erstellen der Inskription über UniSat API');
    }

    const data = await response.json();

    console.log(`[UnisatService] 📥 Raw response:`, JSON.stringify(data, null, 2));

    // Backend sendet: { status: 'ok', result: { orderId, payAddress, amount, ... } }
    // ODER: { status: 'ok', data: { data: { orderId, payAddress, amount, ... } } } (von UniSat API direkt)
    if (data.status === 'ok') {
      // Prüfe zuerst Backend-Format (result direkt)
      const result = data.result || (data.data?.data ? data.data.data : null);
      
      if (!result) {
        console.error(`[UnisatService] ❌ Keine result/data gefunden in Response:`, data);
        throw new Error('UniSat API returned no result data');
      }
      
      // Detailliertes Logging für Debugging
      console.log(`[UnisatService] 📥 Response parsed:`);
      console.log(`  - orderId: ${result.orderId}`);
      console.log(`  - payAddress: ${result.payAddress || 'FEHLT'} (Type: ${typeof result.payAddress}, Value: ${JSON.stringify(result.payAddress)})`);
      console.log(`  - amount: ${result.amount || 'FEHLT'} (Type: ${typeof result.amount}, Value: ${JSON.stringify(result.amount)})`);
      console.log(`  - inscriptionId: ${result.inscriptionId || 'FEHLT'}`);
      console.log(`  - txid: ${result.txid || 'FEHLT'}`);
      console.log(`  - status: ${result.status || 'FEHLT'}`);
      
      // WICHTIG: Prüfe ob payAddress wirklich null ist oder ob es ein Problem mit der Extraktion gibt
      if (!result.payAddress && result.payAddress !== null) {
        console.warn(`[UnisatService] ⚠️ payAddress ist undefined (nicht null)!`);
      }
      if (result.payAddress === null) {
        console.warn(`[UnisatService] ⚠️ payAddress ist explizit null!`);
      }
      
      return {
        orderId: result.orderId,
        payAddress: result.payAddress !== undefined ? result.payAddress : null, // Explizit null wenn undefined
        amount: result.amount !== undefined ? result.amount : null, // Explizit null wenn undefined
        txid: result.txid,
        inscriptionId: result.inscriptionId || `pending-${result.orderId}`,
        status: result.status || 'pending',
      };
    }

    throw new Error(data.error || 'UniSat API returned unexpected format');
  } catch (error: any) {
    if (error.name === 'AbortError') {
      throw new Error('UniSat API request timeout after 60 seconds');
    }
    if (error.message?.includes('Failed to fetch') || error.message?.includes('ERR_CONNECTION_REFUSED')) {
      throw new Error(`Backend-Server ist nicht erreichbar (${INSCRIPTION_API_URL}). Bitte starten Sie den Backend-Server auf Port 3003.`);
    }
    throw error;
  }
};

/**
 * Erstellt mehrere Inskriptionen über die UniSat API (Batch-Request)
 * @param files - Array von Dateien
 * @param address - Empfänger-Adresse
 * @param feeRate - Fee Rate in sat/vB
 * @param postage - Postage in sats
 * @param delegateMetadataArray - Optional: Array von Metadaten-Strings (eine pro Datei)
 */
export const createBatchUnisatInscriptions = async (
  files: File[],
  address: string,
  feeRate: number,
  postage: number = 330,
  delegateMetadataArray?: string[] // Optional: Metadaten für jede Datei
): Promise<UnisatInscriptionResponse[]> => {
  // WICHTIG: Sende alle Dateien in einem einzigen Request an das Backend
  // Das Backend wird dann alle Dateien an die UniSat API senden
  const formData = new FormData();
  
  // Füge alle Dateien hinzu
  files.forEach((file) => {
    formData.append('files', file);
  });
  
  formData.append('address', address);
  formData.append('feeRate', feeRate.toString());
  formData.append('postage', postage.toString());
  
  // Füge Metadaten hinzu (falls vorhanden)
  if (delegateMetadataArray) {
    delegateMetadataArray.forEach((metadata, index) => {
      formData.append(`delegateMetadata`, metadata);
    });
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 120000); // 120 Sekunden Timeout für Batch

    const response = await fetch(`${INSCRIPTION_API_URL}/api/unisat/inscribe/batch`, {
      method: 'POST',
      body: formData,
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
      throw new Error(errorData.error || errorData.message || 'Fehler beim Erstellen der Batch-Inskriptionen');
    }

    const data = await response.json();

    // Backend gibt ein Array von Ergebnissen zurück
    if (data.status === 'ok' && Array.isArray(data.results)) {
      console.log(`[UnisatService] ✅ Batch-Inskriptionen erstellt: ${data.results.length} Inskriptionen`);
      return data.results;
    }

    throw new Error(data.error || 'UniSat API returned unexpected format');
  } catch (error: any) {
    if (error.name === 'AbortError') {
      throw new Error('UniSat API request timeout after 120 seconds');
    }
    if (error.message?.includes('Failed to fetch') || error.message?.includes('ERR_CONNECTION_REFUSED')) {
      throw new Error(`Backend-Server ist nicht erreichbar (${INSCRIPTION_API_URL}). Bitte starten Sie den Backend-Server auf Port 3003.`);
    }
    throw error;
  }
};


