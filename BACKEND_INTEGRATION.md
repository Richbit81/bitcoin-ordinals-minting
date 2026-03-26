# Backend Integration Anleitung

## Routes registrieren

Die folgenden Routes müssen in Ihrer `server.ts` registriert werden:

```typescript
import packsRouter from './routes/packs';
import mintingLogRouter from './routes/mintingLog';
import pinkChatRouter from './routes/pinkChat';
import { startPinkChatDailyScheduler } from './services/pinkChatScheduler';

// Pack-Supply Routes
app.use('/api/packs', packsRouter);

// Minting-Log Routes
app.use('/api/minting', mintingLogRouter);

// Pink Puppets Discord-lite Chat
app.use('/api/pinkchat', pinkChatRouter);

// Scheduler für tägliche Wallet-Revalidierung
startPinkChatDailyScheduler();
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

### PinkChat (Discord-lite)
- `POST /api/pinkchat/auth/register`
- `POST /api/pinkchat/auth/login`
- `GET /api/pinkchat/auth/me`
- `POST /api/pinkchat/wallet/link/start`
- `POST /api/pinkchat/wallet/link/verify`
- `POST /api/pinkchat/wallet/revalidate`
- `GET /api/pinkchat/chat/rooms`
- `GET /api/pinkchat/chat/rooms/:roomId/messages`
- `POST /api/pinkchat/chat/rooms/:roomId/messages`
- `POST /api/pinkchat/admin/chat/rooms`

## Fallback-Mechanismus

Das Frontend verwendet automatisch LocalStorage als Fallback, wenn das Backend nicht erreichbar ist. Die Logs werden sowohl im Backend als auch im Browser gespeichert.








