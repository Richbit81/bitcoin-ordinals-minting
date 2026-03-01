#!/usr/bin/env node
/**
 * Generic hashlist fetcher for paginated marketplace APIs.
 *
 * Examples:
 * 1) Cursor in query + array at data.items
 *    node fetch-hashlist.mjs \
 *      --url "https://example.com/api/collection/items" \
 *      --pagination cursor \
 *      --cursor-param cursor \
 *      --items-path data.items \
 *      --next-cursor-path data.nextCursor \
 *      --output sons-of-satoshi-hashlist.json
 *
 * 2) Offset pagination
 *    node fetch-hashlist.mjs \
 *      --url "https://example.com/api/collection/items" \
 *      --pagination offset \
 *      --offset-param offset \
 *      --limit-param limit \
 *      --limit 100 \
 *      --items-path items
 *
 * 3) Add custom header(s)
 *    node fetch-hashlist.mjs \
 *      --url "https://example.com/api/collection/items" \
 *      --header "authorization: Bearer <token>" \
 *      --header "x-api-key: <key>"
 */

import fs from 'node:fs/promises';

function parseArgs(argv) {
  const out = {
    method: 'GET',
    pagination: 'cursor',
    cursorParam: 'cursor',
    offsetParam: 'offset',
    limitParam: 'limit',
    limit: 100,
    maxPages: 1000,
    itemsPath: '',
    nextCursorPath: '',
    idPaths: 'inscriptionId,inscription_id,id',
    output: 'hashlist.json',
    timeoutMs: 20000,
    header: [],
  };

  for (let i = 2; i < argv.length; i += 1) {
    const key = argv[i];
    const value = argv[i + 1];
    if (!key.startsWith('--')) continue;

    const name = key.slice(2);
    const takesValue = !['help'].includes(name);

    if (!takesValue) {
      out[name] = true;
      continue;
    }

    if (typeof value === 'undefined' || value.startsWith('--')) {
      throw new Error(`Missing value for --${name}`);
    }

    if (name === 'header') {
      out.header.push(value);
      i += 1;
      continue;
    }

    out[name] = value;
    i += 1;
  }

  out.method = String(out.method || 'GET').toUpperCase();
  out.pagination = String(out.pagination || 'cursor').toLowerCase();
  out.limit = Number(out.limit || 100);
  out.maxPages = Number(out.maxPages || 1000);
  out.timeoutMs = Number(out.timeoutMs || 20000);
  out.idPathsList = String(out.idPaths || 'inscriptionId,inscription_id,id')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  return out;
}

function printHelp() {
  console.log(`
Usage:
  node fetch-hashlist.mjs --url <endpoint> [options]

Required:
  --url                API endpoint

Common options:
  --method GET|POST    HTTP method (default: GET)
  --pagination         cursor|offset|none (default: cursor)
  --items-path         Dot path to items array (optional; auto-detect if omitted)
  --id-paths           Comma list of ID keys (default: inscriptionId,inscription_id,id)
  --output             Output file (default: hashlist.json)
  --header "k:v"       Repeatable custom headers
  --timeoutMs          Request timeout in ms (default: 20000)
  --maxPages           Safety cap (default: 1000)

Cursor mode options:
  --cursor-param       Query key for cursor (default: cursor)
  --next-cursor-path   Dot path to next cursor in response (optional; auto-detect if omitted)

Offset mode options:
  --offset-param       Query key for offset (default: offset)
  --limit-param        Query key for limit (default: limit)
  --limit              Page size (default: 100)

Examples:
  node fetch-hashlist.mjs --url "https://example.com/api/items" --pagination cursor --items-path data.items --next-cursor-path data.nextCursor
  node fetch-hashlist.mjs --url "https://example.com/api/items" --pagination offset --items-path items --limit 200
`);
}

function getByPath(obj, path) {
  if (!path) return undefined;
  const parts = path.split('.').map((s) => s.trim()).filter(Boolean);
  let cur = obj;
  for (const p of parts) {
    if (cur == null || typeof cur !== 'object') return undefined;
    cur = cur[p];
  }
  return cur;
}

function autoFindItemsArray(payload) {
  if (Array.isArray(payload)) return payload;
  if (!payload || typeof payload !== 'object') return null;

  const candidateKeys = ['items', 'results', 'data', 'inscriptions', 'listings', 'rows'];
  for (const k of candidateKeys) {
    const v = payload[k];
    if (Array.isArray(v)) return v;
    if (v && typeof v === 'object') {
      for (const nestedKey of candidateKeys) {
        if (Array.isArray(v[nestedKey])) return v[nestedKey];
      }
    }
  }
  return null;
}

function autoFindNextCursor(payload) {
  if (!payload || typeof payload !== 'object') return null;
  const directKeys = ['nextCursor', 'next_cursor', 'cursor', 'next'];
  for (const k of directKeys) {
    if (payload[k] != null && payload[k] !== '') return String(payload[k]);
  }
  const containers = ['data', 'pageInfo', 'pagination', 'meta'];
  for (const c of containers) {
    const v = payload[c];
    if (v && typeof v === 'object') {
      for (const k of directKeys) {
        if (v[k] != null && v[k] !== '') return String(v[k]);
      }
    }
  }
  return null;
}

function pickId(item, idPathsList) {
  if (!item || typeof item !== 'object') return null;
  for (const path of idPathsList) {
    const v = getByPath(item, path);
    if (typeof v === 'string' && v.trim()) return v.trim();
  }
  return null;
}

function parseHeaders(headerPairs) {
  const headers = {};
  for (const pair of headerPairs || []) {
    const idx = pair.indexOf(':');
    if (idx <= 0) continue;
    const k = pair.slice(0, idx).trim();
    const v = pair.slice(idx + 1).trim();
    if (k) headers[k] = v;
  }
  return headers;
}

async function fetchJson(url, options, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...options, signal: controller.signal });
    const text = await res.text();
    let data;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      throw new Error(`Response is not JSON. Status: ${res.status}`);
    }
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}: ${JSON.stringify(data)?.slice(0, 500)}`);
    }
    return data;
  } finally {
    clearTimeout(timer);
  }
}

async function main() {
  const args = parseArgs(process.argv);
  if (args.help || !args.url) {
    printHelp();
    process.exit(args.url ? 0 : 1);
  }

  const baseUrl = new URL(args.url);
  const headers = parseHeaders(args.header);
  const method = args.method;

  const ids = new Set();
  const allItems = [];
  let page = 0;
  let offset = 0;
  let cursor = '';
  const seenCursors = new Set();

  while (page < args.maxPages) {
    const requestUrl = new URL(baseUrl.toString());
    if (args.pagination === 'cursor') {
      if (cursor) requestUrl.searchParams.set(args.cursorParam, cursor);
    } else if (args.pagination === 'offset') {
      requestUrl.searchParams.set(args.offsetParam, String(offset));
      requestUrl.searchParams.set(args.limitParam, String(args.limit));
    }

    const payload = await fetchJson(requestUrl.toString(), { method, headers }, args.timeoutMs);
    const items = args.itemsPath ? getByPath(payload, args.itemsPath) : autoFindItemsArray(payload);

    if (!Array.isArray(items)) {
      throw new Error(
        `Could not find items array in response. Try --items-path explicitly. Page ${page + 1}`
      );
    }

    for (const item of items) {
      allItems.push(item);
      const id = pickId(item, args.idPathsList);
      if (id) ids.add(id);
    }

    page += 1;
    console.log(
      `[Page ${page}] items=${items.length} uniqueIds=${ids.size} totalItemsSeen=${allItems.length}`
    );

    if (items.length === 0 || args.pagination === 'none') break;

    if (args.pagination === 'cursor') {
      const nextCursor = args.nextCursorPath
        ? getByPath(payload, args.nextCursorPath)
        : autoFindNextCursor(payload);
      const next = nextCursor == null ? '' : String(nextCursor);
      if (!next || seenCursors.has(next)) break;
      seenCursors.add(next);
      cursor = next;
    } else if (args.pagination === 'offset') {
      if (items.length < args.limit) break;
      offset += args.limit;
    }
  }

  const hashlist = Array.from(ids);
  const output = {
    sourceUrl: args.url,
    fetchedAt: new Date().toISOString(),
    pagination: args.pagination,
    pagesFetched: page,
    totalItemsSeen: allItems.length,
    totalUniqueIds: hashlist.length,
    hashlist,
  };

  await fs.writeFile(args.output, JSON.stringify(output, null, 2), 'utf8');
  console.log(`\nSaved: ${args.output}`);
  console.log(`Unique inscription IDs: ${hashlist.length}`);
}

main().catch((err) => {
  console.error(`Error: ${err.message || err}`);
  process.exit(1);
});

