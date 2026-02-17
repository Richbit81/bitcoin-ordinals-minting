import React, { useState, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import JSZip from 'jszip';
import { useWallet } from '../contexts/WalletContext';
import { isAdminAddress } from '../config/admin';
import { getApiUrl } from '../utils/apiUrl';

interface ConvertedFile {
  name: string;
  originalSize: number;
  convertedSize: number;
  blob: Blob;
  preview: string;
}

export const AvifConverterPage: React.FC = () => {
  const navigate = useNavigate();
  const { walletState } = useWallet();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const connectedAddress = walletState.accounts?.find((a: any) => a.purpose === 'ordinals')?.address 
    || walletState.accounts?.[0]?.address;
  const isAdmin = walletState.connected && isAdminAddress(connectedAddress);

  const [files, setFiles] = useState<File[]>([]);
  const [quality, setQuality] = useState(75);
  const [outWidth, setOutWidth] = useState<string>('');
  const [outHeight, setOutHeight] = useState<string>('');
  const [converting, setConverting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [converted, setConverted] = useState<ConvertedFile[]>([]);
  const [error, setError] = useState<string | null>(null);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files;
    if (!selected) return;

    const imageFiles = Array.from(selected).filter(f =>
      f.type === 'image/png' || f.type === 'image/jpeg' || f.type === 'image/jpg' || f.type === 'image/webp'
    );

    if (imageFiles.length === 0) {
      setError('Keine unterstützten Bilder gefunden (PNG, JPG, WebP)');
      return;
    }

    setFiles(imageFiles);
    setConverted([]);
    setError(null);
    setProgress(0);
  }, []);

  const w = outWidth.trim() ? parseInt(outWidth.trim(), 10) : 0;
  const h = outHeight.trim() ? parseInt(outHeight.trim(), 10) : 0;
  const targetW = w > 0 && w <= 10000 ? w : null;
  const targetH = h > 0 && h <= 10000 ? h : null;

  const getImageData = (file: File, resizeW?: number | null, resizeH?: number | null): Promise<ImageData> => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        let drawW = img.naturalWidth;
        let drawH = img.naturalHeight;
        if (resizeW && resizeH) {
          const scale = Math.min(resizeW / drawW, resizeH / drawH);
          drawW = Math.round(drawW * scale);
          drawH = Math.round(drawH * scale);
        } else if (resizeW) {
          const scale = resizeW / drawW;
          drawW = resizeW;
          drawH = Math.round(drawH * scale);
        } else if (resizeH) {
          const scale = resizeH / drawH;
          drawW = Math.round(drawW * scale);
          drawH = resizeH;
        }
        const canvas = document.createElement('canvas');
        canvas.width = drawW;
        canvas.height = drawH;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        if (!ctx) {
          reject(new Error('Canvas context not available'));
          return;
        }
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0, drawW, drawH);
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        URL.revokeObjectURL(img.src);
        resolve(imageData);
      };
      img.onerror = () => {
        URL.revokeObjectURL(img.src);
        reject(new Error(`Bild konnte nicht geladen werden: ${file.name}`));
      };
      img.src = URL.createObjectURL(file);
    });
  };

  const convertViaClient = useCallback(async (): Promise<ConvertedFile[]> => {
    const avifModule = await import('@jsquash/avif');
    const avifEncode = avifModule.default || avifModule.encode;
    const results: ConvertedFile[] = [];

    for (let i = 0; i < files.length; i++) {
      try {
        const imageData = await getImageData(files[i], targetW, targetH);
        const hasAlpha = (() => {
          const d = imageData.data;
          for (let j = 3; j < d.length; j += 4) {
            if (d[j] < 255) return true;
          }
          return false;
        })();

        const avifBuffer = await avifEncode(imageData, {
          quality,
          qualityAlpha: hasAlpha ? 100 : -1,
          subsample: hasAlpha ? 3 : 1,
          speed: hasAlpha ? 4 : 6,
          enableSharpYUV: hasAlpha,
        });

        const blob = new Blob([avifBuffer], { type: 'image/avif' });
        const nameWithoutExt = files[i].name.replace(/\.[^.]+$/, '');
        results.push({
          name: `${nameWithoutExt}.avif`,
          originalSize: files[i].size,
          convertedSize: blob.size,
          blob,
          preview: URL.createObjectURL(blob),
        });
      } catch (err: any) {
        console.warn(`Fehler bei ${files[i].name}:`, err.message);
      }
      setProgress(Math.round(((i + 1) / files.length) * 100));
    }
    return results;
  }, [files, quality, targetW, targetH]);

  const handleConvert = useCallback(async () => {
    if (files.length === 0) return;

    setConverting(true);
    setConverted([]);
    setError(null);
    setProgress(0);

    try {
      const API_URL = getApiUrl();
      let results: ConvertedFile[] = [];

      if (isAdmin && connectedAddress) {
        try {
          const formData = new FormData();
          formData.append('adminAddress', connectedAddress);
          formData.append('quality', String(quality));
          if (outWidth.trim()) formData.append('width', outWidth.trim());
          if (outHeight.trim()) formData.append('height', outHeight.trim());
          files.forEach((f) => formData.append('files', f));

          const res = await fetch(`${API_URL}/api/avif/convert`, {
            method: 'POST',
            body: formData,
          });

          if (res.ok) {
            const data = await res.json();
            if (data.files && data.files.length > 0) {
              const valid = data.files.filter((f: any) => f.data && !f.error);
              setProgress(100);
              results = valid.map((f: any) => {
                const binary = atob(f.data);
                const bytes = new Uint8Array(binary.length);
                for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
                const blob = new Blob([bytes], { type: 'image/avif' });
                return {
                  name: f.name,
                  originalSize: f.originalSize,
                  convertedSize: f.convertedSize,
                  blob,
                  preview: URL.createObjectURL(blob),
                };
              });
              if (results.length > 0) {
                console.log(`[AVIF] ${results.length} Bilder via Backend (Sharp) konvertiert`);
              }
            }
          }
        } catch (backendErr) {
          console.warn('[AVIF] Backend nicht verfügbar, Fallback auf Client:', backendErr);
        }
      }

      if (results.length === 0) {
        results = await convertViaClient();
      }

      setConverted(results);
      if (results.length === 0) {
        setError('Keine Bilder konnten konvertiert werden.');
      }
    } catch (err: any) {
      console.error('AVIF Encoder Fehler:', err);
      setError(`Encoder-Fehler: ${err.message}`);
    }

    setConverting(false);
  }, [files, quality, outWidth, outHeight, isAdmin, connectedAddress, convertViaClient]);

  const [zipping, setZipping] = useState(false);

  const downloadAll = useCallback(async () => {
    if (converted.length === 0) return;
    setZipping(true);
    try {
      const zip = new JSZip();
      const folder = zip.folder('avif-converted');
      converted.forEach((file) => {
        folder!.file(file.name, file.blob);
      });
      const zipBlob = await zip.generateAsync({ type: 'blob' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(zipBlob);
      a.download = `avif-converted-q${quality}.zip`;
      a.click();
      URL.revokeObjectURL(a.href);
    } catch (err) {
      console.error('ZIP Fehler:', err);
    }
    setZipping(false);
  }, [converted, quality]);

  const downloadSingle = useCallback((file: ConvertedFile) => {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(file.blob);
    a.download = file.name;
    a.click();
    URL.revokeObjectURL(a.href);
  }, []);

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  const totalOriginal = converted.reduce((sum, f) => sum + f.originalSize, 0);
  const totalConverted = converted.reduce((sum, f) => sum + f.convertedSize, 0);
  const savedPercent = totalOriginal > 0 ? Math.round((1 - totalConverted / totalOriginal) * 100) : 0;

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <div className="text-center">
          <p className="text-2xl font-bold mb-4">Admin Access Required</p>
          <p className="text-gray-400 mb-6">Connect your admin wallet to use this tool.</p>
          <button onClick={() => navigate('/')} className="px-6 py-3 bg-red-600 hover:bg-red-700 rounded-lg font-bold">
            Back to Home
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white p-4 md:p-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <button
            onClick={() => navigate(-1)}
            className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back
          </button>
          <h1 className="text-3xl font-bold">AVIF Converter</h1>
        </div>

        {/* Settings */}
        <div className="bg-gray-900 border border-gray-700 rounded-xl p-6 mb-6">
          <div className="flex flex-col md:flex-row gap-6 items-start md:items-end">
            {/* File Select */}
            <div className="flex-1 w-full">
              <label className="block text-sm font-bold text-gray-400 mb-2">Select Images (PNG, JPG, WebP)</label>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/jpg,image/webp"
                multiple
                onChange={handleFileSelect}
                className="hidden"
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                className="w-full px-4 py-3 bg-gray-800 hover:bg-gray-700 border-2 border-dashed border-gray-600 hover:border-red-500 rounded-lg transition-colors text-center"
              >
                {files.length > 0 ? (
                  <span className="text-white font-semibold">{files.length} images selected</span>
                ) : (
                  <span className="text-gray-400">Click to select images...</span>
                )}
              </button>
            </div>

            {/* Quality Slider */}
            <div className="w-full md:w-64">
              <label className="block text-sm font-bold text-gray-400 mb-2">
                Quality: <span className="text-white text-lg">{quality}%</span>
              </label>
              <input
                type="range"
                min="1"
                max="100"
                value={quality}
                onChange={(e) => setQuality(parseInt(e.target.value))}
                className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-red-600"
              />
              <div className="flex justify-between text-xs text-gray-500 mt-1">
                <span>1 (klein)</span>
                <span>50</span>
                <span>100 (max)</span>
              </div>
            </div>

            {/* Ausgabegrösse (px × px) */}
            <div className="flex flex-col sm:flex-row gap-3 items-end">
              <div>
                <label className="block text-sm font-bold text-gray-400 mb-1">Breite (px)</label>
                <input
                  type="number"
                  min="1"
                  max="10000"
                  placeholder="Original"
                  value={outWidth}
                  onChange={(e) => setOutWidth(e.target.value.replace(/\D/g, '').slice(0, 5))}
                  className="w-24 px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white placeholder-gray-500 focus:border-red-500 focus:ring-1 focus:ring-red-500"
                />
              </div>
              <span className="text-gray-500 hidden sm:inline self-center">×</span>
              <div>
                <label className="block text-sm font-bold text-gray-400 mb-1">Höhe (px)</label>
                <input
                  type="number"
                  min="1"
                  max="10000"
                  placeholder="Original"
                  value={outHeight}
                  onChange={(e) => setOutHeight(e.target.value.replace(/\D/g, '').slice(0, 5))}
                  className="w-24 px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white placeholder-gray-500 focus:border-red-500 focus:ring-1 focus:ring-red-500"
                />
              </div>
            </div>

            {/* Convert Button */}
            <button
              onClick={handleConvert}
              disabled={files.length === 0 || converting}
              className="px-8 py-3 bg-red-600 hover:bg-red-700 disabled:bg-gray-700 disabled:cursor-not-allowed rounded-lg font-bold text-lg transition-colors whitespace-nowrap"
            >
              {converting ? `Converting... ${progress}%` : 'Convert to AVIF'}
            </button>
          </div>

          {/* Progress Bar */}
          {converting && (
            <div className="mt-4 w-full bg-gray-800 rounded-full h-3 overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-red-600 to-orange-500 rounded-full transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
          )}
        </div>

        {/* Error */}
        {error && (
          <div className="bg-red-900/30 border border-red-600 rounded-lg p-4 mb-6 text-red-400">
            {error}
          </div>
        )}

        {/* Results */}
        {converted.length > 0 && (
          <div className="bg-gray-900 border border-gray-700 rounded-xl p-6">
            {/* Summary */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
              <div>
                <h2 className="text-xl font-bold text-white mb-1">
                  {converted.length} images converted
                </h2>
                <p className="text-sm text-gray-400">
                  {formatSize(totalOriginal)} → {formatSize(totalConverted)}{' '}
                  <span className={savedPercent > 0 ? 'text-green-400 font-bold' : 'text-red-400'}>
                    ({savedPercent > 0 ? `-${savedPercent}%` : `+${Math.abs(savedPercent)}%`})
                  </span>
                </p>
              </div>
              <button
                onClick={downloadAll}
                disabled={zipping}
                className="px-6 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 rounded-lg font-bold transition-colors"
              >
                {zipping ? 'Creating ZIP...' : `Download ZIP (${converted.length})`}
              </button>
            </div>

            {/* File List */}
            <div className="space-y-2 max-h-[500px] overflow-y-auto">
              {converted.map((file, i) => {
                const saved = Math.round((1 - file.convertedSize / file.originalSize) * 100);
                return (
                  <div
                    key={i}
                    className="flex items-center gap-4 bg-gray-800 rounded-lg p-3 hover:bg-gray-750 transition-colors"
                  >
                    <img
                      src={file.preview}
                      alt={file.name}
                      className="w-12 h-12 object-cover rounded"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-white truncate">{file.name}</p>
                      <p className="text-xs text-gray-400">
                        {formatSize(file.originalSize)} → {formatSize(file.convertedSize)}{' '}
                        <span className={saved > 0 ? 'text-green-400' : 'text-red-400'}>
                          ({saved > 0 ? `-${saved}%` : `+${Math.abs(saved)}%`})
                        </span>
                      </p>
                    </div>
                    <button
                      onClick={() => downloadSingle(file)}
                      className="px-3 py-1 bg-gray-700 hover:bg-gray-600 rounded text-sm font-semibold transition-colors"
                    >
                      Download
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AvifConverterPage;
