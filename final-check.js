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
  console.log(`\n${'🔥'.repeat(30)}`);
  console.log(`🎯 FINAL ENTITY CHECK - CORRECT SCHEMA`);
  console.log(`${'🔥'.repeat(30)}\n`);
  
  // Query with exact schema field names
  const query = `
    {
      curveProtocols(first: 1) {
        id
        poolCount
        totalVolumeUSD
        totalValueLockedUSD
        txCount
        userCount
      }
      pools(first: 10, orderBy: createdAt, orderDirection: desc) {
        id
        name
        address
        poolType
        fee
        adminFee
        swapCount
        txCount
        cumulativeVolumeUSD
        totalValueLockedUSD
        createdAt
        createdAtBlock
      }
      swaps(first: 5, orderBy: timestamp, orderDirection: desc) {
        id
        pool {
          id
          name
          address
        }
        buyer {
          id
        }
        soldToken {
          symbol
        }
        boughtToken {
          symbol
        }
        tokensSold
        tokensBought
        amountUSD
        timestamp
        block
      }
      liquidityEvents(first: 5, orderBy: timestamp, orderDirection: desc) {
        id
        pool {
          name
        }
        provider {
          id
        }
        type
        lpTokenAmount
        timestamp
      }
      users(first: 5, orderBy: swapCount, orderDirection: desc) {
        id
        address
        swapCount
        liquidityEventCount
        totalVolumeUSD
        positionCount
      }
    }
  `;
  
  const result = await querySubgraph(query);
  
  if (result && result.data) {
    const { curveProtocols, pools, swaps, liquidityEvents, users } = result.data;
    
    console.log(`${'='.repeat(70)}`);
    console.log(`📊 ENTITY COUNTS`);
    console.log(`${'='.repeat(70)}`);
    console.log(`   Protocols: ${curveProtocols ? curveProtocols.length : 0}`);
    console.log(`   Pools: ${pools ? pools.length : 0}`);
    console.log(`   Swaps: ${swaps ? swaps.length : 0}`);
    console.log(`   Liquidity Events: ${liquidityEvents ? liquidityEvents.length : 0}`);
    console.log(`   Users: ${users ? users.length : 0}`);
    
    if (curveProtocols && curveProtocols.length > 0) {
      const protocol = curveProtocols[0];
      console.log(`\n${'='.repeat(70)}`);
      console.log(`🌐 CURVE PROTOCOL STATS`);
      console.log(`${'='.repeat(70)}`);
      console.log(`   Total Pools: ${protocol.poolCount}`);
      console.log(`   Total TVL: $${Number(protocol.totalValueLockedUSD).toLocaleString()}`);
      console.log(`   Total Volume: $${Number(protocol.totalVolumeUSD).toLocaleString()}`);
      console.log(`   Total Transactions: ${protocol.txCount}`);
      console.log(`   Total Users: ${protocol.userCount}`);
    }
    
    if (pools && pools.length > 0) {
      console.log(`\n${'='.repeat(70)}`);
      console.log(`🏊 POOLS (${pools.length} found)`);
      console.log(`${'='.repeat(70)}`);
      pools.forEach((pool, i) => {
        console.log(`\n   ${i + 1}. ${pool.name || 'Unnamed Pool'}`);
        console.log(`      Address: ${pool.address}`);
        console.log(`      Type: ${pool.poolType}`);
        console.log(`      Fee: ${pool.fee}`);
        console.log(`      Admin Fee: ${pool.adminFee}`);
        console.log(`      Swaps: ${pool.swapCount}`);
        console.log(`      Transactions: ${pool.txCount}`);
        console.log(`      Volume: $${Number(pool.cumulativeVolumeUSD).toLocaleString()}`);
        console.log(`      TVL: $${Number(pool.totalValueLockedUSD).toLocaleString()}`);
        console.log(`      Created: Block ${pool.createdAtBlock} at ${new Date(Number(pool.createdAt) * 1000).toLocaleString()}`);
      });
    } else {
      console.log(`\n${'='.repeat(70)}`);
      console.log(`⚠️  NO POOLS FOUND`);
      console.log(`${'='.repeat(70)}`);
      console.log(`\n   Etherscan shows 5 PlainPoolDeployed events,`);
      console.log(`   but subgraph hasn't indexed them yet.\n`);
      console.log(`   Possible reasons:`);
      console.log(`   1. ❌ Event signature mismatch in subgraph.yaml`);
      console.log(`   2. ❌ ABI doesn't match on-chain events`);
      console.log(`   3. ⏳ Handlers haven't been triggered yet (unlikely, 100% synced)`);
      console.log(`   4. ❌ Pool address not in event parameters (need to query contract)\n`);
    }
    
    if (swaps && swaps.length > 0) {
      console.log(`\n${'='.repeat(70)}`);
      console.log(`💱 RECENT SWAPS`);
      console.log(`${'='.repeat(70)}`);
      swaps.forEach((swap, i) => {
        console.log(`\n   ${i + 1}. ${swap.pool.name || swap.pool.address}`);
        console.log(`      ${swap.soldToken.symbol} → ${swap.boughtToken.symbol}`);
        console.log(`      Sold: ${swap.tokensSold}`);
        console.log(`      Bought: ${swap.tokensBought}`);
        console.log(`      Value: $${Number(swap.amountUSD || 0).toLocaleString()}`);
        console.log(`      Buyer: ${swap.buyer.id}`);
        console.log(`      Time: ${new Date(Number(swap.timestamp) * 1000).toLocaleString()}`);
      });
    }
    
    if (liquidityEvents && liquidityEvents.length > 0) {
      console.log(`\n${'='.repeat(70)}`);
      console.log(`💧 RECENT LIQUIDITY EVENTS`);
      console.log(`${'='.repeat(70)}`);
      liquidityEvents.forEach((event, i) => {
        console.log(`\n   ${i + 1}. ${event.type}`);
        console.log(`      Pool: ${event.pool.name}`);
        console.log(`      Provider: ${event.provider.id}`);
        console.log(`      LP Tokens: ${event.lpTokenAmount}`);
        console.log(`      Time: ${new Date(Number(event.timestamp) * 1000).toLocaleString()}`);
      });
    }
    
    if (users && users.length > 0) {
      console.log(`\n${'='.repeat(70)}`);
      console.log(`👥 TOP USERS`);
      console.log(`${'='.repeat(70)}`);
      users.forEach((user, i) => {
        console.log(`\n   ${i + 1}. ${user.address}`);
        console.log(`      Swaps: ${user.swapCount}`);
        console.log(`      Liquidity Events: ${user.liquidityEventCount}`);
        console.log(`      Volume: $${Number(user.totalVolumeUSD).toLocaleString()}`);
        console.log(`      Positions: ${user.positionCount}`);
      });
    }
    
  } else if (result && result.errors) {
    console.log(`\n❌ QUERY ERRORS:`);
    result.errors.forEach(err => console.log(`   - ${err.message}`));
  } else {
    console.log(`\n❌ Cannot reach subgraph`);
  }
  
  console.log(`\n${'='.repeat(70)}`);
  console.log(`✅ CHECK COMPLETE`);
  console.log(`${'='.repeat(70)}\n`);
}

main().catch(console.error);

