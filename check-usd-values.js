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
  console.log(`\n${'💰'.repeat(35)}`);
  console.log(`🔍 CHECKING USD VALUE IMPLEMENTATION`);
  console.log(`${'💰'.repeat(35)}\n`);
  
  console.log(`📍 Querying: ${SUBGRAPH_URL}\n`);
  
  // Query 1: Check recent swaps with USD values
  const swapsQuery = `
    {
      swaps(first: 10, orderBy: timestamp, orderDirection: desc) {
        id
        pool {
          name
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
      }
    }
  `;
  
  console.log(`💱 Checking Recent Swaps with USD Values...\n`);
  const swapsResult = await httpsPost(SUBGRAPH_URL, { query: swapsQuery });
  
  if (swapsResult && swapsResult.data && swapsResult.data.swaps) {
    const swaps = swapsResult.data.swaps;
    
    let totalUSD = 0;
    let swapsWithUSD = 0;
    
    swaps.forEach((swap, i) => {
      const usdValue = parseFloat(swap.amountUSD);
      const hasUSD = usdValue > 0;
      
      if (hasUSD) {
        swapsWithUSD++;
        totalUSD += usdValue;
      }
      
      console.log(`${i + 1}. ${swap.soldToken.symbol} → ${swap.boughtToken.symbol}`);
      console.log(`   Sold: ${parseFloat(swap.tokensSold).toFixed(6)} ${swap.soldToken.symbol}`);
      console.log(`   Bought: ${parseFloat(swap.tokensBought).toFixed(6)} ${swap.boughtToken.symbol}`);
      console.log(`   USD Value: $${usdValue.toFixed(2)} ${hasUSD ? '✅' : '❌'}`);
      console.log(`   Time: ${new Date(parseInt(swap.timestamp) * 1000).toLocaleString()}\n`);
    });
    
    console.log(`${'='.repeat(70)}`);
    console.log(`📊 Swap Analysis:`);
    console.log(`   Total Swaps Checked: ${swaps.length}`);
    console.log(`   Swaps with USD Value: ${swapsWithUSD} ${swapsWithUSD > 0 ? '✅' : '❌'}`);
    console.log(`   Total USD Volume: $${totalUSD.toFixed(2)}`);
    console.log(`${'='.repeat(70)}\n`);
  }
  
  // Query 2: Check pool volumes
  const poolsQuery = `
    {
      pools(first: 5, orderBy: swapCount, orderDirection: desc) {
        name
        address
        swapCount
        cumulativeVolume
        cumulativeVolumeUSD
      }
    }
  `;
  
  console.log(`🏊 Checking Pool Volumes...\n`);
  const poolsResult = await httpsPost(SUBGRAPH_URL, { query: poolsQuery });
  
  if (poolsResult && poolsResult.data && poolsResult.data.pools) {
    const pools = poolsResult.data.pools;
    
    pools.forEach((pool, i) => {
      const rawVolume = parseFloat(pool.cumulativeVolume);
      const usdVolume = parseFloat(pool.cumulativeVolumeUSD);
      const hasUSD = usdVolume > 0;
      
      console.log(`${i + 1}. ${pool.name || 'Unnamed Pool'}`);
      console.log(`   Address: ${pool.address}`);
      console.log(`   Swaps: ${pool.swapCount}`);
      console.log(`   Raw Volume: ${rawVolume.toFixed(2)} tokens`);
      console.log(`   USD Volume: $${usdVolume.toLocaleString(undefined, {maximumFractionDigits: 2})} ${hasUSD ? '✅' : '❌'}\n`);
    });
  }
  
  // Query 3: Protocol stats
  const protocolQuery = `
    {
      curveProtocols(first: 1) {
        id
        poolCount
        totalVolumeUSD
        txCount
        userCount
      }
    }
  `;
  
  console.log(`${'='.repeat(70)}`);
  console.log(`🌐 Protocol Stats:\n`);
  const protocolResult = await httpsPost(SUBGRAPH_URL, { query: protocolQuery });
  
  if (protocolResult && protocolResult.data && protocolResult.data.curveProtocols) {
    const protocols = protocolResult.data.curveProtocols;
    
    if (protocols.length > 0) {
      const protocol = protocols[0];
      const totalUSD = parseFloat(protocol.totalVolumeUSD);
      const hasUSD = totalUSD > 0;
      
      console.log(`   Total Pools: ${protocol.poolCount}`);
      console.log(`   Total Transactions: ${protocol.txCount}`);
      console.log(`   Total Users: ${protocol.userCount}`);
      console.log(`   Total Volume USD: $${totalUSD.toLocaleString(undefined, {maximumFractionDigits: 2})} ${hasUSD ? '✅' : '❌'}`);
    }
  }
  
  console.log(`\n${'='.repeat(70)}`);
  console.log(`✅ CHECK COMPLETE`);
  console.log(`${'='.repeat(70)}\n`);
  
  console.log(`🔗 Query Endpoint: ${SUBGRAPH_URL}\n`);
}

main().catch(console.error);

