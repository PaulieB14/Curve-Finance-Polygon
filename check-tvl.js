#!/usr/bin/env node

const https = require('https');

const SUBGRAPH_URL = 'https://api.studio.thegraph.com/query/111767/curve-finance-polygon/version/latest';

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
  console.log(`\n${'💎'.repeat(35)}`);
  console.log(`📊 TVL CHECK - v0.0.4`);
  console.log(`${'💎'.repeat(35)}\n`);
  
  const query = `{
    curveProtocols(first: 1) {
      totalValueLockedUSD
    }
    pools(first: 10, orderBy: swapCount, orderDirection: desc) {
      name
      address
      swapCount
      totalValueLocked
      totalValueLockedUSD
      cumulativeVolumeUSD
    }
  }`;
  
  const result = await httpsPost(SUBGRAPH_URL, { query });
  
  if (result.data) {
    const { curveProtocols, pools } = result.data;
    
    console.log(`🌐 Protocol TVL:`);
    if (curveProtocols && curveProtocols.length > 0) {
      const tvl = parseFloat(curveProtocols[0].totalValueLockedUSD);
      console.log(`   $${tvl.toLocaleString()} ${tvl > 0 ? '✅' : '❌'}\n`);
    }
    
    console.log(`🏊 Pool TVLs:\n`);
    pools.forEach((pool, i) => {
      const tvl = parseFloat(pool.totalValueLockedUSD);
      const volume = parseFloat(pool.cumulativeVolumeUSD);
      console.log(`${i + 1}. ${pool.name || 'Unnamed'}`);
      console.log(`   Address: ${pool.address.substring(0, 10)}...`);
      console.log(`   Swaps: ${pool.swapCount}`);
      console.log(`   Volume: $${volume.toLocaleString()} ✅`);
      console.log(`   TVL: $${tvl.toLocaleString()} ${tvl > 0 ? '✅' : '❌'}\n`);
    });
  }
  
  console.log(`${'='.repeat(70)}\n`);
}

main().catch(console.error);

