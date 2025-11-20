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
  console.log(`\n🔍 Checking for Duplicate Events and PoolToken Issues\n`);
  
  const poolAddress = '0x5225010a0ae133b357861782b0b865a48471b2c5';
  const usdcAddress = '0x3c499c542cef5e3811e1192ce70d8cc03d5c3359';
  
  // Check if there are multiple PoolToken entities for the same pool+token combo
  const query1 = `{
    poolTokens(where: { pool: "${poolAddress}" }) {
      id
      pool {
        name
      }
      token {
        symbol
        address
        decimals
      }
      balance
      balanceUSD
      index
    }
  }`;
  
  const result1 = await httpsPost(SUBGRAPH_URL, { query: query1 });
  
  if (result1.data && result1.data.poolTokens) {
    console.log(`📊 PoolTokens for pool ${poolAddress}:\n`);
    
    const poolTokens = result1.data.poolTokens;
    console.log(`   Total PoolToken entities: ${poolTokens.length}\n`);
    
    poolTokens.forEach((pt, i) => {
      console.log(`   ${i + 1}. ID: ${pt.id}`);
      console.log(`      Token: ${pt.token.symbol} (${pt.token.address})`);
      console.log(`      Index: ${pt.index}`);
      console.log(`      Balance: ${pt.balance}`);
      console.log(`      Balance USD: $${parseFloat(pt.balanceUSD).toLocaleString()}\n`);
    });
    
    // Check for duplicates (same token, different PoolToken entities)
    const tokenCounts = {};
    poolTokens.forEach(pt => {
      const addr = pt.token.address.toLowerCase();
      tokenCounts[addr] = (tokenCounts[addr] || 0) + 1;
    });
    
    console.log(`${'='.repeat(70)}`);
    console.log(`🔍 Duplicate Check:\n`);
    
    let hasDuplicates = false;
    Object.entries(tokenCounts).forEach(([addr, count]) => {
      if (count > 1) {
        hasDuplicates = true;
        const symbol = poolTokens.find(pt => pt.token.address.toLowerCase() === addr).token.symbol;
        console.log(`   ❌ ${symbol} (${addr}): ${count} PoolToken entities!`);
      }
    });
    
    if (!hasDuplicates) {
      console.log(`   ✅ No duplicates found\n`);
    } else {
      console.log(`\n   🐛 FOUND DUPLICATES! This could explain the inflated TVL.\n`);
    }
  }
  
  // Check for duplicate liquidity events  console.log(`\n${'='.repeat(70)}`);
  console.log(`🔍 Checking for Duplicate Liquidity Events\n`);
  
  const query2 = `{
    liquidityEvents(first: 50, where: { pool: "${poolAddress}" }, orderBy: timestamp, orderDirection: desc) {
      id
      type
      timestamp
      block
      logIndex
    }
  }`;
  
  const result2 = await httpsPost(SUBGRAPH_URL, { query: query2 });
  
  if (result2.data && result2.data.liquidityEvents) {
    const events = result2.data.liquidityEvents;
    console.log(`   Total events: ${events.length}\n`);
    
    const eventIds = new Set();
    const duplicateIds = new Set();
    
    events.forEach(event => {
      if (eventIds.has(event.id)) {
        duplicateIds.add(event.id);
      }
      eventIds.add(event.id);
    });
    
    if (duplicateIds.size > 0) {
      console.log(`   ❌ Found ${duplicateIds.size} duplicate event IDs:`);
      duplicateIds.forEach(id => console.log(`      ${id}`));
    } else {
      console.log(`   ✅ No duplicate events found`);
    }
    
    // Check if same block/logIndex appears multiple times
    const blockLogKeys = {};
    events.forEach(event => {
      const key = `${event.block}-${event.logIndex}`;
      blockLogKeys[key] = (blockLogKeys[key] || 0) + 1;
    });
    
    const duplicateBlockLogs = Object.entries(blockLogKeys).filter(([_, count]) => count > 1);
    
    if (duplicateBlockLogs.length > 0) {
      console.log(`\n   ❌ Found ${duplicateBlockLogs.length} block/logIndex combinations with multiple events:`);
      duplicateBlockLogs.forEach(([key, count]) => {
        console.log(`      ${key}: ${count} events`);
      });
    } else {
      console.log(`   ✅ No duplicate block/logIndex combinations`);
    }
  }
}

main().catch(console.error);

