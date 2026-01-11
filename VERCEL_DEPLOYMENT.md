# Vercel Deployment Anleitung

## 🚀 Frontend auf Vercel deployen

### 1. Voraussetzungen

- GitHub Repository mit dem Frontend-Code
- Vercel Account (kostenlos auf [vercel.com](https://vercel.com))
- Railway Backend bereits deployed (für die Backend-URL)

### 2. Vercel-Projekt erstellen

1. Gehe zu [vercel.com](https://vercel.com) und melde dich an
2. Klicke auf **"Add New..."** → **"Project"**
3. Wähle dein GitHub Repository aus
4. Vercel erkennt automatisch Vite/React
5. **Root Directory**: `bitcoin-ordinals-minting` (falls das Frontend in einem Unterordner ist)

### 3. Build-Einstellungen

Vercel sollte automatisch erkennen:
- **Framework Preset**: Vite
- **Build Command**: `npm run build`
- **Output Directory**: `dist`
- **Install Command**: `npm install`

Falls nicht automatisch erkannt, setze manuell in `vercel.json` (bereits erstellt).

### 4. Environment-Variablen setzen

Im Vercel Dashboard → **Settings** → **Environment Variables**, füge hinzu:

#### Erforderliche Variable:

```
VITE_INSCRIPTION_API_URL=https://your-backend.up.railway.app
```

**WICHTIG:** 
- Ersetze `your-backend.up.railway.app` mit deiner tatsächlichen Railway-Backend-URL
- Diese Variable wird zur Build-Zeit eingefügt
- Setze sie für alle Environments (Production, Preview, Development)

#### Optional (für verschiedene Environments):

```
# Production
VITE_INSCRIPTION_API_URL=https://your-backend-production.up.railway.app

# Preview (für Pull Requests)
VITE_INSCRIPTION_API_URL=https://your-backend-preview.up.railway.app

# Development
VITE_INSCRIPTION_API_URL=http://localhost:3003
```

### 5. Deployment

Vercel deployt automatisch bei jedem Push zu deinem Repository.

**Manuelles Deployment:**
- Im Vercel Dashboard → **Deployments** Tab
- Klicke auf **"Redeploy"**

### 6. Frontend-URL finden

Nach dem Deployment findest du die URL im Vercel Dashboard:
- **Deployments** → Klicke auf den neuesten Deployment
- Die URL sieht aus wie: `https://your-project.vercel.app`

### 7. Custom Domain (Optional)

1. Im Vercel Dashboard → **Settings** → **Domains**
2. Füge deine Domain hinzu
3. Folge den DNS-Anweisungen

### 8. CORS-Konfiguration prüfen

Stelle sicher, dass dein Railway-Backend CORS für deine Vercel-Domain erlaubt:

**In `bitcoin-ordinals-backend/server.js`:**

```javascript
app.use(cors({
  origin: [
    'https://your-project.vercel.app',
    'https://your-custom-domain.com',
    'http://localhost:5173', // Für lokale Entwicklung
  ],
  credentials: true
}));
```

Oder für alle Origins (einfacher für Entwicklung):

```javascript
app.use(cors()); // Erlaubt alle Origins
```

### 9. Logs prüfen

Im Vercel Dashboard → **Deployments** → Klicke auf den neuesten Deployment → **View Function Logs**

Du solltest sehen:
- ✅ Build erfolgreich
- ✅ Deployment erfolgreich
- ✅ Frontend erreichbar

### 10. Troubleshooting

**Problem: Build schlägt fehl**
- Prüfe die Build-Logs im Vercel Dashboard
- Stelle sicher, dass alle Dependencies in `package.json` vorhanden sind
- Prüfe TypeScript-Fehler: `npm run build` lokal ausführen

**Problem: API-Calls schlagen fehl (CORS)**
- Prüfe CORS-Konfiguration im Backend
- Stelle sicher, dass `VITE_INSCRIPTION_API_URL` korrekt gesetzt ist
- Prüfe Browser-Console auf Fehler

**Problem: Environment-Variablen werden nicht geladen**
- Stelle sicher, dass Variablen mit `VITE_` Präfix beginnen
- Redeploy nach dem Setzen von Environment-Variablen
- Prüfe, ob Variablen für das richtige Environment gesetzt sind

**Problem: Routing funktioniert nicht (404 auf Refresh)**
- Prüfe `vercel.json` → `rewrites` Konfiguration
- Stelle sicher, dass alle Routes zu `/index.html` umgeleitet werden

### 11. Kosten

Vercel bietet einen **kostenlosen Plan** mit:
- Unbegrenzte Deployments
- 100 GB Bandbreite pro Monat
- Genug für die meisten Projekte

Für größere Projekte:
- **Pro Plan**: $20/Monat
- **Enterprise**: Custom Pricing

### 12. Nächste Schritte

1. ✅ Frontend auf Vercel deployen
2. ✅ Backend-URL in Environment-Variablen setzen
3. ✅ CORS im Backend konfigurieren
4. ✅ Beide Services testen
5. ✅ Custom Domain einrichten (optional)

### 13. Workflow

**Lokale Entwicklung:**
```bash
# Frontend
cd bitcoin-ordinals-minting
npm run dev

# Backend (lokal)
cd bitcoin-ordinals-backend
npm start
```

**Production:**
- Frontend: Automatisch auf Vercel bei Push
- Backend: Automatisch auf Railway bei Push
- Beide Services kommunizieren über Production-URLs

---

**Fragen?** Prüfe die Vercel-Dokumentation: [vercel.com/docs](https://vercel.com/docs)

