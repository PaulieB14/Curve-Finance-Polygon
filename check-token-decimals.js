#!/usr/bin/env node

const https = require('https');

const SUBGRAPH_URL = 'https://api.studio.thegraph.com/query/111767/curve-finance-polygon/v0.0.4';

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

async function main() {
  console.log(`\n🔍 Checking Token Decimals in Subgraph\n`);
  
  const query = `{
    tokens(first: 10) {
      id
      address
      symbol
      name
      decimals
    }
  }`;
  
  const result = await httpsPost(SUBGRAPH_URL, { query });
  
  if (result.data && result.data.tokens) {
    console.log(`📊 Tokens:\n`);
    result.data.tokens.forEach((token, i) => {
      console.log(`${i + 1}. ${token.symbol || 'Unknown'} (${token.name || 'N/A'})`);
      console.log(`   Address: ${token.address}`);
      console.log(`   Decimals: ${token.decimals}`);
      
      // Known decimals
      const known = {
        '0x3c499c542cef5e3811e1192ce70d8cc03d5c3359': 6,  // USDC
        '0x2791bca1f2de4661ed88a30c99a7a9449aa84174': 6,  // USDC (bridged)
        '0xc2132d05d31c914a87c6611c10748aeb04b58e8f': 6,  // USDT
        '0x8f3cf7ad23cd3cadbd9735aff958023239c6a063': 18, // DAI
        '0xc4ce1d6f5d98d65ee25cf85e9f2e9dcfee6cb5d6': 18, // crvUSD
      };
      
      const expectedDecimals = known[token.address.toLowerCase()];
      if (expectedDecimals !== undefined) {
        if (token.decimals === expectedDecimals) {
          console.log(`   ✅ Correct!`);
        } else {
          console.log(`   ❌ WRONG! Expected: ${expectedDecimals}, Got: ${token.decimals}`);
        }
      }
      
      console.log();
    });
  } else if (result.errors) {
    console.log(`❌ Errors:`, result.errors);
  }
}

main().catch(console.error);

