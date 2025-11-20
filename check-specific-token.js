#!/usr/bin/env node

const https = require('https');

const SUBGRAPH_URL = 'https://api.studio.thegraph.com/query/111767/curve-finance-polygon/v0.0.4';
const ETH_API_KEY = '8X4YIZCEESWC88D8SNY16JH1SQ6FT2E2KK';

function httpsPost(url, data) {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify(data);
    const urlObj = new URL(url);
    
    const options = {
      hostname: urlObj.hostname,
      path: urlObj.pathname + urlObj.search,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      }
    };

    const req = https.request(options, (res) => {
      let responseData = '';
      res.on('data', (chunk) => responseData += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(responseData));
        } catch (e) {
          resolve(responseData);
        }
      });
    });

    req.on('error', reject);
    req.write(postData);
    req.end();
  });
}

function httpsGet(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          resolve(data);
        }
      });
    }).on('error', reject);
  });
}

async function main() {
  const usdcAddress = '0x3c499c542cef5e3811e1192ce70d8cc03d5c3359';
  
  console.log(`\n🔍 Checking USDC Token: ${usdcAddress}\n`);
  
  // Check subgraph
  const query = `{
    token(id: "${usdcAddress}") {
      id
      address
      symbol
      name
      decimals
    }
  }`;
  
  const result = await httpsPost(SUBGRAPH_URL, { query });
  
  if (result.data && result.data.token) {
    const token = result.data.token;
    console.log(`📊 Subgraph Data:`);
    console.log(`   Symbol: ${token.symbol}`);
    console.log(`   Name: ${token.name}`);
    console.log(`   Decimals: ${token.decimals}\n`);
  } else {
    console.log(`❌ Token not found in subgraph!\n`);
  }
  
  // Check Polygonscan
  console.log(`🔍 Checking Polygonscan API...\n`);
  const polygonscanUrl = `https://api.polygonscan.com/api?module=token&action=tokeninfo&contractaddress=${usdcAddress}&apikey=${ETH_API_KEY}`;
  
  const polygonscanResult = await httpsGet(polygonscanUrl);
  
  if (polygonscanResult.status === '1' && polygonscanResult.result) {
    const tokenInfo = Array.isArray(polygonscanResult.result) ? polygonscanResult.result[0] : polygonscanResult.result;
    console.log(`📊 Polygonscan Data:`);
    console.log(`   Symbol: ${tokenInfo.symbol || 'N/A'}`);
    console.log(`   Name: ${tokenInfo.tokenName || 'N/A'}`);
    console.log(`   Decimals: ${tokenInfo.divisor ? Math.log10(parseInt(tokenInfo.divisor)) : tokenInfo.decimals || 'N/A'}\n`);
  } else {
    console.log(`❌ Could not get token info from Polygonscan`);
    console.log(`Response:`, polygonscanResult);
  }
  
  // Now check the event itself
  console.log(`\n${'='.repeat(70)}`);
  console.log(`🔍 Checking Actual Event Data from Polygonscan\n`);
  
  const poolAddress = '0x5225010a0ae133b357861782b0b865a48471b2c5';
  const txHash = '0xca01939eaf18afd9e4c15e781eea87e0b2c0a7209d72f0538caa14b5a318ff72';
  
  const txUrl = `https://api.polygonscan.com/api?module=proxy&action=eth_getTransactionReceipt&txhash=${txHash}&apikey=${ETH_API_KEY}`;
  
  const txResult = await httpsGet(txUrl);
  
  if (txResult.result && txResult.result.logs) {
    console.log(`📜 Transaction: ${txHash}`);
    console.log(`   Logs: ${txResult.result.logs.length}\n`);
    
    // Find AddLiquidity event
    txResult.result.logs.forEach((log, i) => {
      if (log.address.toLowerCase() === poolAddress.toLowerCase()) {
        console.log(`   Log ${i}: ${log.topics[0]}`);
        console.log(`   Data: ${log.data}\n`);
      }
    });
  } else {
    console.log(`❌ Could not get transaction receipt`);
  }
}

main().catch(console.error);

