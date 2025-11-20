#!/usr/bin/env node

const https = require('https');

// Check v0.0.4 DIRECTLY
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
  console.log(`\n🚀 Checking v0.0.4 DIRECTLY\n`);
  
  const query = `{
    _meta {
      block { number }
      hasIndexingErrors
      deployment
    }
    pools(first: 3, orderBy: swapCount, orderDirection: desc) {
      name
      address
      swapCount
      totalValueLockedUSD
      cumulativeVolumeUSD
    }
  }`;
  
  try {
    const result = await httpsPost(SUBGRAPH_URL, { query });
    
    if (result.data) {
      const { _meta, pools } = result.data;
      
      console.log(`📊 v0.0.4 Status:`);
      console.log(`   Block: ${parseInt(_meta.block.number).toLocaleString()}`);
      console.log(`   Deployment: ${_meta.deployment}`);
      console.log(`   Errors: ${_meta.hasIndexingErrors ? 'YES ❌' : 'NO ✅'}\n`);
      
      console.log(`🏊 Top Pools:\n`);
      pools.forEach((pool, i) => {
        const tvl = parseFloat(pool.totalValueLockedUSD);
        const vol = parseFloat(pool.cumulativeVolumeUSD);
        console.log(`${i + 1}. ${pool.name}`);
        console.log(`   Swaps: ${pool.swapCount}`);
        console.log(`   Volume: $${vol.toLocaleString()} ${vol > 0 ? '✅' : '❌'}`);
        console.log(`   TVL: $${tvl.toLocaleString()} ${tvl > 0 ? '✅' : '❌'}\n`);
      });
    } else if (result.errors) {
      console.log(`❌ Errors:`, result.errors);
    }
  } catch (error) {
    console.log(`❌ v0.0.4 is still deploying/syncing...`);
    console.log(`   This is normal - give it 10-20 more minutes\n`);
  }
}

main().catch(console.error);
