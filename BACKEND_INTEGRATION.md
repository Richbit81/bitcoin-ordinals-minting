# Backend Integration Anleitung

## Routes registrieren

Die folgenden Routes müssen in Ihrer `server.ts` registriert werden:

```typescript
import packsRouter from './routes/packs';
import mintingLogRouter from './routes/mintingLog';

// Pack-Supply Routes
app.use('/api/packs', packsRouter);

// Minting-Log Routes
app.use('/api/minting', mintingLogRouter);
```

## Services initialisieren

```typescript
import { initializeSupplyState } from './services/packSupply';

// Beim Server-Start
initializeSupplyState();
```

## Daten-Verzeichnis

Das Backend erstellt automatisch ein `data/` Verzeichnis für die Minting-Logs:
- `data/minting-logs.json` - Speichert alle Minting-Logs

## API-Endpunkte

### Pack-Supply
- `GET /api/packs/availability` - Verfügbarkeit aller Packs
- `GET /api/packs/:packId/availability` - Verfügbarkeit eines Packs
- `POST /api/packs/:packId/increment` - Pack-Supply inkrementieren

### Minting-Log
- `POST /api/minting/log` - Speichert einen Minting-Log
- `GET /api/minting/logs/:address` - Lädt Logs für eine Wallet-Adresse

## Fallback-Mechanismus

Das Frontend verwendet automatisch LocalStorage als Fallback, wenn das Backend nicht erreichbar ist. Die Logs werden sowohl im Backend als auch im Browser gespeichert.








