/**
 * Service zum Abrufen von Inscription-Bildern vom Backend
 * Stellt sicher, dass SVG-Bilder 1:1 korrekt abgerufen werden
 */

const API_URL = import.meta.env.VITE_INSCRIPTION_API_URL || 'http://localhost:3003';

/**
 * Ruft das SVG-Bild einer Inscription vom Backend ab
 * @param inscriptionId - Die Inscription-ID
 * @returns File-Objekt mit dem SVG-Bild
 */
export async function fetchInscriptionImageAsFile(inscriptionId: string): Promise<File> {
  try {
    console.log(`[InscriptionImageService] Fetching SVG for: ${inscriptionId}`);
    console.log(`[InscriptionImageService] API URL: ${API_URL}`);
    
    const response = await fetch(`${API_URL}/api/inscription/image/${inscriptionId}`, {
      method: 'GET',
      headers: {
        'Accept': 'image/svg+xml, image/*',
      },
    });
    
    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error');
      console.error(`[InscriptionImageService] ❌ HTTP Error ${response.status}: ${errorText}`);
      throw new Error(`Failed to fetch SVG: ${response.status} ${response.statusText}. Backend-Server erreichbar? (${API_URL})`);
    }
    
    // WICHTIG: Als Text lesen, nicht als Blob, um SVG-Validierung zu ermöglichen
    const svgText = await response.text();
    
    // Validiere dass es wirklich SVG ist
    const trimmedSvg = svgText.trim();
    if (!trimmedSvg.startsWith('<svg') && !trimmedSvg.startsWith('<?xml')) {
      console.warn(`[InscriptionImageService] ⚠️ Response doesn't look like SVG:`, trimmedSvg.substring(0, 100));
      throw new Error('Response is not a valid SVG. Got: ' + trimmedSvg.substring(0, 50));
    }
    
    // Erstelle Blob mit korrektem MIME-Type
    const blob = new Blob([svgText], { type: 'image/svg+xml' });
    
    // Erstelle File-Objekt
    const fileName = `${inscriptionId.replace(/[^a-zA-Z0-9]/g, '_')}.svg`;
    const file = new File([blob], fileName, { type: 'image/svg+xml' });
    
    console.log(`[InscriptionImageService] ✅ SVG fetched: ${fileName} (${blob.size} bytes)`);
    console.log(`[InscriptionImageService] SVG preview: ${trimmedSvg.substring(0, 100)}...`);
    
    return file;
  } catch (error: any) {
    console.error(`[InscriptionImageService] ❌ Error fetching SVG:`, error);
    
    // Prüfe ob es ein Netzwerk-Fehler ist (Backend nicht erreichbar)
    if (error.message?.includes('Failed to fetch') || error.message?.includes('NetworkError')) {
      console.error(`[InscriptionImageService] ⚠️ Backend-Server nicht erreichbar!`);
      console.error(`[InscriptionImageService] ⚠️ Bitte stelle sicher, dass der Backend-Server auf ${API_URL} läuft.`);
      throw new Error(`Backend-Server nicht erreichbar (${API_URL}). Bitte starte den Backend-Server.`);
    }
    
    throw new Error(`Failed to fetch inscription SVG: ${error.message}`);
  }
}

