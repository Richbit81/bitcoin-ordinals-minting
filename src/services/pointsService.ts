/**
 * Punkte-Service für Frontend
 */

const API_URL = String(import.meta.env.VITE_INSCRIPTION_API_URL || 'https://api.richart.app').replace(/\/+$/, '');
const API_FALLBACKS = Array.from(
  new Set([
    API_URL,
    'https://bitcoin-ordinals-backend-production.up.railway.app',
  ])
);
export const MINT_POINTS = 10;

export interface PointsData {
  walletAddress: string;
  points: number;
  history: Array<{
    points: number;
    reason: string;
    timestamp: string;
    details: any;
  }>;
  firstMint: string | null;
  createdAt: string | null;
}

const extractPointsPayload = (raw: any): any => {
  if (!raw || typeof raw !== 'object') return raw;
  if (raw.data && typeof raw.data === 'object') return raw.data;
  if (raw.result && typeof raw.result === 'object') return raw.result;
  if (raw.payload && typeof raw.payload === 'object') return raw.payload;
  return raw;
};

const normalizePointsData = (walletAddress: string, raw: any): PointsData => {
  const payload = extractPointsPayload(raw);
  const history = Array.isArray(payload?.history) ? payload.history : [];
  const points =
    Number(
      payload?.points ??
      payload?.total ??
      payload?.totalPoints ??
      payload?.total_points ??
      0
    ) || 0;

  return {
    walletAddress: String(payload?.walletAddress || payload?.wallet_address || walletAddress || ''),
    points,
    history: history.map((entry: any) => ({
      points: Number(entry?.points ?? 0) || 0,
      reason: String(entry?.reason || ''),
      timestamp: String(entry?.timestamp || ''),
      details: entry?.details ?? {},
    })),
    firstMint: payload?.firstMint || payload?.first_mint_at || null,
    createdAt: payload?.createdAt || payload?.created_at || null,
  };
};

export interface PointsAddResult {
  success: boolean;
  walletAddress: string;
  pointsAdded: number;
  bonusPoints: number;
  totalPoints: number;
}

export interface LeaderboardEntry {
  address: string;
  points: number;
  firstMint: string | null;
  packsMinted: number;
}

/**
 * Hole Punkte für eine Wallet-Adresse
 */
export const getPoints = async (walletAddress: string): Promise<PointsData> => {
  let lastError = 'Failed to fetch points';
  for (const baseUrl of API_FALLBACKS) {
    try {
      const response = await fetch(`${baseUrl}/api/points/${encodeURIComponent(walletAddress)}`);
      if (!response.ok) {
        lastError = `Failed to fetch points (HTTP ${response.status})`;
        continue;
      }
      const data = await response.json();
      return normalizePointsData(walletAddress, data);
    } catch (err: any) {
      lastError = err?.message || 'Failed to fetch points';
    }
  }
  throw new Error(lastError);
};

/**
 * Hole und kombiniere Punkte über mehrere Wallet-Adressen.
 * Wichtig für Wallets mit getrennten Payment/Ordinals-Adressen.
 */
export const getPointsForWalletAddresses = async (walletAddresses: string[]): Promise<PointsData> => {
  const fromWallet = (walletAddresses || []).map((a) => String(a || '').trim());
  const fromStorage = [
    typeof window !== 'undefined' ? localStorage.getItem('unisat_taproot_address') : null,
    typeof window !== 'undefined' ? localStorage.getItem('okx_taproot_address') : null,
    typeof window !== 'undefined' ? localStorage.getItem('okx_payment_address') : null,
  ].map((a) => String(a || '').trim());

  const addresses = Array.from(new Set([...fromWallet, ...fromStorage].filter(Boolean)));

  if (addresses.length === 0) {
    throw new Error('No wallet addresses provided');
  }

  const results = await Promise.all(
    addresses.map(async (address) => {
      try {
        return await getPoints(address);
      } catch {
        return null;
      }
    })
  );

  const validResults = results.filter(Boolean) as PointsData[];
  if (validResults.length === 0) {
    return {
      walletAddress: addresses[0],
      points: 0,
      history: [],
      firstMint: null,
      createdAt: null,
    };
  }

  const history = validResults.flatMap((entry) => (Array.isArray(entry.history) ? entry.history : []));
  history.sort((a, b) => {
    const at = Date.parse(a?.timestamp || '');
    const bt = Date.parse(b?.timestamp || '');
    return (Number.isFinite(bt) ? bt : 0) - (Number.isFinite(at) ? at : 0);
  });

  const firstMintCandidates = validResults
    .map((entry) => entry.firstMint)
    .filter((value): value is string => Boolean(value))
    .map((value) => Date.parse(value))
    .filter((value) => Number.isFinite(value));
  const createdAtCandidates = validResults
    .map((entry) => entry.createdAt)
    .filter((value): value is string => Boolean(value))
    .map((value) => Date.parse(value))
    .filter((value) => Number.isFinite(value));

  return {
    walletAddress: addresses.join(','),
    points: validResults.reduce((sum, entry) => sum + (Number(entry.points) || 0), 0),
    history,
    firstMint: firstMintCandidates.length ? new Date(Math.min(...firstMintCandidates)).toISOString() : null,
    createdAt: createdAtCandidates.length ? new Date(Math.min(...createdAtCandidates)).toISOString() : null,
  };
};

/**
 * Füge Punkte nach erfolgreichem Minting hinzu
 */
export const addPointsAfterMinting = async (
  walletAddress: string,
  packId: string,
  packName: string,
  cardCount: number
): Promise<PointsAddResult> => {
  return addPoints(
    walletAddress,
    MINT_POINTS,
    `Mint reward: ${packName || packId || 'Mint'}`,
    {
      type: 'mint',
      packId,
      packName,
      cardCount,
      pointsPerMint: MINT_POINTS,
    }
  );
};

/**
 * Füge Punkte für generische Aktionen hinzu (z.B. Tech & Games Minting)
 */
export const addPoints = async (
  walletAddress: string,
  points: number,
  reason: string,
  details?: any
): Promise<PointsAddResult> => {
  const response = await fetch(`${API_URL}/api/points/add`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      walletAddress,
      points,
      reason,
      details
    })
  });
  
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(errorData.error || 'Failed to add points');
  }
  
  const data = await response.json();
  return data;
};

/**
 * Einheitliche Mint-Belohnung: immer 10 Punkte pro erfolgreichem Mint.
 */
export const addMintPoints = async (
  walletAddress: string,
  details?: Record<string, any>
): Promise<PointsAddResult> => {
  return addPoints(
    walletAddress,
    MINT_POINTS,
    'Mint reward (+10)',
    {
      type: 'mint',
      pointsPerMint: MINT_POINTS,
      ...(details || {}),
    }
  );
};

/**
 * Hole Leaderboard
 */
export const getLeaderboard = async (limit: number = 10): Promise<LeaderboardEntry[]> => {
  const response = await fetch(`${API_URL}/api/points/leaderboard?limit=${limit}`);
  
  if (!response.ok) {
    throw new Error('Failed to fetch leaderboard');
  }
  
  const data = await response.json();
  return data.leaderboard || [];
};



