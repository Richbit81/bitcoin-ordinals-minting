# 🔑 Hybrid Collection System - Dokumentation

## Überblick

Das System unterstützt jetzt **zwei Arten von Collections**:

### 1. **Backend-Signierte Collections** (Admin)
- ✅ Black & Wild
- ✅ Tech & Games  
- ✅ Point Shop
- ✅ Andere Admin-Collections

**Funktionsweise:**
- Backend hat Private Keys
- Sofortiger Transfer nach Kauf
- Pre-Signed PSBTs
- Keine Wallet-Interaktion nötig

### 2. **User-Signierte Collections** (Wallet)
- ✅ Sons of Satoshi
- ✅ Alle von Users erstellten Collections

**Funktionsweise:**
- User besitzt Originals in Wallet
- Backend erstellt unsigned PSBT
- User signiert mit Wallet (Xverse/UniSat)
- User broadcastet Transaction

---

## Backend API

### Collection Model (erweitert)

```javascript
{
  id: "collection-123",
  name: "Sons of Satoshi",
  description: "...",
  price: 0.0001,
  items: [...],
  
  // NEU: Hybrid Flags
  isBackendSigned: false,     // true = Backend signiert, false = User signiert
  ownerAddress: "bc1p...",    // Wallet-Adresse des Collection-Owners (optional)
  
  // Bestehende Felder
  isPremium: false,
  mintType: "individual",
  showBanner: false,
  active: true,
}
```

### API Endpoint: `/api/collections/mint-original`

**Request:**
```json
{
  "walletAddress": "bc1p...",
  "collectionId": "collection-123",
  "itemId": "inscription-id",
  "feeRate": 5
}
```

**Response (Backend-Signed):**
```json
{
  "success": true,
  "txid": "abc123...",
  "instant": true,
  "message": "Transfer completed - inscription is on its way!"
}
```

**Response (User-Signed):**
```json
{
  "success": true,
  "requiresWalletSigning": true,
  "psbtBase64": "cHNidP...",
  "inscriptionId": "abc...i0",
  "ownerAddress": "bc1p...",
  "recipientAddress": "bc1p...",
  "message": "Please sign this PSBT with your wallet"
}
```

---

## Frontend Integration

### Minting Flow

```typescript
// 1. Request mint
const response = await fetch('/api/collections/mint-original', {
  method: 'POST',
  body: JSON.stringify({
    walletAddress: userAddress,
    collectionId: collectionId,
    itemId: itemId,
    feeRate: 5
  })
});

const data = await response.json();

// 2. Check if wallet signing is required
if (data.requiresWalletSigning) {
  // USER-SIGNED COLLECTION
  
  // 3. Sign with wallet
  const signedPsbt = await window.unisat.signPsbt(data.psbtBase64);
  
  // 4. Broadcast
  const txid = await window.unisat.pushPsbt(signedPsbt);
  
  console.log('Transaction broadcasted:', txid);
  
} else {
  // BACKEND-SIGNED COLLECTION
  console.log('Transfer complete:', data.txid);
}
```

---

## Collection Erstellen

### Als Admin (Backend-Signed)

```javascript
await createCollection({
  name: "Black & Wild",
  price: 0.00005,
  items: [...originals],
  isBackendSigned: true,  // Backend signiert
  ownerAddress: null,     // Kein Owner nötig
});
```

### Als User (Wallet-Signed)

```javascript
await createCollection({
  name: "Sons of Satoshi",
  price: 0.0001,
  items: [...originals],
  isBackendSigned: false,         // User signiert
  ownerAddress: "bc1pv6vt56...",  // Owner Wallet
});
```

---

## Migration bestehender Collections

**Alle bestehenden Collections werden automatisch als `isBackendSigned: true` behandelt (backwards compatible).**

Für neue User-Collections:
1. Admin Panel öffnen
2. Collection bearbeiten
3. `isBackendSigned` auf `false` setzen
4. `ownerAddress` eintragen

---

## Vorteile

✅ **Admins:** Volle Kontrolle mit Pre-Signing  
✅ **Users:** Können eigene Collections ohne Admin-Keys erstellen  
✅ **Flexibel:** Beide Systeme parallel nutzbar  
✅ **Sicher:** Keine Private Keys für User-Collections im Backend

---

## Technische Details

### DB Schema (PostgreSQL)

```sql
ALTER TABLE collections ADD COLUMN is_backend_signed BOOLEAN DEFAULT true;
ALTER TABLE collections ADD COLUMN owner_address VARCHAR(255) DEFAULT NULL;
```

### Code Locations

- **Backend Model:** `services/collectionService.js`
- **DB Schema:** `services/db.js`
- **Minting Logic:** `server.js` (Line 5175+)
- **Transfer Service:** `services/ordinalTransferService.js`

---

## Testing

1. ✅ Backend deployed (Railway auto-deploy)
2. ⏳ Frontend anpassen für Wallet-Signing
3. ⏳ Sons of Satoshi als User-Collection testen
