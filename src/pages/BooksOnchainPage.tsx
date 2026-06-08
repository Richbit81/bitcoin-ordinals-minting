import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useWallet } from '../contexts/WalletContext';
import { WalletConnect } from '../components/WalletConnect';
import { FeeRateSelector } from '../components/FeeRateSelector';
import { MintingProgress } from '../components/MintingProgress';
import { MintingStatus } from '../types/wallet';
import { createSingleDelegate } from '../services/collectionMinting';
import { logMinting } from '../services/mintingLog';
import { useUnisatTaproot } from '../hooks/useUnisatTaproot';

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
  {
    id: 'we',
    name: 'WE',
    inscriptionId: '01807f4e1ca904d2945e6403d3c82379900cb2c155970fa99b1bd0fafe41e907i0',
    author: 'Yevgeny Zamyatin',
    priceInSats: 5000,
    description:
      'The story is set in a totalitarian society called the "One State," where people are known by numbers and live under strict mathematical rules. Individuality, emotions, and freedom are suppressed.\n\nThe protagonist, D-503, is an engineer who records his thoughts in a journal while working on a spaceship. When he meets the mysterious I-330, his worldview begins to change, and he starts questioning the system.\n\nMain themes:\n\nSurveillance and control\nLoss of individuality\nReason vs. emotion\nFreedom vs. security',
  },
  {
    id: 'my-inventions',
    name: 'My Inventions',
    inscriptionId: 'b62ac66fbdefc3869d017ba9b89032d34724b7ce2091f62f7c3a4d27c77f8a78i0',
    author: 'Nikola Tesla',
    priceInSats: 5000,
    description:
      'My Inventions is an autobiographical series of essays in which Nikola Tesla recounts his life, ideas, and scientific achievements. He describes his childhood, his remarkable memory and imagination, and the development of his inventions, especially in electricity and wireless energy. The book gives insight into his creative process, his vision for the future, and his struggles as an inventor. It is both a personal story and a reflection on innovation, genius, and perseverance.',
  },
  {
    id: 'brave-new-world',
    name: 'Brave New World',
    inscriptionId: '4a2d838dba141d2261957e1f809652b001486c1f8bbc0362262486472abf6d36i0',
    author: 'Aldous Huxley',
    priceInSats: 5000,
    description:
      'Brave New World by Aldous Huxley is a dystopian novel about a future society where people are controlled through technology, conditioning, and a happiness drug called soma. It explores the loss of individuality and freedom in a world focused on stability and pleasure.',
  },
  {
    id: 'doors-of-perception',
    name: 'The Doors of Perception',
    inscriptionId: '86babe5628d71ab5224607b7f052ec253776ece0c3b9f7b97002074b423f886ei0',
    author: 'Aldous Huxley',
    priceInSats: 5000,
    description:
      'If the doors of perception were cleansed everything would appear to man as it is, infinite. —William Blake\n\nThe Doors of Perception by Aldous Huxley is a landmark essay on consciousness, psychedelic experience, and the limits of ordinary perception. Huxley recounts his experiment with mescalin—the active principle of peyote—and reflects on how altered states can reveal beauty, meaning, and mystery that everyday awareness filters out.\n\nThe German pharmacologist Louis Lewin published the first systematic study of the cactus, to which his own name was subsequently given. Anhalonium lewinii was new to science. To primitive religion and the Indians of Mexico and the American Southwest it was a friend of immemorially long standing. Indeed, it was much more than a friend. In the words of one of the early Spanish visitors to the New World, "they eat a root which they call peyote, and which they venerate as though it were a deity."\n\nWhy they should have venerated it as a deity became apparent when such eminent psychologists as Jaensch, Havelock Ellis and Weir Mitchell began their experiments with mescalin, the active principle of peyote.\n\n110% on-chain. Preserved in the blockchain—so Huxley\'s exploration of mind and perception can never be erased.',
  },
  {
    id: 'heaven-and-hell',
    name: 'Heaven & Hell',
    inscriptionId: '40ff998144622cf5833657b15b1177a5a08b9887219b20d8a58c875c40d11249i0',
    author: 'Aldous Huxley',
    priceInSats: 5000,
    description:
      'Heaven and Hell by Aldous Huxley is a philosophical essay and the companion piece to The Doors of Perception. It explores visionary experience—the inner heavens and hells of the mind—and how light, color, art, and altered states can open the way to other regions of consciousness.',
  },
  {
    id: 'fahrenheit-451',
    name: 'Fahrenheit 451',
    inscriptionId: '6869b0c29206fdfc4cd5866571f073dd43903867120dc02368cd268ba18c69d4i0',
    author: 'Ray Bradbury',
    priceInSats: 5000,
    description:
      'Fahrenheit 451 is a dystopian novel by Ray Bradbury about a future society where books are banned and firemen burn them. The story follows Guy Montag, a fireman who begins to question the system and the value of knowledge. As he discovers the power of books and free thinking, he rebels against censorship and control.',
  },
  {
    id: 'alice-in-wonderland',
    name: 'Alice in Wonderland',
    inscriptionId: '9af566c7ca1c941242f9b69091cce4553f08458aa5bb8dfe337071349cfe1252i0',
    author: 'Lewis Carroll',
    priceInSats: 5000,
    description:
      'Alice’s Adventures in Wonderland by Lewis Carroll is one of the most beloved and imaginative stories ever written. When a curious young girl follows a white rabbit down a rabbit hole, she tumbles into a dreamlike world where logic bends, time misbehaves, and nothing is quite what it seems.\n\nAlong the way she meets the Cheshire Cat, the Mad Hatter, the March Hare, the Caterpillar, and the fearsome Queen of Hearts — each stranger than the last. Through wordplay, riddles, and surreal encounters, Carroll crafted a tale that feels like a dream and reads like a puzzle.\n\nBeneath the whimsy lies a sharp reflection on identity, growing up, and the strange rules adults invent. More than a children’s book, Wonderland is a timeless invitation to question reality and embrace the absurd.\n\nA story this iconic deserves permanence. 110% on-chain — preserved in the blockchain, so Wonderland can never fade.',
  },
  {
    id: 'the-machine-stops',
    name: 'The Machine Stops',
    inscriptionId: 'e6bbdbfe518ae6b33e3e4d86bf9bb6f461c704b709bf7a2a1315957d209e8556i0',
    author: 'E. M. Forster',
    priceInSats: 5000,
    description:
      'The Machine Stops by E. M. Forster, published in 1909, is one of the most prophetic short stories ever written. It imagines a future where humanity lives underground in isolated cells, every need supplied by an omnipotent global Machine. People communicate only through screens, never meet face to face, and have come to worship the Machine that sustains them.\n\nWhen Kuno, a young man who still longs for the surface and direct human contact, tries to convince his mother Vashti that something is deeply wrong, the cracks in the system begin to show. As the Machine slowly falters, the civilization built upon it faces the unthinkable: a world without it.\n\nMore than a century before the internet, video calls, and algorithmic dependence, Forster anticipated a society shaped by technology, comfort, and the quiet erosion of being human. A haunting parable about progress, isolation, and what we forfeit when we let machines think — and live — for us.\n\nA visionary text this timeless deserves permanence. 110% on-chain — preserved in the blockchain, so the warning never fades.',
  },
  {
    id: 'flatland',
    name: 'Flatland',
    inscriptionId: '9757db415c885c194330116d3ea4ee88f41bc766d98f0fa04a0b4e8da6f46fcei0',
    author: 'Edwin A. Abbott',
    priceInSats: 5000,
    description:
      'Flatland takes place in a two-dimensional world where geometric shapes represent people. The narrator — a square — discovers the existence of a third dimension and begins questioning the limits of reality. The book combines mathematics, philosophy, social satire, and early science fiction in a remarkably original way',
  },
  {
    id: 'frankenstein',
    name: 'Frankenstein',
    inscriptionId: '5192400fc728aca8700b6d598119b0cf77c6842695764b878f282f061ff09511i0',
    author: 'Mary Shelley',
    priceInSats: 5000,
    description:
      'Frankenstein is a famous Gothic novel written by Mary Shelley.\n\nThe story follows the young scientist Victor Frankenstein, who creates a living creature from dead body parts. After bringing it to life, he becomes horrified by his creation and abandons it. The lonely creature suffers from rejection and eventually seeks revenge.\n\nThe novel explores themes such as responsibility, the dangers of uncontrolled science, and the effects of isolation.',
  },
  {
    id: 'a-voyage-to-arcturus',
    name: 'A Voyage to Arcturus',
    inscriptionId: '4372343f26d51d35343a6df4f3eae8e20b662f20b16376e3544128b18295f520i0',
    author: 'David Lindsay',
    priceInSats: 5000,
    description:
      'A Voyage to Arcturus by David Lindsay, published in 1920, is one of the most original and visionary works of philosophical fantasy ever written. It follows Maskull on an interplanetary journey to Tormance, a strange world orbiting the double star Arcturus, where every landscape, creature, and new sense he encounters confronts him with a different vision of truth, will, and illusion.\n\nAs Maskull travels across this shifting realm, growing new organs of perception and meeting beings who embody rival philosophies, the novel becomes a metaphysical quest into the nature of reality, pleasure, pain, and the divine.\n\nA profound influence on writers from C. S. Lewis to many later visionaries, this strange and uncompromising book is a landmark of imaginative literature.\n\n110% on-chain — preserved in the blockchain, so Lindsay\'s voyage can never fade.',
  },
];

const COLLECTION_NAME = 'Books Onchain';

async function requestFullscreenElement(el: HTMLElement): Promise<void> {
  const anyEl = el as HTMLElement & {
    webkitRequestFullscreen?: () => Promise<void> | void;
    mozRequestFullScreen?: () => Promise<void> | void;
    msRequestFullscreen?: () => Promise<void> | void;
  };
  if (el.requestFullscreen) await el.requestFullscreen();
  else if (anyEl.webkitRequestFullscreen) await Promise.resolve(anyEl.webkitRequestFullscreen());
  else if (anyEl.mozRequestFullScreen) await Promise.resolve(anyEl.mozRequestFullScreen());
  else if (anyEl.msRequestFullscreen) await Promise.resolve(anyEl.msRequestFullscreen());
}

async function exitDocumentFullscreen(): Promise<void> {
  const doc = document as Document & {
    webkitExitFullscreen?: () => Promise<void> | void;
    mozCancelFullScreen?: () => Promise<void> | void;
    msExitFullscreen?: () => Promise<void> | void;
  };
  if (document.exitFullscreen) await document.exitFullscreen().catch(() => {});
  else if (doc.webkitExitFullscreen) await Promise.resolve(doc.webkitExitFullscreen());
  else if (doc.mozCancelFullScreen) await Promise.resolve(doc.mozCancelFullScreen());
  else if (doc.msExitFullscreen) await Promise.resolve(doc.msExitFullscreen());
}

export const BooksOnchainPage: React.FC = () => {
  const navigate = useNavigate();
  const { walletState } = useWallet();

  const [inscriptionFeeRate, setInscriptionFeeRate] = useState<number>(1);
  const [mintingItemId, setMintingItemId] = useState<string | null>(null);
  const [mintingStatus, setMintingStatus] = useState<MintingStatus | null>(null);
  const [showWalletConnect, setShowWalletConnect] = useState(false);
  const [expandedDescriptions, setExpandedDescriptions] = useState<Record<string, boolean>>({});
  const [tryFullscreenItemId, setTryFullscreenItemId] = useState<string | null>(null);
  const fullscreenShellRef = useRef<HTMLDivElement | null>(null);
  const { taprootOverride, handleTaprootChange, resolveReceiveAddress } = useUnisatTaproot();

  const tryItem = tryFullscreenItemId ? BOOK_ITEMS.find((b) => b.id === tryFullscreenItemId) : null;

  const closeTryFullscreen = useCallback(async () => {
    await exitDocumentFullscreen().catch(() => {});
    setTryFullscreenItemId(null);
  }, []);

  useLayoutEffect(() => {
    if (!tryFullscreenItemId || !fullscreenShellRef.current) return;
    const el = fullscreenShellRef.current;
    void requestFullscreenElement(el).catch(() => {
      /* still usable windowed if fullscreen denied */
    });
  }, [tryFullscreenItemId]);

  useEffect(() => {
    if (!tryFullscreenItemId) return;
    const onFsChange = () => {
      const fsEl =
        document.fullscreenElement ||
        (document as Document & { webkitFullscreenElement?: Element | null }).webkitFullscreenElement ||
        (document as Document & { mozFullScreenElement?: Element | null }).mozFullScreenElement ||
        (document as Document & { msFullscreenElement?: Element | null }).msFullscreenElement;
      if (!fsEl) setTryFullscreenItemId(null);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') void closeTryFullscreen();
    };
    document.addEventListener('fullscreenchange', onFsChange);
    document.addEventListener('webkitfullscreenchange', onFsChange as EventListener);
    document.addEventListener('mozfullscreenchange', onFsChange as EventListener);
    document.addEventListener('MSFullscreenChange', onFsChange as EventListener);
    window.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('fullscreenchange', onFsChange);
      document.removeEventListener('webkitfullscreenchange', onFsChange as EventListener);
      document.removeEventListener('mozfullscreenchange', onFsChange as EventListener);
      document.removeEventListener('MSFullscreenChange', onFsChange as EventListener);
      window.removeEventListener('keydown', onKey);
    };
  }, [tryFullscreenItemId, closeTryFullscreen]);

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

    const { address: userAddress, error: taprootError } = await resolveReceiveAddress(walletState);
    if (taprootError) {
      setMintingStatus({ progress: 0, status: 'error', message: taprootError });
      return;
    }

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
          {walletState.connected && walletState.walletType === 'unisat' && !walletState.accounts?.[0]?.address?.startsWith('bc1p') && (
            <div className="mb-4 p-3 rounded-lg bg-gray-800/80 border border-orange-600/40 max-w-lg">
              <label className="block text-xs text-orange-300 mb-1 font-semibold">
                Taproot-Adresse für Inscription-Empfang (bc1p...)
              </label>
              <input
                type="text"
                value={taprootOverride}
                onChange={(e) => handleTaprootChange(e.target.value)}
                placeholder="bc1p..."
                className="w-full px-3 py-2 rounded bg-gray-900 border border-gray-600 text-white text-sm font-mono placeholder-gray-500 focus:border-orange-500 focus:outline-none"
              />
              <p className="text-[10px] text-gray-400 mt-1">
                Kopiere deine Taproot-Adresse aus UniSat (Settings → Address Type → Taproot → Adresse kopieren).
              </p>
            </div>
          )}
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

                  <div className="mt-auto grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setTryFullscreenItemId(item.id)}
                      className="py-3 rounded-lg font-bold text-sm transition-all border border-blue-500/50 bg-black/60 text-sky-200 hover:bg-blue-950/60 hover:border-blue-400"
                    >
                      Try
                    </button>
                    <button
                      type="button"
                      onClick={() => handleMint(item)}
                      disabled={mintingItemId !== null}
                      className="py-3 rounded-lg font-bold text-sm transition-all bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 disabled:from-gray-700 disabled:to-gray-700 disabled:cursor-not-allowed"
                    >
                      {isMintingThis ? 'Minting...' : `MINT`}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {tryItem && (
          <div
            ref={fullscreenShellRef}
            className="fixed inset-0 z-[100] flex flex-col bg-black"
            role="dialog"
            aria-modal="true"
            aria-label={`Preview ${tryItem.name}`}
          >
            <div className="flex shrink-0 items-center justify-between gap-3 border-b border-gray-700 bg-black/95 px-4 py-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-white">{tryItem.name}</p>
                <p className="truncate text-xs text-gray-400">{tryItem.author}</p>
              </div>
              <button
                type="button"
                onClick={() => void closeTryFullscreen()}
                className="shrink-0 rounded-lg border border-gray-600 px-4 py-2 text-sm font-semibold text-white hover:bg-gray-800"
              >
                Close
              </button>
            </div>
            <iframe
              src={`https://ordinals.com/content/${tryItem.inscriptionId}`}
              title={`${tryItem.name} full screen`}
              className="min-h-0 flex-1 w-full border-0 bg-black"
              sandbox="allow-scripts allow-same-origin"
              allow="fullscreen"
            />
          </div>
        )}

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

