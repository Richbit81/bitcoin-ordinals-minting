/**
 * Utility function to get the API URL with automatic https:// prefix if missing
 * This fixes the issue where the environment variable might not include the protocol
 * Also converts http:// to https:// for production (Mixed Content prevention)
 */
const RICHART_DEFAULT_API = 'https://api.richart.app';

export function getApiUrl(): string {
  let apiUrl = import.meta.env.VITE_INSCRIPTION_API_URL || '';

  // Production fallback: Vercel/Build manchmal ohne VITE_INSCRIPTION_API_URL — gleiche Origin wie .env.example
  if (!apiUrl && typeof window !== 'undefined') {
    const h = window.location.hostname;
    if (h === 'www.richart.app' || h === 'richart.app' || h.endsWith('.richart.app')) {
      apiUrl = RICHART_DEFAULT_API;
    }
  }

  // Fix: Füge https:// hinzu, falls Protokoll fehlt (außer bei localhost)
  if (apiUrl && !apiUrl.startsWith('http://') && !apiUrl.startsWith('https://')) {
    apiUrl = `https://${apiUrl}`;
  }

  // Fix: Konvertiere http:// zu https:// für Production (außer localhost)
  // Verhindert Mixed Content Fehler (HTTPS-Seite kann nicht HTTP-APIs aufrufen)
  if (apiUrl.startsWith('http://') && !apiUrl.includes('localhost')) {
    apiUrl = apiUrl.replace('http://', 'https://');
    console.warn('[apiUrl] Converted http:// to https:// for production:', apiUrl);
  }

  return apiUrl;
}

