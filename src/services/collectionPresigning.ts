/**
 * Collection Pre-Signing Service
 * Handles pre-signing of collection originals using SIGHASH_NONE | ANYONECANPAY
 */

import { getApiUrl } from '../utils/apiUrl';

const API_URL = getApiUrl();

export interface PreparePresignResponse {
  success: boolean;
  psbtBase64: string;
  ownerAddress: string;
  inscriptionId: string;
}

export interface SavePresignedResponse {
  success: boolean;
  message: string;
}

/**
 * Prepare PSBT for pre-signing
 * Creates an unsigned PSBT with PLACEHOLDER recipient
 */
export async function preparePresign(
  inscriptionId: string,
  ownerAddress: string,
  feeRate: number,
  adminAddress: string
): Promise<PreparePresignResponse> {
  console.log('[CollectionPresigning] Preparing PSBT for pre-signing...');
  console.log('  Inscription:', inscriptionId);
  console.log('  Owner:', ownerAddress);
  console.log('  Fee Rate:', feeRate);
  
  const response = await fetch(`${API_URL}/api/collections/admin/prepare-presign`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      inscriptionId,
      ownerAddress,
      feeRate,
      adminAddress,
    }),
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to prepare pre-sign PSBT');
  }
  
  const data = await response.json();
  console.log('[CollectionPresigning] ✅ PSBT prepared');
  
  return data;
}

/**
 * Save pre-signed PSBT to collection
 * Stores the signed transaction for later use during minting
 */
export async function savePresigned(
  collectionId: string,
  inscriptionId: string,
  signedTxHex: string,
  adminAddress: string
): Promise<SavePresignedResponse> {
  console.log('[CollectionPresigning] Saving pre-signed transaction...');
  console.log('  Collection:', collectionId);
  console.log('  Inscription:', inscriptionId);
  
  const response = await fetch(`${API_URL}/api/collections/admin/save-presigned`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      collectionId,
      inscriptionId,
      signedTxHex,
      adminAddress,
    }),
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to save pre-signed transaction');
  }
  
  const data = await response.json();
  console.log('[CollectionPresigning] ✅ Pre-signed transaction saved');
  
  return data;
}
