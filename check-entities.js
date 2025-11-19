#!/usr/bin/env node

const https = require('https');

const SUBGRAPH_URL = 'https://api.studio.thegraph.com/query/111767/curve-finance-polygon/v0.0.2';

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

async function querySubgraph(query) {
  try {
    const result = await httpsPost(SUBGRAPH_URL, { query });
    return result;
  } catch (error) {
    console.error(`❌ Error:`, error.message);
    return null;
  }
}

async function main() {
  console.log(`\n🔍 Checking for entities in subgraph...\n`);
  
  // Query matching actual schema fields
  const query = `
    {
      pools(first: 10, orderBy: createdAtTimestamp, orderDirection: desc) {
        id
        name
        address
        poolType
        tokensList
        fee
        swapCount
        liquidityProviderCount
        cumulativeVolumeUSD
        createdAtTimestamp
        createdAtBlockNumber
      }
      swaps(first: 5, orderBy: timestamp, orderDirection: desc) {
        id
        hash
        pool {
          id
          name
          address
        }
        buyer
        soldId
        tokensSold
        boughtId
        tokensBought
        timestamp
      }
      liquidityEvents(first: 5, orderBy: timestamp, orderDirection: desc) {
        id
        hash
        pool {
          name
        }
        provider
        type
        timestamp
      }
      users(first: 5, orderBy: swapCount, orderDirection: desc) {
        id
        swapCount
        liquidityEventCount
      }
    }
  `;
  
  const result = await querySubgraph(query);
  
  if (result && result.data) {
    const { pools, swaps, liquidityEvents, users } = result.data;
    
    console.log(`${'='.repeat(60)}`);
    console.log(`📊 ENTITY COUNTS`);
    console.log(`${'='.repeat(60)}`);
    console.log(`   Pools: ${pools.length}`);
    console.log(`   Swaps: ${swaps.length}`);
    console.log(`   Liquidity Events: ${liquidityEvents.length}`);
    console.log(`   Users: ${users.length}`);
    console.log('');
    
    if (pools.length > 0) {
      console.log(`${'='.repeat(60)}`);
      console.log(`🏊 POOLS FOUND`);
      console.log(`${'='.repeat(60)}`);
      pools.forEach((pool, i) => {
        console.log(`\n   ${i + 1}. ${pool.name || 'Unnamed Pool'}`);
        console.log(`      Address: ${pool.address}`);
        console.log(`      Type: ${pool.poolType}`);
        console.log(`      Tokens: ${pool.tokensList.length}`);
        console.log(`      Fee: ${pool.fee}`);
        console.log(`      Swaps: ${pool.swapCount}`);
        console.log(`      LPs: ${pool.liquidityProviderCount}`);
        console.log(`      Volume: $${pool.cumulativeVolumeUSD}`);
        console.log(`      Created: Block ${pool.createdAtBlockNumber} (${new Date(pool.createdAtTimestamp * 1000).toLocaleString()})`);
      });
    } else {
      console.log(`\n⚠️  NO POOLS FOUND YET`);
      console.log(`   This could mean:`);
      console.log(`   1. Subgraph is still processing events`);
      console.log(`   2. Event handlers haven't triggered yet`);
      console.log(`   3. There might be an issue with event signatures\n`);
    }
    
    if (swaps.length > 0) {
      console.log(`\n${'='.repeat(60)}`);
      console.log(`💱 RECENT SWAPS`);
      console.log(`${'='.repeat(60)}`);
      swaps.forEach((swap, i) => {
        console.log(`\n   ${i + 1}. ${swap.pool.name || swap.pool.address}`);
        console.log(`      Buyer: ${swap.buyer}`);
        console.log(`      Sold: ${swap.tokensSold} (token ${swap.soldId})`);
        console.log(`      Bought: ${swap.tokensBought} (token ${swap.boughtId})`);
        console.log(`      Time: ${new Date(swap.timestamp * 1000).toLocaleString()}`);
      });
    }
    
    if (liquidityEvents.length > 0) {
      console.log(`\n${'='.repeat(60)}`);
      console.log(`💧 RECENT LIQUIDITY EVENTS`);
      console.log(`${'='.repeat(60)}`);
      liquidityEvents.forEach((event, i) => {
        console.log(`\n   ${i + 1}. ${event.type}`);
        console.log(`      Pool: ${event.pool.name}`);
        console.log(`      Provider: ${event.provider}`);
        console.log(`      Time: ${new Date(event.timestamp * 1000).toLocaleString()}`);
      });
    }
    
  } else if (result && result.errors) {
    console.log(`❌ Query errors:`);
    result.errors.forEach(err => console.log(`   - ${err.message}`));
  } else {
    console.log(`❌ Cannot query subgraph`);
  }
  
  console.log(`\n${'='.repeat(60)}\n`);
}

main().catch(console.error);

