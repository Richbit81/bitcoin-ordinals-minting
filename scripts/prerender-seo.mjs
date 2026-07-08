/**
 * Post-build SEO prerender (no browser / no Puppeteer).
 *
 * After `vite build`, this reads the built `dist/index.html` (which already
 * references the correct hashed assets) and writes per-route static HTML files
 * with a fully baked-in SEO <head>: <title>, meta description/keywords,
 * canonical, Open Graph/Twitter cards and JSON-LD structured data.
 *
 * Result: Google and social crawlers get correct metadata + rich-results data
 * WITHOUT having to execute JavaScript, while the SPA still hydrates normally.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const distDir = path.resolve(__dirname, '..', 'dist');
const templatePath = path.join(distDir, 'index.html');

const SITE = 'https://www.richart.app';
const OG_IMAGE = `${SITE}/images/ordinals-explained-og.png`;

const escAttr = (s) => String(s)
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;');

const FAQ = [
  { q: 'What are Bitcoin Ordinals?', a: 'Ordinals are a way to number every individual satoshi (the smallest unit of bitcoin) so each one becomes uniquely identifiable. That numbering makes it possible to attach data to a specific sat and treat it like a collectible on Bitcoin.' },
  { q: 'What is a Bitcoin inscription?', a: 'An inscription is content — an image, text, or other file — written directly onto a single satoshi and stored permanently on the Bitcoin blockchain. Unlike many NFTs, the data itself lives fully on-chain.' },
  { q: 'How do I create a Bitcoin inscription?', a: 'You need an Ordinals-capable Taproot wallet (e.g. Xverse), a small amount of bitcoin for network fees, and your content. You then broadcast an inscription transaction. On richart.app you can practice safely first and then inscribe for real, directly in your browser.' },
  { q: 'Do I need coding skills to inscribe?', a: 'No. With a user-friendly wallet and a guided tool like the one on richart.app, you can create an inscription without any coding.' },
  { q: 'How much does an inscription cost?', a: 'The cost is mainly the Bitcoin network fee plus a tiny amount of "postage" (around 546 sats). Bigger files and higher fee rates cost more; a short text inscription can be very cheap.' },
  { q: 'What is the difference between Ordinals and NFTs?', a: 'Traditional NFTs often store their media on external servers and live on chains like Ethereum, while a Bitcoin inscription stores the full content on-chain on Bitcoin itself — no external hosting needed.' },
  { q: 'Which wallet do I need for Ordinals?', a: 'Use an Ordinals-aware Taproot wallet such as Xverse. Always download it from the official source and back up your seed phrase offline.' },
  { q: 'Can I create my first inscription on RichArt?', a: 'Yes. richart.app offers an interactive, beginner-friendly guide plus a hands-on workshop where you can practice with a virtual wallet and then create a real inscription in your browser.' },
];

const HOWTO = [
  { name: 'Get an Ordinals wallet', text: 'Install an Ordinals-capable Taproot wallet like Xverse from its official website.' },
  { name: 'Back up your seed phrase', text: 'Write down your 12-24 word recovery phrase offline and never share it.' },
  { name: 'Add funds', text: 'Buy a small amount of bitcoin in your wallet (card, Apple/Google Pay, bank) or send BTC to your payment address.' },
  { name: 'Choose your content', text: 'Pick the text or image you want to inscribe onto a satoshi.' },
  { name: 'Set the fee and inscribe', text: 'Select a network fee rate and confirm. Your inscription is broadcast to the mempool and confirmed in a block.' },
];

const orgPublisher = {
  '@type': 'Organization',
  name: 'RichArt',
  url: SITE,
  logo: { '@type': 'ImageObject', url: OG_IMAGE },
};

const articleNode = (title, description, url) => ({
  '@type': 'Article',
  headline: title,
  description,
  image: OG_IMAGE,
  inLanguage: 'en',
  author: { '@type': 'Organization', name: 'RichArt', url: SITE },
  publisher: orgPublisher,
  mainEntityOfPage: url,
});

const howToNode = (description) => ({
  '@type': 'HowTo',
  name: 'How to create a Bitcoin inscription',
  description,
  step: HOWTO.map((s, i) => ({ '@type': 'HowToStep', position: i + 1, name: s.name, text: s.text })),
});

const faqNode = () => ({
  '@type': 'FAQPage',
  mainEntity: FAQ.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })),
});

const breadcrumbNode = (name, url) => ({
  '@type': 'BreadcrumbList',
  itemListElement: [
    { '@type': 'ListItem', position: 1, name: 'RichArt', item: SITE },
    { '@type': 'ListItem', position: 2, name, item: url },
  ],
});

const ROUTES = [
  {
    path: 'ordinals-explained',
    title: 'Bitcoin Ordinals Explained | Learn How to Create Inscriptions | RichArt',
    description: 'Learn what Bitcoin Ordinals and inscriptions are — and how to create your first inscription. A beginner-friendly, interactive step-by-step guide by RichArt.',
    graph: (url, title, description) => [
      articleNode(title, description, url),
      faqNode(),
      howToNode(description),
      breadcrumbNode('Ordinals Explained', url),
    ],
  },
  {
    path: 'ordinals-explained/step-2',
    title: 'Create Your First Bitcoin Inscription — Hands-on Workshop | RichArt',
    description: 'A hands-on workshop to create your first Bitcoin Ordinals inscription: practice safely with a virtual Xverse wallet, then inscribe for real directly in your browser with RichArt.',
    graph: (url, title, description) => [
      articleNode(title, description, url),
      howToNode(description),
      breadcrumbNode('Create an Inscription', url),
    ],
  },
];

function buildHead(route) {
  const url = `${SITE}/${route.path}`;
  const { title, description } = route;
  const keywords = 'bitcoin ordinals, ordinals explained, what are ordinals, bitcoin inscriptions, how to create an inscription, learn bitcoin ordinals, ordinals tutorial, inscribe on bitcoin, ordinals vs nft, richart ordinals, richart inscription';
  const jsonLd = { '@context': 'https://schema.org', '@graph': route.graph(url, title, description) };
  const jsonLdStr = JSON.stringify(jsonLd).replace(/</g, '\\u003c');
  return [
    `<meta name="description" content="${escAttr(description)}" />`,
    `<meta name="keywords" content="${escAttr(keywords)}" />`,
    `<meta name="robots" content="index,follow,max-image-preview:large" />`,
    `<link rel="canonical" href="${escAttr(url)}" />`,
    `<meta property="og:type" content="article" />`,
    `<meta property="og:site_name" content="RichArt" />`,
    `<meta property="og:title" content="${escAttr(title)}" />`,
    `<meta property="og:description" content="${escAttr(description)}" />`,
    `<meta property="og:url" content="${escAttr(url)}" />`,
    `<meta property="og:image" content="${escAttr(OG_IMAGE)}" />`,
    `<meta property="og:locale" content="en_US" />`,
    `<meta name="twitter:card" content="summary_large_image" />`,
    `<meta name="twitter:title" content="${escAttr(title)}" />`,
    `<meta name="twitter:description" content="${escAttr(description)}" />`,
    `<meta name="twitter:image" content="${escAttr(OG_IMAGE)}" />`,
    `<script type="application/ld+json">${jsonLdStr}</script>`,
  ].join('\n    ');
}

function run() {
  if (!fs.existsSync(templatePath)) {
    console.error(`[prerender-seo] dist/index.html not found at ${templatePath} — skipping.`);
    process.exit(1);
  }
  const template = fs.readFileSync(templatePath, 'utf8');

  for (const route of ROUTES) {
    let html = template.replace(/<title>[\s\S]*?<\/title>/i, `<title>${escAttr(route.title)}</title>`);
    html = html.replace('</head>', `    ${buildHead(route)}\n  </head>`);
    const outDir = path.join(distDir, route.path);
    fs.mkdirSync(outDir, { recursive: true });
    fs.writeFileSync(path.join(outDir, 'index.html'), html, 'utf8');
    console.log(`[prerender-seo] wrote dist/${route.path}/index.html`);
  }
}

run();
