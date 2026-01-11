import React, { useState, useEffect } from 'react';
import { WalletInscription } from '../../services/collectionService';

interface InscriptionPreviewProps {
  inscription: WalletInscription;
}

/**
 * Komponente für die Vorschau einer Inskription
 * Lädt Vorschaubilder direkt von ordinals.com (KEIN Backend-API-Call!)
 * Prüft asynchron, ob es eine Delegate-Inskription ist, wenn es eine HTML-Inskription ist
 */
export const InscriptionPreview: React.FC<InscriptionPreviewProps> = ({ inscription }) => {
  const [isCheckingDelegate, setIsCheckingDelegate] = useState(false);
  const [delegateCheckResult, setDelegateCheckResult] = useState<{ isDelegate: boolean; originalInscriptionId: string | null } | null>(null);

  let contentType = inscription.contentType?.toLowerCase() || 'unknown';
  
  // Fallback: Wenn Content-Type "unknown" ist, aber isDelegate-Flag gesetzt ist, setze auf HTML
  if (contentType === 'unknown' && (inscription.isDelegate === true || inscription.isDelegate === 'true')) {
    contentType = 'text/html';
  }

  const ordinalsContentUrl = `https://ordinals.com/content/${inscription.inscriptionId}`;

  // Prüfe, ob es eine HTML-Inskription ist, die NICHT als Delegate erkannt wurde
  const isHTML = contentType === 'text/html' || contentType.includes('html');
  const isNotDelegateYet = inscription.isDelegate !== true && inscription.isDelegate !== 'true' && !inscription.originalInscriptionId;
  
  // Prüfe einmalig, ob es eine Delegate-Inskription ist (nur für HTML-Inskriptionen, die noch nicht als Delegate erkannt wurden)
  // DIREKT von ordinals.com laden - KEIN Backend-API-Call mehr!
  useEffect(() => {
    // Nur prüfen, wenn es HTML ist, noch nicht als Delegate erkannt wurde, und noch nicht geprüft wurde
    if (isHTML && isNotDelegateYet && !isCheckingDelegate && delegateCheckResult === null) {
      setIsCheckingDelegate(true);
      
      // DIREKT von ordinals.com laden - KEIN Backend-API-Call!
      fetch(`https://ordinals.com/content/${inscription.inscriptionId}`, {
        method: 'GET',
        headers: { 'Accept': 'text/html,application/json,*/*' },
      })
        .then(res => {
          if (!res.ok) {
            throw new Error('Failed to fetch content');
          }
          return res.text();
        })
        .then(content => {
          // Prüfe delegate-metadata
          if (content && content.includes('delegate-metadata')) {
            const metadataMatch = content.match(/<script[^>]*id=["']delegate-metadata["'][^>]*>([\s\S]*?)<\/script>/i);
            if (metadataMatch) {
              try {
                const metadata = JSON.parse(metadataMatch[1]);
                if (metadata.originalInscriptionId) {
                  setDelegateCheckResult({ isDelegate: true, originalInscriptionId: metadata.originalInscriptionId });
                  setIsCheckingDelegate(false);
                  console.log(`[InscriptionPreview] ✅ Detected delegate (direct): ${inscription.inscriptionId} -> Original: ${metadata.originalInscriptionId}`);
                  return;
                }
              } catch (parseErr) {
                // Ignoriere Parse-Fehler
              }
            }
          }

          // Prüfe <img> Tag mit /content/ Referenz
          if (content && (content.includes('<img') || content.includes('/content/'))) {
            const imgMatch = content.match(/\/(content)\/([a-f0-9]{64}i\d+)/i);
            if (imgMatch && imgMatch[2] && imgMatch[2] !== inscription.inscriptionId) {
              setDelegateCheckResult({ isDelegate: true, originalInscriptionId: imgMatch[2] });
              setIsCheckingDelegate(false);
              console.log(`[InscriptionPreview] ✅ Detected delegate via <img> (direct): ${inscription.inscriptionId} -> Original: ${imgMatch[2]}`);
              return;
            }
          }

          // Keine Delegate-Inskription gefunden
          setDelegateCheckResult({ isDelegate: false, originalInscriptionId: null });
          setIsCheckingDelegate(false);
        })
        .catch(err => {
          console.error(`[InscriptionPreview] ❌ Error checking delegate (direct):`, err);
          setIsCheckingDelegate(false);
          setDelegateCheckResult({ isDelegate: false, originalInscriptionId: null });
        });
    }
  }, [inscription.inscriptionId, isHTML, isNotDelegateYet, isCheckingDelegate, delegateCheckResult]);

  // WICHTIG: Delegate-Inskriptionen zeigen das Original-Bild, nicht den HTML-Content!
  // Prüfe zuerst, ob bereits vom Backend als Delegate erkannt
  if ((inscription.isDelegate === true || inscription.isDelegate === 'true') || inscription.originalInscriptionId) {
    if (inscription.originalInscriptionId) {
      const originalImageUrl = `https://ordinals.com/content/${inscription.originalInscriptionId}`;
      return (
        <img
          src={originalImageUrl}
          alt={inscription.name}
          className="w-full h-full object-contain rounded"
          onError={(e) => {
            const target = e.currentTarget as HTMLImageElement;
            // Kein Fallback-API-Call mehr - direkt von ordinals.com
            target.style.display = 'none';
            const parent = target.parentElement;
            if (parent) {
              parent.innerHTML = '<div class="w-full h-full flex flex-col items-center justify-center p-2"><div class="text-4xl mb-2">🖼️</div><div class="text-xs text-gray-400 text-center">Delegate (Original not found)</div></div>';
            }
          }}
        />
      );
    }
  }

  // Wenn Delegate-Check erfolgreich war, zeige Original-Bild
  if (delegateCheckResult && delegateCheckResult.isDelegate && delegateCheckResult.originalInscriptionId) {
    const originalImageUrl = `https://ordinals.com/content/${delegateCheckResult.originalInscriptionId}`;
    return (
      <img
        src={originalImageUrl}
        alt={inscription.name}
        className="w-full h-full object-contain rounded"
        onError={(e) => {
          const target = e.currentTarget as HTMLImageElement;
          // Kein Fallback-API-Call mehr - direkt von ordinals.com
          target.style.display = 'none';
          const parent = target.parentElement;
          if (parent) {
            parent.innerHTML = '<div class="w-full h-full flex flex-col items-center justify-center p-2"><div class="text-4xl mb-2">🖼️</div><div class="text-xs text-gray-400 text-center">Delegate (Original not found)</div></div>';
          }
        }}
      />
    );
  }

  // Für HTML-Inskriptionen, die NICHT als Delegate erkannt wurden: Zeige als iframe (während Check oder wenn kein Delegate)
  if (isHTML && isNotDelegateYet) {
    return (
      <iframe
        src={ordinalsContentUrl}
        className="w-full h-full rounded"
        sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-modals allow-pointer-lock"
        title={inscription.name}
        style={{ border: 'none', pointerEvents: 'auto' }}
        onError={(e) => {
          const target = e.currentTarget as HTMLIFrameElement;
          target.style.display = 'none';
          const parent = target.parentElement;
          if (parent) {
            parent.innerHTML = '<div class="w-full h-full flex flex-col items-center justify-center p-2"><div class="text-4xl mb-2">📄</div><div class="text-xs text-gray-400 text-center">HTML</div></div>';
          }
        }}
      />
    );
  }

  // Bilder: PNG, JPG, JPEG, GIF, WebP, AVIF, SVG, BMP, ICO, etc.
  // Direkt von ordinals.com laden - KEIN Backend-API-Call!
  if (contentType.includes('image/') || contentType === 'image/svg+xml' || contentType.includes('svg')) {
    return (
      <img
        src={ordinalsContentUrl}
        alt={inscription.name}
        className="w-full h-full object-contain rounded"
        onError={(e) => {
          const target = e.currentTarget as HTMLImageElement;
          // Kein Fallback-API-Call mehr - direkt von ordinals.com
          target.style.display = 'none';
          const parent = target.parentElement;
          if (parent) {
            parent.innerHTML = '<div class="w-full h-full flex flex-col items-center justify-center p-2"><div class="text-4xl mb-2">🖼️</div><div class="text-xs text-gray-400 text-center">Image</div></div>';
          }
        }}
      />
    );
  }

  // HTML (wenn bereits als Delegate erkannt wurde, wird es oben behandelt)
  if ((contentType.includes('text/html') || contentType.includes('html')) && 
      inscription.isDelegate !== true && inscription.isDelegate !== 'true') {
    return (
      <iframe
        src={ordinalsContentUrl}
        className="w-full h-full rounded"
        sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-modals allow-pointer-lock"
        title={inscription.name}
        style={{ border: 'none', pointerEvents: 'auto' }}
        onError={(e) => {
          const target = e.currentTarget as HTMLIFrameElement;
          target.style.display = 'none';
          const parent = target.parentElement;
          if (parent) {
            parent.innerHTML = '<div class="w-full h-full flex flex-col items-center justify-center p-2"><div class="text-4xl mb-2">📄</div><div class="text-xs text-gray-400 text-center">HTML</div></div>';
          }
        }}
      />
    );
  }

  // Audio: MP3, WAV, OGG, M4A, FLAC, etc.
  if (contentType.includes('audio/')) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center p-2 bg-gray-900 rounded">
        <div className="text-4xl mb-2">🎵</div>
        <audio
          src={ordinalsContentUrl}
          controls
          className="w-full max-w-full"
          preload="metadata"
        >
          Ihr Browser unterstützt das Audio-Element nicht.
        </audio>
        <div className="text-xs text-gray-400 text-center mt-1">Audio</div>
      </div>
    );
  }

  // Video: MP4, WebM, AVI, MOV, etc.
  if (contentType.includes('video/')) {
    return (
      <video
        src={ordinalsContentUrl}
        className="w-full h-full object-contain rounded"
        controls
        preload="metadata"
      >
        Ihr Browser unterstützt das Video-Element nicht.
      </video>
    );
  }

  // JSON
  if (contentType.includes('application/json') || contentType.includes('json')) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center p-2 bg-gray-900 rounded">
        <div className="text-4xl mb-2">📄</div>
        <div className="text-xs text-gray-400 text-center mt-1">JSON</div>
      </div>
    );
  }

  // Text
  if (contentType.includes('text/plain')) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center p-2 bg-gray-900 rounded">
        <div className="text-4xl mb-2">📝</div>
        <div className="text-xs text-gray-400 text-center mt-1">Text</div>
      </div>
    );
  }

  // Fallback für unbekannte Typen
  return (
    <div className="w-full h-full flex flex-col items-center justify-center p-2 bg-gray-900 rounded">
      <div className="text-4xl mb-2">❓</div>
      <div className="text-xs text-gray-400 text-center mt-1">Unknown ({contentType})</div>
    </div>
  );
};
