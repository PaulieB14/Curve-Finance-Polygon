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
  console.log(`\n🔄 SYNC STATUS CHECK\n`);
  
  const query = `{
    _meta {
      block {
        number
        timestamp
      }
      hasIndexingErrors
      deployment
    }
    liquidityEvents(first: 5, orderBy: timestamp, orderDirection: desc) {
      id
      pool {
        name
      }
      type
      lpTokenAmount
      timestamp
    }
  }`;
  
  const result = await httpsPost(SUBGRAPH_URL, { query });
  
  if (result.data) {
    const { _meta, liquidityEvents } = result.data;
    
    console.log(`📊 Subgraph Status:`);
    console.log(`   Current Block: ${parseInt(_meta.block.number).toLocaleString()}`);
    console.log(`   Timestamp: ${new Date(parseInt(_meta.block.timestamp) * 1000).toLocaleString()}`);
    console.log(`   Has Errors: ${_meta.hasIndexingErrors ? '❌ YES' : '✅ NO'}`);
    console.log(`   Deployment: ${_meta.deployment}\n`);
    
    console.log(`💧 Recent Liquidity Events:\n`);
    if (liquidityEvents && liquidityEvents.length > 0) {
      liquidityEvents.forEach((event, i) => {
        console.log(`${i + 1}. ${event.type} in ${event.pool.name || 'Unnamed'}`);
        console.log(`   LP Tokens: ${parseFloat(event.lpTokenAmount).toFixed(4)}`);
        console.log(`   Time: ${new Date(parseInt(event.timestamp) * 1000).toLocaleString()}\n`);
      });
      console.log(`✅ Liquidity events ARE being indexed!`);
      console.log(`⏳ TVL calculation is in progress...`);
    } else {
      console.log(`❌ No liquidity events found yet`);
      console.log(`   Subgraph is still processing early blocks`);
    }
  }
  
  console.log(`\n${'='.repeat(70)}\n`);
}

main().catch(console.error);

