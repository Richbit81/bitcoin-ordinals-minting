import{a as p,s as l,b as c}from"./index-kXw5S_gE.js";const h=async(n,a,r=1,o=null)=>{console.log(`[PointShopMinting] Creating delegate inscription for Point Shop item: ${n}`);const d=`<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<script type="application/json" id="delegate-metadata">
${JSON.stringify({p:"ord-20",op:"delegate",originalInscriptionId:n,source:"point-shop",timestamp:Date.now()})}
<\/script>
<style>
body {
  margin: 0;
  padding: 0;
  background: transparent;
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 100vh;
}
img {
  width: 100%;
  height: 100%;
  object-fit: contain;
  display: block;
}
</style>
</head>
<body>
<img src="/content/${n}" alt="Point Shop Item" />
</body>
</html>`,e=new File([d],`point-shop-${Date.now()}.html`,{type:"text/html"});console.log(`[PointShopMinting] ✅ HTML-Datei erstellt: ${e.name} (${e.size} bytes)`),console.log("[PointShopMinting] Creating inscription via UniSat API...");const t=await p({file:e,address:a,feeRate:r,postage:330});if(console.log(`[PointShopMinting] ✅ Inskription erstellt: ${t.inscriptionId}`),t.payAddress&&t.amount){console.log(`[PointShopMinting] Zahlung erforderlich: ${t.amount.toFixed(8)} BTC an ${t.payAddress}`);const s=[{address:t.payAddress,amount:t.amount}];let i;if(o==="unisat")i=await l(s);else if(o==="xverse")i=await c(s);else throw new Error("Wallet type not supported");return console.log(`[PointShopMinting] ✅ Zahlung erfolgreich: ${i}`),{inscriptionId:t.inscriptionId,txid:t.txid||t.orderId,payAddress:t.payAddress,amount:t.amount,paymentTxid:i}}return{inscriptionId:t.inscriptionId,txid:t.txid||t.orderId,payAddress:t.payAddress,amount:t.amount}};export{h as mintPointShopItem};
