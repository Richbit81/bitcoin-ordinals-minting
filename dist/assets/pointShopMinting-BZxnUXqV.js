import{a as p,s as l,b as c}from"./index-D7Waa7rQ.js";const g=async(e,a,r=1,s=null,m)=>{console.log(`[PointShopMinting] Creating delegate inscription for Point Shop item: ${e}`);const d=`<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<script type="application/json" id="delegate-metadata">
${JSON.stringify({p:"ord-20",op:"delegate",originalInscriptionId:e,source:"point-shop",timestamp:Date.now()})}
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
<img src="/content/${e}" alt="Point Shop Item" />
</body>
</html>`,o=new File([d],`point-shop-${Date.now()}.html`,{type:"text/html"});console.log(`[PointShopMinting] ✅ HTML-Datei erstellt: ${o.name} (${o.size} bytes)`),console.log("[PointShopMinting] Creating inscription via UniSat API...");const t=await p({file:o,address:a,feeRate:r,postage:546});if(console.log(`[PointShopMinting] ✅ Inskription erstellt: ${t.inscriptionId}`),t.payAddress&&t.amount){console.log(`[PointShopMinting] Zahlung erforderlich: ${t.amount.toFixed(8)} BTC an ${t.payAddress}`);const i=[{address:t.payAddress,amount:t.amount}];let n;if(s==="unisat")n=await l(i[0].address,i[0].amount);else if(s==="xverse")n=await c(i[0].address,i[0].amount);else throw new Error("Wallet type not supported");return console.log(`[PointShopMinting] ✅ Zahlung erfolgreich: ${n}`),{inscriptionId:t.inscriptionId,txid:t.txid||t.orderId,payAddress:t.payAddress,amount:t.amount,paymentTxid:n}}return{inscriptionId:t.inscriptionId,txid:t.txid||t.orderId,payAddress:t.payAddress,amount:t.amount}};export{g as mintPointShopItem};
