/**
 * Service zum Abrufen von SVG/Image-Daten von Ordinals-Inskriptionen
 */

/**
 * Ruft die Image-Daten einer Inskription von einem Ordinals-Explorer ab
 * @param inscriptionId - Die Inskription-ID (z.B. "abc123...i0")
 * @returns SVG/Image-Daten als String oder null
 */
export const fetchInscriptionImage = async (inscriptionId: string): Promise<string | null> => {
  try {
    // Ignoriere Mock-Inskriptionen sofort (IDs die mit "mock-" oder "txid-" beginnen)
    if (inscriptionId.startsWith('mock-') || inscriptionId.startsWith('txid-')) {
      console.warn(`Skipping mock inscription: ${inscriptionId}`);
      return null;
    }

    // Entferne das 'i0' am Ende für die API-Anfrage
    const cleanId = inscriptionId.replace(/i\d+$/, '');
    
    // Versuche mehrere Ordinals-Explorer APIs
    // Format: https://ordinals.com/content/{inscriptionId}
    const apis = [
      // Ordinals.com - Hauptquelle (funktioniert definitiv)
      `https://ordinals.com/content/${inscriptionId}`,
      // Ordinals.com Preview (alternativ)
      `https://ordinals.com/preview/${inscriptionId}`,
      // Hiro API
      `https://api.hiro.so/ordinals/v1/inscriptions/${inscriptionId}/content`,
      // OrdinalsBot
      `https://ordinalsbot.com/api/files/${inscriptionId}`,
      // UniSat API als Fallback
      `https://api.unisat.io/v1/indexer/inscription/${inscriptionId}/content`,
    ];

    for (const apiUrl of apis) {
      try {
        console.log(`[InscriptionImage] Trying: ${apiUrl}`);
        
        const response = await fetch(apiUrl, {
          method: 'GET',
          headers: {
            'Accept': 'image/svg+xml,image/*,*/*,text/html,application/xhtml+xml',
          },
          mode: 'cors',
          cache: 'default',
        });

        console.log(`[InscriptionImage] Response status for ${apiUrl}: ${response.status} ${response.statusText}`);
        console.log(`[InscriptionImage] Content-Type: ${response.headers.get('content-type')}`);

        if (response.ok) {
          const contentType = response.headers.get('content-type') || '';
          
          // Klone Response für Fallback-Prüfung
          const clonedResponse = response.clone();
          
          // Für UniSat API: Response ist JSON mit data-Feld
          if (apiUrl.includes('unisat.io')) {
            try {
              const jsonData = await response.json();
              if (jsonData.data) {
                // UniSat gibt Base64-encoded Daten zurück
                if (typeof jsonData.data === 'string') {
                  // Prüfe ob es Base64 ist
                  if (jsonData.data.startsWith('data:')) {
                    console.log(`[InscriptionImage] UniSat returned data URL`);
                    return jsonData.data; // Bereits Data URL
                  }
                  // Versuche als SVG zu parsen
                  if (jsonData.data.trim().startsWith('<svg')) {
                    console.log(`[InscriptionImage] UniSat returned SVG string`);
                    return jsonData.data;
                  }
                  // Versuche Base64 zu decodieren
                  try {
                    const decoded = atob(jsonData.data);
                    if (decoded.trim().startsWith('<svg')) {
                      console.log(`[InscriptionImage] UniSat returned Base64 SVG`);
                      return decoded;
                    }
                  } catch {
                    // Nicht Base64, versuche direkt
                  }
                }
              }
            } catch {
              // Nicht JSON, weiter mit normalem Flow
            }
          }
          
          // Für ordinals.com/preview: Versuche als HTML zu parsen und SVG zu extrahieren
          if (apiUrl.includes('ordinals.com/preview')) {
            try {
              const htmlText = await response.text();
              // Preview-Seite enthält das SVG, versuche es zu extrahieren
              const svgMatch = htmlText.match(/<svg[\s\S]*?<\/svg>/i);
              if (svgMatch) {
                console.log(`[InscriptionImage] Extracted SVG from preview page`);
                return svgMatch[0];
              }
            } catch {
              // Ignoriere Fehler
            }
          }
          
          // Prüfe ob es SVG ist (entweder durch Content-Type oder durch Inhalt)
          if (contentType.includes('svg') || contentType.includes('text') || contentType.includes('xml') || contentType.includes('html')) {
            // Lade als Text für SVG
            const responseText = await response.text();
            console.log(`[InscriptionImage] Response text length: ${responseText.length}, starts with: ${responseText.substring(0, 50)}`);
            
            // Prüfe ob es wirklich SVG ist
            if (responseText.trim().startsWith('<svg') || responseText.trim().startsWith('<?xml')) {
              // Stelle sicher, dass SVG korrekt formatiert ist
              let svgText = responseText.trim();
              
              // Wenn es XML-Deklaration hat, entferne sie nicht (für korrekte Darstellung)
              // Aber stelle sicher, dass viewBox vorhanden ist für korrekte Skalierung
              if (svgText.includes('<svg') && !svgText.includes('viewBox') && svgText.includes('width') && svgText.includes('height')) {
                // Füge viewBox hinzu wenn nicht vorhanden
                const widthMatch = svgText.match(/width=["'](\d+)["']/);
                const heightMatch = svgText.match(/height=["'](\d+)["']/);
                if (widthMatch && heightMatch) {
                  const width = widthMatch[1];
                  const height = heightMatch[1];
                  svgText = svgText.replace(/<svg/, `<svg viewBox="0 0 ${width} ${height}"`);
                }
              }
              
              console.log(`[InscriptionImage] ✅ Successfully loaded SVG from ${apiUrl}`);
              return svgText;
            }
            
            // Versuche SVG aus HTML zu extrahieren (falls es eine HTML-Seite ist)
            if (responseText.includes('<svg')) {
              const svgMatch = responseText.match(/<svg[\s\S]*?<\/svg>/i);
              if (svgMatch) {
                console.log(`[InscriptionImage] ✅ Extracted SVG from HTML`);
                return svgMatch[0];
              }
            }
          }
          
          // Wenn anderes Bild-Format, als Data URL zurückgeben
          if (contentType.startsWith('image/')) {
            const blob = await response.blob();
            return new Promise((resolve) => {
              const reader = new FileReader();
              reader.onloadend = () => resolve(reader.result as string);
              reader.readAsDataURL(blob);
            });
          }
          
          // Fallback: Versuche als Text zu laden und prüfe ob es SVG ist
          try {
            const responseText = await clonedResponse.text();
            if (responseText.trim().startsWith('<svg') || responseText.trim().startsWith('<?xml')) {
              console.log(`[InscriptionImage] ✅ Found SVG in fallback text parsing`);
              return responseText.trim();
            }
            // Versuche SVG aus dem Text zu extrahieren
            if (responseText.includes('<svg')) {
              const svgMatch = responseText.match(/<svg[\s\S]*?<\/svg>/i);
              if (svgMatch) {
                console.log(`[InscriptionImage] ✅ Extracted SVG in fallback`);
                return svgMatch[0];
              }
            }
          } catch {
            // Ignoriere Fehler
          }
        } else {
          console.warn(`[InscriptionImage] ❌ Response not OK for ${apiUrl}: ${response.status} ${response.statusText}`);
        }
      } catch (err: any) {
        // Versuche nächste API
        console.warn(`[InscriptionImage] ❌ Failed to fetch from ${apiUrl}:`, err.message || err);
        continue;
      }
    }

    console.error(`[InscriptionImage] ❌ All APIs failed for inscription ${inscriptionId}`);
    return null;
  } catch (error) {
    console.error('Error fetching inscription image:', error);
    return null;
  }
};

/**
 * Ruft die Image-Daten für mehrere Inskriptionen parallel ab
 */
export const fetchInscriptionImages = async (
  inscriptionIds: string[]
): Promise<Record<string, string | null>> => {
  const results: Record<string, string | null> = {};
  
  // Parallel abrufen (mit Rate Limiting)
  const promises = inscriptionIds.map(async (id) => {
    const image = await fetchInscriptionImage(id);
    results[id] = image;
    // Kleine Pause zwischen Requests
    await new Promise(resolve => setTimeout(resolve, 100));
  });

  await Promise.all(promises);
  return results;
};

/**
 * Cache für bereits geladene Bilder (um API-Calls zu reduzieren)
 */
const imageCache: Record<string, string | null> = {};

/**
 * Ruft eine Inskription mit Cache ab
 */
export const getCachedInscriptionImage = async (inscriptionId: string): Promise<string | null> => {
  if (imageCache[inscriptionId]) {
    return imageCache[inscriptionId];
  }

  const image = await fetchInscriptionImage(inscriptionId);
  imageCache[inscriptionId] = image;
  return image;
};

