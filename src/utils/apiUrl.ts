/**
 * Utility function to get the API URL with automatic https:// prefix if missing
 * This fixes the issue where the environment variable might not include the protocol
 */
export function getApiUrl(): string {
  let apiUrl = import.meta.env.VITE_INSCRIPTION_API_URL || 'http://localhost:3003';

  // Fix: Füge https:// hinzu, falls Protokoll fehlt (außer bei localhost)
  if (apiUrl && !apiUrl.startsWith('http://') && !apiUrl.startsWith('https://')) {
    apiUrl = `https://${apiUrl}`;
  }

  return apiUrl;
}

