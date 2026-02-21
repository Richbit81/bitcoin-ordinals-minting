import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useWallet } from '../contexts/WalletContext';
import { FeeRateSelector } from '../components/FeeRateSelector';
import { WalletConnect } from '../components/WalletConnect';
import { MintingProgress } from '../components/MintingProgress';
import { MintingStatus } from '../types/wallet';
import { logMinting } from '../services/mintingLog';
import { mintBadCatsRandom, loadBadCatsCollection } from '../services/badcatsMintService';
import { getOrdinalAddress } from '../utils/wallet';
import { getApiUrl } from '../utils/apiUrl';
import { isAdminAddress } from '../config/admin';

const BADCATS_PRICE_SATS = 10000;
const BADCATS_TOTAL_SUPPLY = 500;
const MINT_ACTIVE = true;
const MINT_PUBLIC = false;
const API_URL = getApiUrl();

const COMIC_FONT_LINK = 'https://fonts.googleapis.com/css2?family=Creepster&family=Bangers&display=swap';

const FREE_MINT_INSCRIPTION_IDS = [
  '334a6ae4a4a12092e154aa5a3266db96bff335e991da3d98c6bbfd8f7b2f0b52i0',
  'daf6404172241ef32c274654c94024f362d8198bef2f92b2220ef9839df5899ci0',
  'af6b57c21b98d341fdca16f076487eebd36507b545199d472b8d293f5d2b2976i0',
  '09bb9d32c9304b2075cecc09901b04f0e110f5fc90d15954826ccb6d6a0f2e0di0',
  '4625bdbd462827f23d4841d7894b412fbf71ba9d214aaf1b40e634d517f84b5bi0',
  '913a91e6a896a124f018e8ff30a4f4b387bd5b63157b5fe515184c6290703b37i0',
  'c33fd71fdfe37b1073e698c66b1d3f28129a53073c246398d45af0ab35d7feb6i0',
  '14361a5abe0e77e9248a5563bfb7310abd2f7be322021a427e9f9f8c6a812792i0',
  'b56864422cdab20b53795063184c58c1992bc6043426f5a03a93d8f5deee85cai0',
  '3f21f6e8c23f7f7be63d8eccd9927e9d9fc9be3465ce743b34760cd858e04b5bi0',
  '687c6291150c6308913e68de596b7e2ef4bda6da969e36206a18604c2ff5bdfei0',
  'd5a1b5d40c4e3ff15e1880d164a060dfd94a2287e6f081debaed4a40bf778970i0',
  '7cbe34cd53a34fc5da0ed0935216e3b16203b7e12f1a3352746affede007910bi0',
  'e111848039356de84e4869eb5161a63626ba30f0673e2f78da0b7fd3d7ce6febi0',
  '93b8dab5c410d4aa14992f7dc273de9f9f8d4542fe00998d0a218f017dbc50ddi0',
  '3745e3169e4a167900adfd5a0a2f010b3ae920875d6a023ddf9a9985ff32b4f4i0',
  '63a75531af44437bcc698a64df87f9df04114b6b7d64bf180f66191bc2f75142i0',
  '593bb20307d9730bfd18604a75df53453c42714188e1206ff19f06e9e7a08ae5i0',
  '1d1dc525608b4a6b52dc043ac9e47f7059729ab54be897a3eba06550e065a7dfi0',
  'a331872fd00919e481c47ca7dcd8d2122c24b2d670b46844f7643e5977d6b32ci0',
  '4f1bba352c7dfef734af30d586a4907ae707a3b6a8f4141c57326b2bf46c06b6i0',
  'a8bbecdc874dc06e10cb2c678cc2a094df581a9239eded2b4cf9a3c7582d4aaci0',
  '28da75b1ff84155275273d99b53e4ad7efd54c22ed7085f6b044baaf5ec5e9f1i0',
  'abcfb68391a39150a28eb486ad90814f1814870f3702cf253ca2665d776b6851i0',
  'ddff2a85d8813d485ce4987d00f8748ea888fe49d09d9cd70f493b8ed69ec71ai0',
  '38188d7760b31311c392c0d117524b2bc3f9d15b4c57b9de6c973682c65401dbi0',
  '3edc52a07cc4cddc6c89d3d513cacafe777c5e987da9fb4dd69f4f61161b3818i0',
  '098ef9effde6b1c727a721c38674648dd2bc601371b61a05635cc6a51f444cabi0',
  '1bf2a465d9d760a594ba4606bc56b0355713c189fa8c7242fd1816fbe75fe6f8i0',
  'e0d7497f96531621d6d3eb06542e80ee428b9d838d9400c7f389e7d3d33001e8i0',
  '602b8bf13b4e3fa64e04158eddc1d629cdadf2864d27fbd8b492d7f82df7e423i0',
  '33ed2b4fcdcf07a87bebd270c7a313a92dc57a539cbf442be7f5989e5e6ad040i0',
  'b5ac328681b2e4e46f8e3545983db24430b277d44886bc75dfade0fb7aab9f91i0',
  '67486e3e2b9fb8c956b28cc34901e7aff473f8e70a373919f96383ec777139f8i0',
  'b139c82bbeb11358984149da063d719ab16e40f1d6b74464450e2e3dbb0d11b0i0',
  'c1fb08c21cbc9430ecc892ab4a3424c407565b1a86045644761cf4c3fce05514i0',
  'dd3045f31256dc61f7d4f4efb4e6a8ee4322179ba623864375f1ed5dfc416f99i0',
  '8a32af184566b2fa0d2eb0ef0c37d6e76358717324db2d95bcd1b57ae6db44b9i0',
  '30402444fa3f59d7a2faebeac7a3c0c7f444eeac269bcb0edca587626781ac94i0',
  'f39e9b580d33f27e38e7a4888249986efeb4d46eee6e5843391d0dfd29ff5452i0',
  'ea51639e8168272dbb19944875975d9cc1b50a9943338eab82b51cc7dfeb0705i0',
  '229032a1a6ebe55f98c9ce1222eeccd3aa2b82bfcf2452876fa4e98406f4f395i0',
  '919c9111770fe4139565b5c76d100aab8096198914ec6fdd81121ede758eb96ci0',
  '6171bc35ef301ed214aa744cb70f003ee95a8e32d8d171462f4c4882905fd986i0',
  '0a53fc9383e8e43fe45558a59a143787f60762f6c4a9b2ed3489140ac5381953i0',
  '11101769ade71a92bb89db6669c62371fc8afe7ddfb0b71913c309e385952b40i0',
  'c4e22a63d9d8b921a770e22f11cbf48fda9413913aa04b57ce3fb06b5bf91bcfi0',
  '9be73d26f96e1938d2aa65dd3ff8da08e6f2cff910e65dce4523f08267ae80f6i0',
  'f75d88bbfb89e2c1cc9c83885f7e741f7f1393188cfed63efc4448e5a6fd8237i0',
  '1d39487b1cdb776142229e731a1d8c471b3a4103c137613b0928a6152de96517i0',
  '796baddaef8665e7145cca34a2d416dfc3c22f22ef308f77acb7755ec63cd2bei0',
  '7f3fc46bb2ff583439dbde1625dc2ebe43b95e32159e905c902c1b342db02b92i0',
  'cd59e6a552162ed2f072a7d598b2589629016f5bff4f0418ae188353f2fa4a2ei0',
  'a68c1559d5b9008c364db10215ce5e4673cf565ecbef45fb52d259a1880e473ci0',
  'c1327cf5dd770698dfff9824d82bdf0138f2bc57040e3c2d4c36f9b300cb73e5i0',
  '17c2b5a1ac947790159f861024c8202e27e10f7cf1c66ffe3e44161557c024d0i0',
  '6d357c1f8a70eedb8a956041e134dae73d7e85799550fb5e93a5eb7bcbd76158i0',
  'f1b83b7bdeeb07e1887380bda1e2a4205f1cbb0abbfeb8392b20f7a606fe793di0',
  '71a855f3159a52bc177347f9a3b11da1af0a9072ddae52ba785ac4c51284404di0',
  '8b725531f98f99bb92d801d8897a42f5bc4f6784856d39a1ffbb82a8032ef9ebi0',
  '047745614b009300b24ab0e216fa3a6adf6370e374ef0a0bd241ac4e51494ebdi0',
  '8070e3afc4ff45e09c09899aa767c48fed04db078107ad96ecbc895acf78d68fi0',
  '51adea41a911086c77db8ed5206f935a8ad1b7aaae5e7e6c0d14bbacc4f86661i0',
  '0c289e976abf18917b5f3fda408c2c6dc398ec6ba8cf9673ebdb19f8b9a7c49fi0',
  'b93d4ff5419c1cf4399720fa0f7c71edf0b7b8d93ca8e9570029b9b755e482cci0',
  'e6c29173ebe6695bb42015098f8fd7db0b2ab4956939513011a4f49312b80f9fi0',
  '835aaf0fa4e2b1150627e601564a4302513747e5594db044bc8f86d9fedf36d4i0',
  '0466dd8e12ab4ef6386d690749d6fbabf29b1b50402e25f1b71314d1c8c9c8aei0',
  'b90fd26873c9518f2d951b3751633581f655d18cb1c3edd323cb4db3311bed20i0',
  '181c7963486981017bcab3d68a9abe89994246f438f6561f2de1f5e63ac7e1f7i0',
  '16fdb2d557f9a702b86df9abc88227b5de0222736f05e336715cb8be7a6b35c4i0',
  '085a0ebde88bfe81745cc800340f488d5e2759d6485e8658c08d3a9c80763c33i0',
  'e071e2786fbf264d7b4e80b47e8f12fb3689efa02ac564e5a1f2f4f0cf252b7fi0',
  '9900c118cfd8979250d8206a1a7a9e9f3b6032bed6eb4e9d0abb21fb052a0114i0',
  'aa1f241ce9278f529cd5ea84b7741eb1445bef8f40c9af7cbc5bad84b87afd80i0',
  '11c1db6f21d8063438e53197deb1db8bb0c44cf15c9c652090180c3588ebc2dbi0',
  '5dad40b2f2a75f06b540ed55f0c46a690b80982a9b24a247cfa6c4fcc5325f7ai0',
  'a80dda2ffa7f608b85389cd11824dba3f46c55533259c1c5aa5ec46dd48697c5i0',
  '8024949b1196412721a04b92908404171ac09e7e541c834521b40f751f2b9018i0',
  'cb9a0f6a13ef8ba6578b2341a2650bbeed841f7ce85603523483f39fb52eab27i0',
  '37ee7667e587b8ef8ae102e2ce060a6b44612d6d8357f86812cee6297605e371i0',
  '32406115bab09daa6bd6542001fe9cb1e738859f10e3fef686870f5f83800498i0',
  '4c77cc000b2514cc37ab83a62f10a0ac6998593f5979a29036df66dda72f9313i0',
  'e93d24c29c6c36d0ba0a55fbf1e162e168f91c71466e10121112418da4ed8835i0',
  'd2be03198edadfbee1996820458be7ecd463e6783983786ec24c0a2f5f848645i0',
  'dcdc58af2fc01161a5d09f1279a35ac061a10fc6e8432ac0e1ae2d6c4c2f9a85i0',
  '259864f5ff4e46f275471f5e02ea8f04a35a8b929027d0e25b7750f7abec9acbi0',
  '143b7c7b303a1ae6c4616971b3504d1ae1c50e196e046227bb38f5ed9ed57d0ei0',
  'baa79d3007c03aa785f501a9fbf15cac57e4bd4b1e1c446ef950c997a4254c9ai0',
  '4bca35634bcb140dd2c4e91fbed7fd4556e5f470e3c7f6cdb4386829209f2194i0',
  '40b86219783f9c373fecac33368a61f673f3eb26a166953b7980905ceca97c03i0',
  '66de514646c9c5d64d7f4ff7dcdfdf123e7207752674be8dddffedc95bc88d16i0',
  '061e4c413e7106e2a501d12eeb3cdccb8be9511f7fc8e138be0b8ddfb098cb7bi0',
  '959d2b93fb0dee939b32908c65f655a06f7a2a8b22180a7c484ebebd4fd66247i0',
  '332f40d642644701e92bcda3077a616e6a4ffb67bc86fe585f9463cdc40a8a93i0',
  '89a46a7213ba0ab9e7de59f3d47a8687e931db1d805672f037aa4455305922e0i0',
  '14c14b76baf21e3aa0e23ed9103c366dc9e2376da43d78e1945b027b8b1adea7i0',
  'b3a9f32962d9c59c25ce96e2f6b1de457b20ec51994b7b40c8d242f02c00c03fi0',
  '1114e2c13a6e83a216556f08b06e36ce31c75aa89ef2fb3d4953ca854ad751fci0',
  '9c98fa0c9ecb2014f197a667ce44c8b9a56be354b2675e627331f76a09d0e6a9i0',
  '671902538ecfe2b75d7f0f46005a7e9b0a6eb73e257f18e914a89a25c24bf9bei0',
  '4b75d075fcf005fdc2ea40418bed213cb5db2f01c2ce528aa59feb1647bbb0a3i0',
  'cf997f1894a1c84e24c890d7f9f73addd7ae6319ff78a9d883f1888b48d1225ci0',
  '8a25674c196ad6ab60905d9144520d1ecc11a05921d89d80794a9be2416d9733i0',
  'ec8f2b13a4b6ee6f8b18c10b005b18a0ebe7e314989b6bf4d1c98569c92ef6fbi0',
  'e7dfb148b6b22d24de0b810f5874ce39e7839dd9e661add9253e27eac7c906c9i0',
  '154e6742cd21a2a09f75ae165075aded221115cfc12f81d955dc96a4cdb78ecfi0',
  'f50af88884ff27327950643f148102a3767d6fbef35c025653886a7f1adab2a4i0',
  'd5d3104f08a62249a306956e6e491ccf5f0521b8679a85a5f4b4b8a698ddaad9i0',
  '414b7d049fd8526e4ecfd80fcc8f928cf2790c2f0e82b6847a9178c6154d676fi0',
  'cd4a6dd5f8926202e36b3f7b9c777ef24ed80020dfcb85e9696f8be9ed339322i0',
];

const STORAGE_KEY_FREE_MINTS_USED = 'badcats_free_mints_used';

function getLocalFreeMintTracker(): Record<string, number> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_FREE_MINTS_USED);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function recordLocalFreeMintUsed(address: string) {
  const tracker = getLocalFreeMintTracker();
  tracker[address] = (tracker[address] || 0) + 1;
  localStorage.setItem(STORAGE_KEY_FREE_MINTS_USED, JSON.stringify(tracker));
}

export const BadCatsPage: React.FC = () => {
  const navigate = useNavigate();
  const { walletState } = useWallet();
  const [collectionReady, setCollectionReady] = useState<boolean | null>(null);
  const [mintCount, setMintCount] = useState(0);
  const [inscriptionFeeRate, setInscriptionFeeRate] = useState<number>(1);
  const [mintingStatus, setMintingStatus] = useState<MintingStatus | null>(null);
  const [isMinting, setIsMinting] = useState(false);
  const [showWalletConnect, setShowWalletConnect] = useState(false);
  const [mintedIndices, setMintedIndices] = useState<number[]>([]);
  const [collectionData, setCollectionData] = useState<any>(null);

  const [freeMintEntitlement, setFreeMintEntitlement] = useState(0);
  const [freeMintUsed, setFreeMintUsed] = useState(0);
  const [checkingEligibility, setCheckingEligibility] = useState(false);

  const comicFont = "'Creepster', cursive";
  const subFont = "'Bangers', cursive";

  useEffect(() => {
    if (!document.querySelector(`link[href="${COMIC_FONT_LINK}"]`)) {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = COMIC_FONT_LINK;
      document.head.appendChild(link);
    }
  }, []);

  useEffect(() => {
    loadBadCatsCollection().then((col) => {
      if (col && col.generated.length > 0) {
        setCollectionReady(true);
        setCollectionData(col);
      } else {
        setCollectionReady(false);
      }
    });
    loadMintCount();
    loadMintedIndices();
  }, []);

  const checkFreeMintEligibility = useCallback(async (address: string) => {
    setCheckingEligibility(true);
    try {
      let inscriptionCount = 0;
      const foundIds: string[] = [];
      try {
        const whitelistSet = new Set(FREE_MINT_INSCRIPTION_IDS);
        const PAGE_SIZE = 100;
        let cursor = 0;
        let total = 0;
        do {
          const res = await fetch(
            `https://open-api.unisat.io/v1/indexer/address/${address}/inscription-data?cursor=${cursor}&size=${PAGE_SIZE}`,
            { headers: { Accept: 'application/json' } }
          );
          if (!res.ok) { console.warn(`[BadCats] API returned ${res.status} at cursor ${cursor}`); break; }
          const json = await res.json();
          if (json.code !== 0) { console.warn(`[BadCats] API error code ${json.code}: ${json.msg}`); break; }
          const data = json.data;
          total = data.total || 0;
          const batch = data.inscription || [];
          for (const i of batch) {
            if (whitelistSet.has(i.inscriptionId)) {
              inscriptionCount++;
              foundIds.push(i.inscriptionId);
            }
          }
          cursor += PAGE_SIZE;
          if (batch.length < PAGE_SIZE) break;
          if (inscriptionCount >= whitelistSet.size) break;
        } while (cursor < total);
        console.log(`[BadCats] Checked ${Math.min(cursor, total)}/${total} inscriptions on ${address}`);
        console.log(`[BadCats] Found ${inscriptionCount} whitelisted:`, foundIds);
      } catch (err) {
        console.warn('[BadCats] Could not check inscription holdings', err);
      }

      let addressBonus = 0;
      try {
        const wlRes = await fetch(`${API_URL}/api/badcats/whitelist-addresses`);
        if (wlRes.ok) {
          const wlData = await wlRes.json();
          const wlAddrs: string[] = wlData.addresses || [];
          if (wlAddrs.some(a => a.toLowerCase() === address.toLowerCase())) {
            addressBonus = 1;
          }
        }
      } catch {
        console.warn('[BadCats] Could not load whitelist addresses');
      }

      const totalEntitlement = inscriptionCount + addressBonus;

      let used = 0;
      try {
        const amRes = await fetch(`${API_URL}/api/badcats/address-mints?address=${encodeURIComponent(address)}`);
        if (amRes.ok) {
          const amData = await amRes.json();
          used = amData.freeMints || 0;
        }
      } catch {
        const tracker = getLocalFreeMintTracker();
        used = tracker[address] || 0;
      }

      setFreeMintEntitlement(totalEntitlement);
      setFreeMintUsed(used);
    } finally {
      setCheckingEligibility(false);
    }
  }, []);

  useEffect(() => {
    if (walletState.connected && walletState.accounts[0]) {
      const addr = getOrdinalAddress(walletState.accounts);
      checkFreeMintEligibility(addr);
    } else {
      setFreeMintEntitlement(0);
      setFreeMintUsed(0);
    }
  }, [walletState.connected, walletState.accounts, checkFreeMintEligibility]);

  const loadMintCount = async () => {
    try {
      const res = await fetch(`${API_URL}/api/badcats/count`);
      if (res.ok) {
        const data = await res.json();
        setMintCount(data.totalMints || 0);
      }
    } catch {
      console.warn('[BadCats] Could not load mint count');
    }
  };

  const loadMintedIndices = async () => {
    try {
      const res = await fetch(`${API_URL}/api/badcats/minted-indices`);
      if (res.ok) {
        const data = await res.json();
        setMintedIndices(data.mintedIndices || []);
      }
    } catch {
      console.warn('[BadCats] Could not load minted indices');
    }
  };

  const freeMintsRemaining = Math.max(0, freeMintEntitlement - freeMintUsed);
  const isFreeForUser = freeMintsRemaining > 0;
  const isSoldOut = mintCount >= BADCATS_TOTAL_SUPPLY;
  const progressPercent = Math.min((mintCount / BADCATS_TOTAL_SUPPLY) * 100, 100);

  const handleMint = async () => {
    if (!MINT_ACTIVE) return;
    if (!walletState.connected || !walletState.accounts[0]) {
      setShowWalletConnect(true);
      return;
    }

    const userAddress = getOrdinalAddress(walletState.accounts);
    setIsMinting(true);
    setMintingStatus({ packId: 'badcats', status: 'processing', progress: 10 });

    try {
      setMintingStatus({ packId: 'badcats', status: 'processing', progress: 30 });

      let freshMintedIndices = mintedIndices;
      try {
        const idxRes = await fetch(`${API_URL}/api/badcats/minted-indices`);
        if (idxRes.ok) {
          const idxData = await idxRes.json();
          freshMintedIndices = idxData.mintedIndices || [];
          setMintedIndices(freshMintedIndices);
        }
      } catch { /* fallback */ }

      const result = await mintBadCatsRandom(
        userAddress,
        inscriptionFeeRate,
        walletState.walletType || 'unisat',
        isFreeForUser,
        freshMintedIndices
      );

      try {
        await fetch(`${API_URL}/api/badcats/log`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            walletAddress: userAddress,
            inscriptionId: result.inscriptionId,
            txid: result.txid || null,
            itemName: `BadCats #${result.item.index}`,
            itemIndex: result.item.index,
            priceInSats: isFreeForUser ? 0 : BADCATS_PRICE_SATS,
            paymentTxid: result.paymentTxid || null,
          }),
        });
      } catch (e) {
        console.warn('[BadCats] Log failed:', e);
      }

      try {
        await logMinting({
          walletAddress: userAddress,
          packId: 'badcats',
          packName: 'BadCats',
          cards: [{
            id: `badcats-${result.item.index}`,
            name: `BadCats #${result.item.index}`,
            inscriptionId: result.inscriptionId,
            rarity: 'common',
          }],
          inscriptionIds: [result.inscriptionId],
          txids: result.txid ? [result.txid] : [],
          paymentTxid: result.paymentTxid,
        });
      } catch { /* backup log failed */ }

      try {
        const attributes = result.item.layers.map(layer => ({
          trait_type: layer.traitType,
          value: layer.trait.name,
        }));
        await fetch(`${API_URL}/api/badcats/hashlist`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            inscriptionId: result.inscriptionId,
            itemIndex: result.item.index,
            name: `BadCats #${result.item.index}`,
            attributes,
          }),
        });
      } catch { /* hashlist failed */ }

      if (isFreeForUser) {
        recordLocalFreeMintUsed(userAddress);
        try {
          await fetch(`${API_URL}/api/badcats/free-mint-used`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ address: userAddress }),
          });
        } catch { /* backend tracking failed, localStorage is fallback */ }
        setFreeMintUsed(prev => prev + 1);
      }

      setMintingStatus({
        packId: 'badcats',
        status: 'completed',
        progress: 100,
        inscriptionIds: [result.inscriptionId],
      });
      setMintCount(prev => prev + 1);
      setMintedIndices(prev => [...prev, result.item.index]);
    } catch (error: any) {
      console.error('[BadCats] Mint error:', error);
      setMintingStatus({
        packId: 'badcats',
        status: 'failed',
        progress: 0,
        error: error.message || 'Minting failed',
      });
    } finally {
      setIsMinting(false);
    }
  };

  return (
    <div className="min-h-screen text-white relative overflow-hidden" style={{ background: '#0a0a0a' }}>

      {/* Background image */}
      <div className="absolute inset-0 opacity-20"
        style={{
          backgroundImage: 'url(/images/badcats-bg.png)',
          backgroundSize: 'cover',
          backgroundPosition: 'center top',
          filter: 'blur(2px)',
        }} />

      {/* Dark vignette overlay */}
      <div className="absolute inset-0" style={{
        background: 'radial-gradient(ellipse at center, transparent 30%, rgba(0,0,0,0.85) 100%)',
      }} />

      {/* Scratchy noise texture */}
      <div className="absolute inset-0 opacity-[0.06]" style={{
        backgroundImage: 'radial-gradient(circle, #ff0000 0.5px, transparent 0.5px)',
        backgroundSize: '18px 18px',
      }} />

      <div className="relative z-10 container mx-auto px-4 py-6 min-h-screen flex flex-col">
        {/* Back */}
        <div className="mb-4">
          <button onClick={() => navigate('/')}
            className="text-gray-400 hover:text-red-400 flex items-center gap-2 transition-colors">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            <span className="text-sm font-semibold">Back to Home</span>
          </button>
        </div>

        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-7xl md:text-9xl mb-2"
            style={{
              fontFamily: comicFont,
              color: '#e11d48',
              WebkitTextStroke: '2px #000',
              textShadow: '4px 4px 0 #000, 0 0 20px rgba(225,29,72,0.5), 0 0 60px rgba(225,29,72,0.2)',
              letterSpacing: '0.06em',
            }}>
            BAD CATS
          </h1>
          <p className="text-lg text-gray-300" style={{ fontFamily: subFont, letterSpacing: '0.08em' }}>
            500 Recursive Ordinals on Bitcoin
          </p>
        </div>

        {collectionReady === null ? (
          <div className="text-center py-8" style={{ fontFamily: subFont }}>Loading...</div>
        ) : (
          <>
          <div className="flex flex-col lg:flex-row items-center lg:items-stretch justify-center gap-6 lg:gap-8">
            {/* ====== LEFT: MINT PANEL ====== */}
            <div className="max-w-xl w-full" style={{ transform: 'rotate(-1deg)' }}>
              <div className="bg-[#1a0a0e] border-[3px] border-red-900 rounded-xl p-4 h-full flex flex-col"
                style={{ boxShadow: '5px 5px 0 #7f1d1d' }}>

                <div className="flex flex-col items-center mb-4">
                  <div className="relative mb-3 w-full max-w-[220px] aspect-square bg-black border-[3px] border-red-900 rounded-md overflow-hidden"
                    style={{ boxShadow: '4px 4px 0 #000' }}>
                    <iframe
                      src="https://ordinals.com/content/35ccb1e128e691647258687c53f06a5f3f2078f15770eb0afedcd743524e63bdi0"
                      title="BadCats Preview"
                      className="w-full h-full border-0 pointer-events-none"
                      sandbox="allow-scripts allow-same-origin"
                      scrolling="no"
                    />
                    {!MINT_PUBLIC && (
                      <div className="absolute inset-0 flex items-center justify-center bg-black/50">
                        <span className="text-red-400 text-sm font-bold px-3 py-1 bg-black/80 rounded border border-red-800" style={{ fontFamily: subFont }}>
                          MINT SOON
                        </span>
                      </div>
                    )}
                  </div>

                  <div className="w-full mb-3">
                    <div className="flex justify-between text-xs mb-0.5">
                      <span className="text-gray-400" style={{ fontFamily: subFont }}>Minted</span>
                      <span className="text-red-400 font-bold" style={{ fontFamily: subFont, fontSize: '13px' }}>
                        {mintCount} / {BADCATS_TOTAL_SUPPLY}
                      </span>
                    </div>
                    <div className="w-full bg-black rounded-sm h-3 overflow-hidden border-2 border-red-900"
                      style={{ boxShadow: '2px 2px 0 #000' }}>
                      <div className="h-full transition-all duration-500"
                        style={{
                          width: `${progressPercent}%`,
                          background: 'repeating-linear-gradient(45deg, #e11d48, #e11d48 6px, #be123c 6px, #be123c 12px)',
                        }} />
                    </div>
                    <p className="text-[10px] text-gray-500 mt-0.5 text-center">
                      {BADCATS_TOTAL_SUPPLY - mintCount} remaining
                    </p>
                  </div>

                  <div className="relative bg-[#1c1c1c] text-white rounded-lg px-4 py-2 text-center border-2 border-red-800 w-full"
                    style={{ boxShadow: '3px 3px 0 #000' }}>
                    {walletState.connected && !checkingEligibility && freeMintEntitlement > 0 ? (
                      <>
                        <p className="text-sm text-green-400 font-bold" style={{ fontFamily: subFont }}>
                          {freeMintsRemaining > 0
                            ? `You can mint ${freeMintsRemaining} BadCat${freeMintsRemaining > 1 ? 's' : ''} for FREE!`
                            : 'All free mints used'}
                        </p>
                        <p className="text-[10px] text-gray-500 mt-1">
                          {freeMintUsed} / {freeMintEntitlement} free mints used · then {BADCATS_PRICE_SATS.toLocaleString()} sats
                        </p>
                      </>
                    ) : (
                      <>
                        <p className="text-xl font-bold text-red-400" style={{ fontFamily: comicFont }}>
                          {BADCATS_PRICE_SATS.toLocaleString()} sats
                        </p>
                        <p className="text-[10px] text-gray-500">+ inscription fees</p>
                      </>
                    )}
                  </div>
                </div>

                {walletState.connected && (
                  <div className={`rounded-lg px-3 py-2 mb-3 text-xs border ${
                    freeMintEntitlement > 0
                      ? 'bg-green-950/30 border-green-800/50 text-green-300'
                      : 'bg-gray-900/50 border-gray-700/50 text-gray-400'
                  }`}>
                    {checkingEligibility ? (
                      <p style={{ fontFamily: subFont }}>Checking eligibility...</p>
                    ) : freeMintEntitlement > 0 ? (
                      <p style={{ fontFamily: subFont }}>
                        ✅ You hold {freeMintEntitlement} whitelisted inscription{freeMintEntitlement > 1 ? 's' : ''} →{' '}
                        <strong>{freeMintsRemaining} free mint{freeMintsRemaining !== 1 ? 's' : ''} remaining</strong>
                      </p>
                    ) : (
                      <p style={{ fontFamily: subFont }}>
                        No whitelisted inscriptions found. Price: {BADCATS_PRICE_SATS.toLocaleString()} sats
                      </p>
                    )}
                  </div>
                )}

                <div className="mb-3">
                  <FeeRateSelector selectedFeeRate={inscriptionFeeRate} onFeeRateChange={setInscriptionFeeRate} />
                </div>

                {mintingStatus && (
                  <div className="mb-3">
                    <MintingProgress status={mintingStatus} />
                  </div>
                )}

                <div className="min-h-[44px]">
                  {mintingStatus?.status === 'completed' ? (
                    <div className="text-center">
                      <p className="text-green-400 font-bold mb-3 text-lg" style={{ fontFamily: comicFont }}>
                        MINT SUCCESSFUL!
                      </p>
                      <button onClick={() => setMintingStatus(null)}
                        className="px-5 py-2 rounded-md font-semibold text-sm text-white"
                        style={{ fontFamily: subFont, background: '#e11d48', border: '2px solid #000', boxShadow: '3px 3px 0 #000' }}>
                        MINT ANOTHER!
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={handleMint}
                      disabled={isMinting || !walletState.connected || isSoldOut || (!MINT_PUBLIC && !isAdminAddress(walletState.accounts?.[0]?.address))}
                      className="w-full py-3 disabled:opacity-50 disabled:cursor-not-allowed rounded-md text-lg transition-all duration-200 transform hover:scale-105 hover:-translate-y-0.5 active:scale-95"
                      style={{
                        fontFamily: comicFont,
                        background: isSoldOut ? '#555' : (!MINT_PUBLIC && !isAdminAddress(walletState.accounts?.[0]?.address)) ? '#333' : 'linear-gradient(180deg, #e11d48 0%, #9f1239 100%)',
                        color: '#fff',
                        border: '3px solid #000',
                        boxShadow: '4px 4px 0 #000',
                        letterSpacing: '0.05em',
                      }}>
                      {isSoldOut ? 'SOLD OUT!' : isMinting ? (
                        <span className="flex items-center justify-center gap-2">
                          <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                          </svg>
                          MINTING...
                        </span>
                      ) : (!MINT_PUBLIC && !isAdminAddress(walletState.accounts?.[0]?.address)) ? 'MINT STARTING SOON...' : isFreeForUser ? 'MINT FREE!' : 'MINT RANDOM!'}
                    </button>
                  )}
                </div>

                {!walletState.connected && (
                  <p className="text-center text-gray-400 text-xs mt-3 cursor-pointer hover:text-red-400"
                    onClick={() => setShowWalletConnect(true)} style={{ fontFamily: subFont }}>
                    Connect your wallet to mint
                  </p>
                )}

                <p className="text-[10px] text-gray-500 text-center mt-2">
                  {BADCATS_TOTAL_SUPPLY} unique cats · Taproot (bc1p...)
                </p>
              </div>
            </div>

            {/* ====== RIGHT: DESCRIPTION ====== */}
            <div className="max-w-xl w-full" style={{ transform: 'rotate(0.5deg)' }}>
              <div className="bg-[#1a0a0e] border-[3px] border-red-900 rounded-xl p-5 h-full flex flex-col"
                style={{ boxShadow: '5px 5px 0 #450a0a' }}>

                <h2 className="text-3xl text-red-400 mb-2" style={{
                  fontFamily: comicFont, textShadow: '2px 2px 0 #000',
                }}>BAD CATS</h2>
                <p className="text-sm mb-3" style={{ fontFamily: subFont, color: '#fb7185' }}>
                  Recursive Collection on Bitcoin
                </p>

                <p className="text-gray-300 text-xs leading-relaxed mb-4">
                  <strong className="text-white">BadCats</strong> is a collection of 500 unique recursive SVG ordinals
                  inscribed on the Bitcoin blockchain. Each cat is composed of multiple hand-drawn layers — combining
                  wild personalities, crazy accessories, and devilish charm. Every BadCat is different.
                  Every BadCat is on-chain forever.
                </p>

                {/* Pricing */}
                <div className="bg-black/60 border-2 border-red-900/60 rounded-md p-3 mb-4">
                  <h3 className="text-sm text-red-400 mb-2" style={{ fontFamily: subFont }}>PRICING</h3>
                  <div className="space-y-1.5 text-xs">
                    <div className="flex justify-between items-center">
                      <span className="text-green-400" style={{ fontFamily: subFont }}>Collection Holders</span>
                      <span className="bg-green-600 text-white px-2 py-0.5 rounded-sm text-[10px] font-bold"
                        style={{ fontFamily: subFont }}>FREE</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-gray-500" style={{ fontFamily: subFont }}>1 free mint per ordinal held</span>
                      <span className="text-gray-500 text-[10px]">from Bone Cat & Halloween Bad Cats</span>
                    </div>
                    <div className="border-t border-red-900/40 my-1" />
                    <div className="flex justify-between items-center">
                      <span className="text-gray-300" style={{ fontFamily: subFont }}>Public Mint</span>
                      <span className="text-red-400 font-bold" style={{ fontFamily: subFont }}>
                        {BADCATS_PRICE_SATS.toLocaleString()} sats
                      </span>
                    </div>
                  </div>
                </div>

                {/* Free Mint Collections */}
                <h3 className="text-sm text-red-400 mb-2" style={{ fontFamily: subFont }}>HOLD A CAT, MINT FOR FREE</h3>
                <div className="space-y-2 mb-4">
                  <a href="https://magiceden.io/ordinals/marketplace/bonecat" target="_blank" rel="noopener noreferrer"
                    className="group flex items-center gap-3 bg-black/40 rounded-lg p-2.5 border border-red-900/40 transition-all hover:border-red-500 hover:bg-black/60">
                    <img src="/images/bonecat-preview.png" alt="Bone Cat"
                      className="w-12 h-12 rounded-md border-2 border-gray-700 group-hover:border-red-500 transition-colors object-cover flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-white group-hover:text-red-400 transition-colors" style={{ fontFamily: comicFont }}>Bone Cat</p>
                      <p className="text-[10px] text-gray-500">Collection on Magic Eden</p>
                    </div>
                    <span className="bg-green-900/60 text-green-400 px-2 py-1 rounded text-[9px] font-bold border border-green-800/50 flex-shrink-0"
                      style={{ fontFamily: subFont }}>1:1 FREE</span>
                  </a>

                  <a href="https://magiceden.io/ordinals/marketplace/bchalloween" target="_blank" rel="noopener noreferrer"
                    className="group flex items-center gap-3 bg-black/40 rounded-lg p-2.5 border border-red-900/40 transition-all hover:border-orange-500 hover:bg-black/60">
                    <div className="flex -space-x-2 flex-shrink-0">
                      <img src="/images/bchalloween-preview1.avif" alt="Halloween Bad Cat"
                        className="w-11 h-11 rounded-md border-2 border-gray-700 group-hover:border-orange-500 transition-colors object-cover relative z-10" />
                      <img src="/images/bchalloween-preview2.avif" alt="Halloween Bad Cat"
                        className="w-11 h-11 rounded-md border-2 border-gray-700 group-hover:border-orange-500 transition-colors object-cover" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-white group-hover:text-orange-400 transition-colors" style={{ fontFamily: comicFont }}>Halloween Bad Cats</p>
                      <p className="text-[10px] text-gray-500">Special Edition on Magic Eden</p>
                    </div>
                    <span className="bg-green-900/60 text-green-400 px-2 py-1 rounded text-[9px] font-bold border border-green-800/50 flex-shrink-0"
                      style={{ fontFamily: subFont }}>1:1 FREE</span>
                  </a>
                </div>

                <div className="bg-green-950/30 rounded-md px-3 py-2 border border-green-800/30 mb-4">
                  <p className="text-[10px] text-green-300 text-center" style={{ fontFamily: subFont }}>
                    The more you hold, the more you mint for free! Each ordinal = 1 free BadCat.
                  </p>
                </div>

                {/* How it works */}
                <h3 className="text-sm text-red-400 mb-2" style={{ fontFamily: subFont }}>HOW IT WORKS</h3>
                <ul className="space-y-1.5 text-gray-300 text-xs mb-4">
                  {[
                    ['500 unique cats', '— each one different'],
                    ['Random mint', '— you don\'t know which cat you get'],
                    ['Recursive', '— layers composited on-chain'],
                    ['Hold to earn', '— Bone Cat & Halloween holders mint free'],
                    ['Taproot address', '— sent to your bc1p...'],
                  ].map(([bold, rest], i) => (
                    <li key={i} className="flex items-start gap-2">
                      <span className="text-red-500 text-sm leading-none mt-0.5">🐱</span>
                      <span><strong className="text-white">{bold}</strong> {rest}</span>
                    </li>
                  ))}
                </ul>

                <div className="bg-red-950/50 text-red-200 rounded-md px-3 py-2 border border-red-800/50 text-center"
                  style={{ fontFamily: subFont }}>
                  <p className="text-sm">Not your average cats. These ones bite.</p>
                </div>
              </div>
            </div>
          </div>
          </>
        )}

        {/* Wallet Connect Modal */}
        {showWalletConnect && (
          <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
            <div className="bg-[#1a0a0e] border-[3px] border-red-900 rounded-lg max-w-md w-full"
              style={{ boxShadow: '6px 6px 0 #000' }}>
              <div className="flex justify-between items-center p-4 border-b-[3px] border-red-900">
                <h2 className="text-xl text-red-400" style={{ fontFamily: comicFont }}>Connect Wallet</h2>
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
