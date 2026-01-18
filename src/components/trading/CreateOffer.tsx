import React, { useState, useMemo } from 'react';
import { useWallet } from '../../contexts/WalletContext';
import { WalletCard } from '../../services/gallery';
import { CardSelector } from './CardSelector';
import { createTradeOffer } from '../../services/tradingService';
import { ALL_CARDS } from '../../config/cards';

interface CreateOfferProps {
  myCards: WalletCard[];
  onOfferCreated: () => void;
  loading?: boolean; // ✨ NEU: Loading-State vom Parent
}

export const CreateOffer: React.FC<CreateOfferProps> = ({ myCards, onOfferCreated, loading: parentLoading = false }) => {
  const { walletState } = useWallet();
  const [offerCards, setOfferCards] = useState<string[]>([]);
  const [requestCards, setRequestCards] = useState<string[]>([]);
  const [expiresInDays, setExpiresInDays] = useState(7);
  const [submitting, setSubmitting] = useState(false); // Rename to avoid confusion
  const [error, setError] = useState<string | null>(null);

  const handleCardToggle = (
    inscriptionId: string,
    isOffer: boolean
  ) => {
    if (isOffer) {
      setOfferCards((prev) =>
        prev.includes(inscriptionId)
          ? prev.filter((id) => id !== inscriptionId)
          : [...prev, inscriptionId]
      );
    } else {
      setRequestCards((prev) =>
        prev.includes(inscriptionId)
          ? prev.filter((id) => id !== inscriptionId)
          : [...prev, inscriptionId]
      );
    }
  };

  const handleCreateOffer = async () => {
    if (!walletState.accounts[0]?.address) {
      setError('Wallet not connected');
      return;
    }

    if (offerCards.length === 0) {
      setError('Please select at least one card to offer');
      return;
    }

    if (requestCards.length === 0) {
      setError('Please select at least one card you want');
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const expiresAt = Math.floor(Date.now() / 1000) + expiresInDays * 24 * 60 * 60;

      await createTradeOffer({
        maker: walletState.accounts[0].address,
        offerCards,
        requestCards,
        expiresAt,
        walletType: walletState.walletType || 'unisat',
      });

      // Reset form
      setOfferCards([]);
      setRequestCards([]);
      setExpiresInDays(7);
      
      // Reload cards
      onOfferCreated();
      
      alert('Trade offer created successfully!');
    } catch (err: any) {
      setError(err.message || 'Failed to create offer');
    } finally {
      setSubmitting(false);
    }
  };

  // Filter out cards that are already selected in the other side
  const availableForOffer = myCards.filter(
    (card) => !requestCards.includes(card.inscriptionId)
  );

  // For "You Want", show all available cards from the collection (not user's cards)
  // Each card should appear only once (by name + rarity combination)
  const availableForRequest = useMemo(() => {
    // Convert ALL_CARDS to WalletCard format for display
    const allAvailableCards: WalletCard[] = ALL_CARDS.map(card => ({
      name: card.name,
      rarity: card.rarity,
      inscriptionId: card.inscriptionId, // Use the inscriptionId from config as identifier
      originalInscriptionId: card.inscriptionId,
      mintedAt: 0,
      packName: 'Collection',
      cardType: card.cardType,
      effect: card.effect,
      svgIcon: card.svgIcon,
    }));

    // Remove duplicates: keep only unique combinations of name + rarity
    const uniqueCards = new Map<string, WalletCard>();
    allAvailableCards.forEach(card => {
      const key = `${card.name}-${card.rarity}`;
      if (!uniqueCards.has(key)) {
        uniqueCards.set(key, card);
      }
    });

    return Array.from(uniqueCards.values());
  }, []);

  return (
    <div className="space-y-6">
      {/* Split Screen Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: You Give */}
        <CardSelector
          cards={availableForOffer}
          selectedCards={offerCards}
          onCardToggle={(id) => handleCardToggle(id, true)}
          title="You Give"
          maxCards={10}
          loading={parentLoading}
        />

        {/* Right: You Want */}
        <CardSelector
          cards={availableForRequest}
          selectedCards={requestCards}
          onCardToggle={(id) => handleCardToggle(id, false)}
          title="You Want"
          maxCards={10}
        />
      </div>

      {/* Summary */}
      {(offerCards.length > 0 || requestCards.length > 0) && (
        <div className="bg-gray-900 border-2 border-red-600 rounded-lg p-4">
          <h3 className="text-lg font-bold mb-3">Offer Summary</h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-gray-400 mb-2">You Give:</p>
              <div className="space-y-1">
                {offerCards.map((id) => {
                  const card = myCards.find((c) => c.inscriptionId === id);
                  return (
                    <p key={id} className="text-sm text-white">
                      • {card?.name || id.slice(0, 8)}...
                    </p>
                  );
                })}
              </div>
            </div>
            <div>
              <p className="text-sm text-gray-400 mb-2">You Want:</p>
              <div className="space-y-1">
                {requestCards.map((originalId) => {
                  // Finde die Karte in ALL_CARDS basierend auf der Original-ID
                  const card = availableForRequest.find((c) => c.inscriptionId === originalId);
                  return (
                    <p key={originalId} className="text-sm text-white">
                      • {card?.name || originalId.slice(0, 8)}...
                    </p>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Expiration */}
      <div className="bg-gray-900 border border-gray-700 rounded-lg p-4">
        <label className="block text-sm font-semibold mb-2">
          Offer expires in (days):
        </label>
        <input
          type="number"
          min="1"
          max="30"
          value={expiresInDays}
          onChange={(e) => setExpiresInDays(parseInt(e.target.value) || 7)}
          className="bg-black border border-gray-600 rounded px-3 py-2 text-white w-32"
        />
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-900 border-2 border-red-600 rounded-lg p-4">
          <p className="text-red-200">{error}</p>
        </div>
      )}

      {/* Create Button */}
      <button
        onClick={handleCreateOffer}
        disabled={submitting || offerCards.length === 0 || requestCards.length === 0}
        className="w-full bg-red-600 hover:bg-red-700 disabled:bg-gray-700 disabled:cursor-not-allowed text-white font-bold py-3 px-6 rounded-lg transition"
      >
        {submitting ? 'Creating Offer...' : 'Create Trade Offer'}
      </button>
    </div>
  );
};



