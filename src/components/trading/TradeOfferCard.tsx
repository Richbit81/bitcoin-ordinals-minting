import React, { useState } from 'react';
import { WalletCard } from '../../services/gallery';
import { TradeOffer, acceptTradeOffer } from '../../services/tradingService';
import { useWallet } from '../../contexts/WalletContext';

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
  const hasRequestedCards = offer.requestCards.every((id) =>
    myCards.some((card) => card.inscriptionId === id)
  );

  const handleAccept = async () => {
    if (!canAccept || !hasRequestedCards) return;

    setLoading(true);
    setError(null);

    try {
      await acceptTradeOffer(offer.offerId, walletState.walletType || 'unisat');
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
        <p className="text-sm font-semibold text-gray-400 mb-2">Offers:</p>
        <div className="space-y-1">
          {offer.offerCards.map((id) => (
            <p key={id} className="text-sm text-white">
              • {id.slice(0, 12)}...
            </p>
          ))}
        </div>
      </div>

      {/* Request Cards */}
      <div className="mb-4">
        <p className="text-sm font-semibold text-gray-400 mb-2">Wants:</p>
        <div className="space-y-1">
          {offer.requestCards.map((id) => {
            const hasCard = myCards.some((card) => card.inscriptionId === id);
            return (
              <p
                key={id}
                className={`text-sm ${hasCard ? 'text-green-400' : 'text-red-400'}`}
              >
                • {id.slice(0, 12)}... {hasCard ? '✓' : '✗'}
              </p>
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
        <button className="w-full py-2 px-4 rounded bg-gray-700 hover:bg-gray-600 text-white font-semibold">
          Cancel Offer
        </button>
      )}
    </div>
  );
};



