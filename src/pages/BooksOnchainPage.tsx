import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useWallet } from '../contexts/WalletContext';
import { WalletConnect } from '../components/WalletConnect';
import { FeeRateSelector } from '../components/FeeRateSelector';
import { MintingProgress } from '../components/MintingProgress';
import { MintingStatus } from '../types/wallet';
import { createSingleDelegate } from '../services/collectionMinting';
import { logMinting } from '../services/mintingLog';

const BOOK_ITEMS = [
  {
    id: 'ueber-die-bruecke',
    name: 'Über die Brücke',
    inscriptionId: 'b1e052e02de52586cdbd00539a809beca13ff71ee4bb573ec6b0b84daba68b40i0',
    author: 'Jokica Rasnika',
    priceInSats: 20000,
    description:
      'Über die Brücken is a deeply personal and captivating autobiographical book written in German by a dear friend of mine. It tells a story of life’s journeys—of crossing bridges both real and metaphorical.\n\nWith honesty, courage, and remarkable passion, the author reflects on experiences, challenges, and turning points that shaped her path. Each chapter feels like stepping onto another bridge: moments of change, growth, uncertainty, and discovery.\n\nWritten with emotional depth and authenticity, the book invites readers to walk alongside the author, to feel her struggles, hopes, and determination. It is not only a story about one life, but about the universal experience of moving forward, even when the path ahead is uncertain.',
  },
  {
    id: '1984',
    name: '1984',
    inscriptionId: 'a15f5e3868d900a1304628f0db817e82e7ba857cce6c837cec34ece7e3c221e7i0',
    author: 'George Orwell',
    priceInSats: 5000,
    description:
      '1984 by George Orwell is one of the most influential and prophetic novels ever written. The book portrays a dystopian world ruled by total surveillance, censorship, and absolute control over truth and history. In a society where “Big Brother” is always watching, independent thought itself becomes a crime.\n\nThrough the story of Winston Smith, Orwell explores the dangers of authoritarian power, manipulated information, and the fragile nature of freedom. Decades after its publication, the themes of 1984 remain strikingly relevant.\n\nThis legendary book deserves permanence. A story about truth, control, and freedom belongs on a system that cannot be rewritten.\n\n110% on-chain. Preserved in the blockchain—so the warning Orwell wrote can never be erased.',
  },
  {
    id: 'animal-farm',
    name: 'Animal Farm',
    inscriptionId: '098955a9bc5b884423461d9abce71d6fbf2e6762167926569a7ec67093b89d26i0',
    author: 'George Orwell',
    priceInSats: 5000,
    description:
      'Animal Farm by George Orwell is one of the most powerful political allegories ever written. What begins as a simple fable about animals quickly unfolds into a sharp critique of power, corruption, and the betrayal of ideals.\n\nOn a farm where animals rise up to take control, a vision of equality and freedom is born. But over time, power shifts, truths are distorted, and rules are rewritten-until liberation turns into oppression.\n\nOrwell exposes how easily revolutions can be corrupted and how language itself becomes a tool of control. The chilling realization-“All animals are equal, but some animals are more equal than others”-remains as relevant today as ever.\n\nThis story deserves permanence. A warning about power and manipulation belongs on a system that cannot be altered.\n\n110% on-chain. Preserved in the blockchain-so its truth can never be rewritten.',
  },
];

const COLLECTION_NAME = 'Books Onchain';

export const BooksOnchainPage: React.FC = () => {
  const navigate = useNavigate();
  const { walletState } = useWallet();

  const [inscriptionFeeRate, setInscriptionFeeRate] = useState<number>(1);
  const [mintingItemId, setMintingItemId] = useState<string | null>(null);
  const [mintingStatus, setMintingStatus] = useState<MintingStatus | null>(null);
  const [showWalletConnect, setShowWalletConnect] = useState(false);
  const [expandedDescriptions, setExpandedDescriptions] = useState<Record<string, boolean>>({});

  const toggleDescription = (itemId: string) => {
    setExpandedDescriptions((prev) => ({
      ...prev,
      [itemId]: !prev[itemId],
    }));
  };

  const handleMint = async (item: (typeof BOOK_ITEMS)[number]) => {
    if (!walletState.connected || !walletState.accounts[0]) {
      setShowWalletConnect(true);
      return;
    }

    const userAddress = walletState.accounts[0].address;
    setMintingItemId(item.id);
    setMintingStatus({
      progress: 0,
      status: 'processing',
      message: 'Initiating mint...',
    });

    try {
      setMintingStatus((prev) =>
        prev
          ? {
              ...prev,
              progress: 25,
              message: `Creating delegate for "${item.name}"...`,
            }
          : null
      );

      const result = await createSingleDelegate(
        item.inscriptionId,
        item.name,
        userAddress,
        COLLECTION_NAME,
        inscriptionFeeRate,
        walletState.walletType || 'unisat',
        'html',
        item.priceInSats
      );

      setMintingStatus({
        progress: 100,
        status: 'success',
        message: `Successfully minted "${item.name}"!`,
        inscriptionIds: [result.inscriptionId],
        txid: result.txid,
      });
      try {
        await logMinting({
          walletAddress: userAddress,
          packId: 'books-onchain',
          packName: COLLECTION_NAME,
          cards: [
            {
              id: item.id,
              name: item.name,
              inscriptionId: result.inscriptionId,
              rarity: 'common',
            },
          ],
          inscriptionIds: [result.inscriptionId],
          txids: result.txid ? [result.txid] : [],
          paymentTxid: (result as any).paymentTxid || undefined,
        });
      } catch {
        // Keep mint UX successful even when logging endpoint is unavailable.
      }
    } catch (error: any) {
      setMintingStatus({
        progress: 0,
        status: 'error',
        message: error?.message || 'Minting failed. Please try again.',
      });
    } finally {
      setMintingItemId(null);
    }
  };

  return (
    <div className="min-h-screen bg-black text-white relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-b from-blue-950/25 via-black to-indigo-950/10" />

      <div className="relative z-10 container mx-auto px-4 py-8 min-h-screen flex flex-col">
        <div className="mb-6">
          <button
            onClick={() => navigate('/')}
            className="text-gray-400 hover:text-white flex items-center gap-2 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            <span className="text-sm font-semibold">Back to Home</span>
          </button>
        </div>

        <div className="text-center mb-8 max-w-4xl mx-auto">
          <h1 className="text-4xl md:text-6xl font-black tracking-tight mb-4">
            <span className="bg-gradient-to-r from-sky-300 via-indigo-300 to-blue-300 bg-clip-text text-transparent">
              Books Onchain
            </span>
          </h1>
          <p className="text-gray-300 leading-relaxed">
            It&rsquo;s time for more books on Bitcoin. Not just books about Bitcoin-but books that live on Bitcoin.
            <br />
            Fully on-chain. Permanent. Unstoppable.
            <br />
            Written, published, and preserved directly on the blockchain-so that knowledge can&rsquo;t be censored, altered, or lost.
            Every page, every word, secured by the same network that protects the hardest money ever created.
            <br />
            <span className="text-sky-300 font-semibold">110% on-chain. Forever in the chain.</span>
          </p>
        </div>

        <div className="max-w-7xl mx-auto w-full mb-8">
          <div className="mb-4">
            <FeeRateSelector selectedFeeRate={inscriptionFeeRate} onFeeRateChange={setInscriptionFeeRate} />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {BOOK_ITEMS.map((item) => {
              const isMintingThis = mintingItemId === item.id;
              const isExpanded = !!expandedDescriptions[item.id];
              return (
                <div
                  key={item.id}
                  className="bg-black/80 border border-blue-500/30 rounded-xl p-4 backdrop-blur-md hover:border-blue-400 transition-all h-full flex flex-col"
                >
                  <div className="rounded-lg overflow-hidden border border-blue-500/20 bg-gray-900 mb-4 aspect-[4/3]">
                    <iframe
                      src={`https://ordinals.com/content/${item.inscriptionId}`}
                      title={`${item.name} preview`}
                      className="w-full h-full border-0"
                      sandbox="allow-scripts allow-same-origin"
                      loading="lazy"
                    />
                  </div>

                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div>
                      <h2 className="text-xl font-bold">{item.name}</h2>
                      <p className="text-sm text-gray-400">by {item.author}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-blue-300 font-bold">{item.priceInSats.toLocaleString()} sats</p>
                      <p className="text-xs text-gray-500">Delegate mint</p>
                    </div>
                  </div>

                  <p
                    className={`text-sm text-gray-300 whitespace-pre-line mb-2 transition-all ${
                      isExpanded ? '' : 'line-clamp-5 md:line-clamp-none'
                    }`}
                  >
                    {item.description}
                  </p>
                  <button
                    type="button"
                    onClick={() => toggleDescription(item.id)}
                    className="text-xs text-blue-300 hover:text-blue-200 mb-4 md:hidden"
                  >
                    {isExpanded ? 'Show less' : 'Read more'}
                  </button>

                  {mintingStatus && isMintingThis && (
                    <div className="mb-3">
                      <MintingProgress status={mintingStatus} />
                    </div>
                  )}

                  <button
                    onClick={() => handleMint(item)}
                    disabled={mintingItemId !== null}
                    className="w-full py-3 rounded-lg font-bold text-sm transition-all bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 disabled:from-gray-700 disabled:to-gray-700 disabled:cursor-not-allowed mt-auto"
                  >
                    {isMintingThis ? 'Minting...' : `MINT "${item.name}"`}
                  </button>
                </div>
              );
            })}
          </div>
        </div>

        {showWalletConnect && (
          <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
            <div className="bg-black border-2 border-blue-600 rounded-lg max-w-md w-full">
              <div className="flex justify-between items-center p-4 border-b-2 border-blue-600">
                <h2 className="text-xl font-bold text-white">Connect Wallet</h2>
                <button onClick={() => setShowWalletConnect(false)} className="text-gray-400 hover:text-white">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <div className="p-4">
                <WalletConnect onConnected={() => setShowWalletConnect(false)} />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

