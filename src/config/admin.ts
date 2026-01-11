/**
 * Liste der autorisierten Admin-Wallet-Adressen
 * Nur diese Adressen haben Zugriff auf das Admin Panel
 */
export const ADMIN_ADDRESSES: string[] = [
  // Admin Taproot-Adresse (Ordinals Wallet)
  'bc1pk04c62dkcev08jvmhlecufxtp4xw4af0s9n3vtm8w3dsn9985dhsvpralc',
  // Admin Legacy-Adresse (Payment Wallet)
  '34VvkvWnRw2GVgEQaQZ6fykKbebBHiT4ft',
  // Zusätzliche Admin Taproot-Adresse
  'bc1p9j4g6r27yqhmp4c403vn33mz7uug439sthqngkkrylu7d7uq7d6qvz39jj',
  // Du kannst auch über Environment Variable weitere Adressen hinzufügen:
  ...(import.meta.env.VITE_ADMIN_ADDRESSES?.split(',').map(a => a.trim()).filter(Boolean) || []),
].filter(Boolean); // Entferne leere Einträge

/**
 * Prüft ob eine Wallet-Adresse Admin-Rechte hat
 */
export const isAdminAddress = (address: string | undefined): boolean => {
  if (!address) return false;
  // Normalisiere Adresse (toLowerCase für Vergleich)
  return ADMIN_ADDRESSES.some(
    adminAddr => adminAddr.toLowerCase() === address.toLowerCase()
  );
};







