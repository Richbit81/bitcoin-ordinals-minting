/**
 * Punkte-Service für Frontend
 */

const API_URL = import.meta.env.VITE_INSCRIPTION_API_URL || 'http://localhost:3003';

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
  const response = await fetch(`${API_URL}/api/points/${walletAddress}`);
  
  if (!response.ok) {
    throw new Error('Failed to fetch points');
  }
  
  const data = await response.json();
  return data;
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
  const response = await fetch(`${API_URL}/api/points/add`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      walletAddress,
      packId,
      packName,
      cardCount
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



