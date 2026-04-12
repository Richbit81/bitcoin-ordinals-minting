#!/usr/bin/env node
/**
 * Baut eine Marketplace-Import-Liste für bad-cats aus:
 * - GET /api/badcats/logs (api.richart.app)
 * - public/data/badcats-collection.json (Traits pro index)
 *
 * Ausgabe: public/data/badcats-marketplace-hashlist-import.json
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const COLLECTION_PATH = path.join(ROOT, 'public', 'data', 'badcats-collection.json');
const OUT_PATH = path.join(ROOT, 'public', 'data', 'badcats-marketplace-hashlist-import.json');

const LOGS_URL = process.env.BADCATS_LOGS_URL || 'https://api.richart.app/api/badcats/logs';

function parseItemIndexFromName(itemName) {
  const m = String(itemName || '').match(/#\s*(\d+)/);
  return m ? parseInt(m[1], 10) : null;
}

function layersToAttributes(layers) {
  if (!Array.isArray(layers)) return [];
  return layers.map((layer) => {
    const traitType = String(layer.traitType ?? layer.layerName ?? '').trim();
    const value = String(layer.trait?.name ?? '').trim() || 'none';
    return { trait_type: traitType, value };
  });
}

async function main() {
  const [rawCollection, logsRes] = await Promise.all([
    fs.readFile(COLLECTION_PATH, 'utf-8'),
    fetch(LOGS_URL),
  ]);

  if (!logsRes.ok) {
    throw new Error(`Logs HTTP ${logsRes.status}: ${await logsRes.text()}`);
  }

  const collection = JSON.parse(rawCollection);
  const byIndex = new Map();
  for (const g of collection.generated || []) {
    if (g && Number.isFinite(Number(g.index))) {
      byIndex.set(Number(g.index), g);
    }
  }

  const logsPayload = await logsRes.json();
  const logs = Array.isArray(logsPayload.logs) ? logsPayload.logs : [];

  const entries = [];
  const missingTraits = [];

  for (const log of logs) {
    const inscriptionId = String(log.inscriptionId || '').trim();
    if (!inscriptionId) continue;

    const itemName = String(log.itemName || '').trim();
    const itemIndex = parseItemIndexFromName(itemName);
    const gen = itemIndex != null ? byIndex.get(itemIndex) : null;
    const attributes = gen ? layersToAttributes(gen.layers) : [];

    if (itemIndex != null && !gen) {
      missingTraits.push({ inscriptionId, itemName, itemIndex });
    }

    entries.push({
      inscriptionId,
      name: itemName || `BadCats #${itemIndex ?? '?'}`,
      itemIndex: itemIndex ?? undefined,
      ownerAddress: String(log.walletAddress || '').trim(),
      rarity: '',
      attributes,
      metadata: {
        name: itemName,
        itemIndex,
        sourceLogId: log.id,
        timestamp: log.timestamp,
      },
    });
  }

  const payload = {
    generatedAt: new Date().toISOString(),
    collectionSlug: 'bad-cats',
    source: LOGS_URL,
    totalLogs: logs.length,
    entriesCount: entries.length,
    missingTraitsInCollectionJson: missingTraits.length,
    missingTraitsSample: missingTraits.slice(0, 30),
    items: entries,
  };

  await fs.writeFile(OUT_PATH, JSON.stringify(payload, null, 2), 'utf-8');
  console.log(`Wrote ${OUT_PATH}`);
  console.log(`Entries: ${entries.length} (logs: ${logs.length})`);
  if (missingTraits.length) {
    console.warn(`Warning: ${missingTraits.length} mint(s) had no matching index in badcats-collection.json (traits empty).`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
