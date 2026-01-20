/**
 * Mempool.space API Service
 * Provides real-time Bitcoin network and fee information
 */

const MEMPOOL_API_BASE = 'https://mempool.space/api';

export interface FeeRecommendation {
  fastestFee: number;    // ~10 min
  halfHourFee: number;   // ~30 min
  hourFee: number;       // ~60 min
  economyFee: number;    // Low priority
  minimumFee: number;    // Minimum to be accepted
}

export interface MempoolStatus {
  count: number;         // Number of unconfirmed transactions
  vsize: number;         // Total size in vbytes
  total_fee: number;     // Total fees in satoshis
  fee_histogram: number[][];
}

export interface BlockInfo {
  height: number;
  timestamp: number;
  medianFee: number;
  avgFee: number;
  feeRange: number[];
}

export interface MempoolBlock {
  blockSize: number;
  blockVSize: number;
  nTx: number;
  medianFee: number;
  totalFees: number;
  feeRange: number[];
}

export interface FeeHistoryPoint {
  timestamp: number;
  avgFee: number;
}

/**
 * Fetches current recommended fees
 * Note: The /v1/fees/recommended endpoint returns integers only!
 * For decimal precision (e.g., 0.2 sat/vB), we fetch from /mempool/blocks
 */
export async function getRecommendedFees(): Promise<FeeRecommendation> {
  try {
    // Try to get precise fees from mempool blocks first
    const blocksResponse = await fetch(`${MEMPOOL_API_BASE}/v1/fees/mempool-blocks`);
    if (blocksResponse.ok) {
      const blocks = await blocksResponse.json();
      console.log('[Mempool] 📊 Mempool blocks data:', blocks);
      
      // Extract fee ranges from the projected blocks
      if (blocks && blocks.length > 0) {
        const firstBlock = blocks[0];
        const medianBlock = blocks[Math.min(2, blocks.length - 1)];
        const slowBlock = blocks[Math.min(5, blocks.length - 1)];
        
        // Use medianFee for all priorities (not feeRange max!)
        return {
          fastestFee: firstBlock.medianFee || 1,
          halfHourFee: medianBlock.medianFee || 1,
          hourFee: slowBlock.medianFee || 1,
          economyFee: blocks[blocks.length - 1]?.medianFee || 1,
          minimumFee: blocks[blocks.length - 1]?.feeRange?.[0] || 1
        };
      }
    }
    
    // Fallback to recommended endpoint (integers only)
    const response = await fetch(`${MEMPOOL_API_BASE}/v1/fees/recommended`);
    if (!response.ok) throw new Error('Failed to fetch fees');
    return await response.json();
  } catch (error) {
    console.error('[Mempool] Error fetching fees:', error);
    throw error;
  }
}

/**
 * Fetches current mempool status
 */
export async function getMempoolStatus(): Promise<MempoolStatus> {
  try {
    const response = await fetch(`${MEMPOOL_API_BASE}/mempool`);
    if (!response.ok) throw new Error('Failed to fetch mempool status');
    return await response.json();
  } catch (error) {
    console.error('[Mempool] Error fetching mempool status:', error);
    throw error;
  }
}

/**
 * Fetches recent blocks for fee history (last 24h)
 */
export async function getFeeHistory24h(): Promise<FeeHistoryPoint[]> {
  try {
    const response = await fetch(`${MEMPOOL_API_BASE}/v1/mining/blocks/fee-rates/24h`);
    if (!response.ok) throw new Error('Failed to fetch fee history');
    
    const blocks: BlockInfo[] = await response.json();
    
    // Transform to chart-friendly format
    return blocks.map(block => ({
      timestamp: block.timestamp,
      avgFee: block.avgFee || block.medianFee || 0
    }));
  } catch (error) {
    console.error('[Mempool] Error fetching fee history:', error);
    // Return empty array as fallback
    return [];
  }
}

/**
 * Gets the current block height
 */
export async function getCurrentBlockHeight(): Promise<number> {
  try {
    const response = await fetch(`${MEMPOOL_API_BASE}/blocks/tip/height`);
    if (!response.ok) throw new Error('Failed to fetch block height');
    return await response.json();
  } catch (error) {
    console.error('[Mempool] Error fetching block height:', error);
    return 0;
  }
}

/**
 * Utility: Get fee level color
 */
export function getFeeColor(fee: number): string {
  if (fee <= 15) return '#10b981'; // green-500 (low)
  if (fee <= 30) return '#f59e0b'; // amber-500 (medium)
  if (fee <= 50) return '#f97316'; // orange-500 (high)
  return '#ef4444'; // red-500 (very high)
}

/**
 * Utility: Get fee level emoji
 */
export function getFeeEmoji(fee: number): string {
  if (fee <= 15) return '🐢';
  if (fee <= 30) return '⚡';
  if (fee <= 50) return '🚀';
  return '🔥';
}

/**
 * Utility: Get estimated confirmation time
 */
export function getEstimatedTime(feeType: 'fastest' | 'halfHour' | 'hour' | 'economy'): string {
  switch (feeType) {
    case 'fastest': return '~10 Min';
    case 'halfHour': return '~30 Min';
    case 'hour': return '~1h';
    case 'economy': return '~2-4h';
    default: return '';
  }
}
