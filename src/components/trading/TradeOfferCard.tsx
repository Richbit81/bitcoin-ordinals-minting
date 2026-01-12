import React, { useState } from 'react';
import { WalletCard } from '../../services/gallery';
import { TradeOffer, acceptTradeOffer, cancelTradeOffer } from '../../services/tradingService';
import { useWallet } from '../../contexts/WalletContext';
import { getCardImageUrl } from '../../game/cardImageService';

interface TradeOfferCardProps {
  offer: TradeOffer;
  myCards: WalletCard[];
  onOfferAccepted: () => void;
}

export const TradeOfferCard: React.FC<TradeOfferCardProps> = ({
  offer,
  myCards,
  onOfferAccepted,
}) => {
  const { walletState } = useWallet();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isMyOffer = walletState.accounts[0]?.address === offer.maker;
  const canAccept = !isMyOffer && offer.status === 'active';
  
  // Check if I have all requested cards
  // requestCards enthält Original-Inskription-IDs aus ALL_CARDS
  // Wir prüfen, ob der Taker Delegates hat, deren originalInscriptionId mit den requestCards übereinstimmt
  const hasRequestedCards = offer.requestCards.every((requestedOriginalId) =>
    myCards.some((card) => card.originalInscriptionId === requestedOriginalId)
  );

  const handleAccept = async () => {
    if (!canAccept || !hasRequestedCards || !walletState.accounts[0]?.address) return;

    setLoading(true);
    setError(null);

    try {
      await acceptTradeOffer(
        offer.offerId,
        walletState.accounts[0].address,
        walletState.walletType || 'unisat'
      );
      onOfferAccepted();
      alert('Trade offer accepted! Transaction pending...');
    } catch (err: any) {
      setError(err.message || 'Failed to accept offer');
    } finally {
      setLoading(false);
    }
  };

  const expiresDate = new Date(offer.expiresAt * 1000);
  const isExpired = Date.now() > expiresDate.getTime();

  return (
    <div className="bg-gray-900 border-2 border-red-600 rounded-lg p-4">
      <div className="flex justify-between items-start mb-4">
        <div>
          <h3 className="text-lg font-bold">
            {isMyOffer ? 'My Offer' : 'Trade Offer'}
          </h3>
          <p className="text-xs text-gray-400 font-mono">
            {offer.maker.slice(0, 8)}...{offer.maker.slice(-6)}
          </p>
        </div>
        <div className="text-right">
          <span
            className={`text-xs px-2 py-1 rounded ${
              offer.status === 'active' && !isExpired
                ? 'bg-green-900 text-green-200'
                : 'bg-gray-700 text-gray-300'
            }`}
          >
            {isExpired ? 'Expired' : offer.status}
          </span>
        </div>
      </div>

      {/* Offer Cards */}
      <div className="mb-4">
        <p className="text-sm font-semibold text-gray-400 mb-2">Offers ({offer.offerCards.length}):</p>
        <div className="grid grid-cols-3 gap-2">
          {offer.offerCards.map((id) => {
            const card = myCards.find((c) => c.inscriptionId === id);
            const imageId = card?.originalInscriptionId || id;
            return (
              <div key={id} className="relative">
                <img
                  src={getCardImageUrl(imageId)}
                  alt={card?.name || id.slice(0, 8)}
                  className="w-full aspect-square object-contain bg-gray-800 rounded border border-gray-700"
                  onError={(e) => {
                    e.currentTarget.style.display = 'none';
                    const fallback = e.currentTarget.nextElementSibling as HTMLElement;
                    if (fallback) fallback.style.display = 'flex';
                  }}
                />
                <div className="hidden w-full aspect-square items-center justify-center bg-gray-800 rounded border border-gray-700 text-xs text-gray-500">
                  {id.slice(0, 8)}...
                </div>
                {card?.name && (
                  <p className="text-xs text-gray-400 mt-1 truncate" title={card.name}>
                    {card.name}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Request Cards */}
      <div className="mb-4">
        <p className="text-sm font-semibold text-gray-400 mb-2">Wants ({offer.requestCards.length}):</p>
        <div className="grid grid-cols-3 gap-2">
          {offer.requestCards.map((requestedOriginalId) => {
            // Prüfe ob der Taker einen Delegate hat, dessen originalInscriptionId mit der gewünschten Original-ID übereinstimmt
            const hasCard = myCards.some((card) => card.originalInscriptionId === requestedOriginalId);
            const card = myCards.find((c) => c.originalInscriptionId === requestedOriginalId);
            const imageId = requestedOriginalId; // Verwende die Original-ID für das Bild
            return (
              <div key={id} className="relative">
                <div className={`relative ${hasCard ? 'ring-2 ring-green-500' : 'ring-2 ring-red-500'}`}>
                  <img
                    src={getCardImageUrl(imageId)}
                    alt={card?.name || id.slice(0, 8)}
                    className="w-full aspect-square object-contain bg-gray-800 rounded border border-gray-700"
                    onError={(e) => {
                      e.currentTarget.style.display = 'none';
                      const fallback = e.currentTarget.nextElementSibling as HTMLElement;
                      if (fallback) fallback.style.display = 'flex';
                    }}
                  />
                  <div className="hidden w-full aspect-square items-center justify-center bg-gray-800 rounded border border-gray-700 text-xs text-gray-500">
                    {id.slice(0, 8)}...
                  </div>
                  {hasCard && (
                    <div className="absolute top-1 right-1 bg-green-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs font-bold">
                      ✓
                    </div>
                  )}
                </div>
                {card?.name && (
                  <p className={`text-xs mt-1 truncate ${hasCard ? 'text-green-400' : 'text-red-400'}`} title={card.name}>
                    {card.name}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Expires */}
      <p className="text-xs text-gray-500 mb-4">
        Expires: {expiresDate.toLocaleDateString()}
      </p>

      {/* Error */}
      {error && (
        <div className="mb-4 bg-red-900 border border-red-600 rounded p-2">
          <p className="text-xs text-red-200">{error}</p>
        </div>
      )}

      {/* Actions */}
      {canAccept && (
        <button
          onClick={handleAccept}
          disabled={loading || !hasRequestedCards}
          className={`w-full py-2 px-4 rounded font-semibold transition ${
            hasRequestedCards
              ? 'bg-red-600 hover:bg-red-700 text-white'
              : 'bg-gray-700 text-gray-400 cursor-not-allowed'
          }`}
        >
          {loading
            ? 'Processing...'
            : hasRequestedCards
            ? 'Accept Offer'
            : 'Missing Cards'}
        </button>
      )}

      {isMyOffer && offer.status === 'active' && (
        <button 
          onClick={async () => {
            if (!confirm('Are you sure you want to cancel this trade offer?')) return;
            setLoading(true);
            try {
              await cancelTradeOffer(offer.offerId);
              onOfferAccepted(); // Reload offers
              alert('Trade offer cancelled');
            } catch (err: any) {
              setError(err.message || 'Failed to cancel offer');
            } finally {
              setLoading(false);
            }
          }}
          disabled={loading}
          className="w-full py-2 px-4 rounded bg-gray-700 hover:bg-gray-600 disabled:bg-gray-800 disabled:cursor-not-allowed text-white font-semibold transition"
        >
          {loading ? 'Cancelling...' : 'Cancel Offer'}
        </button>
      )}
    </div>
  );
};



