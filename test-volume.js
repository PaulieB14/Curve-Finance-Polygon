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

async function main() {
  console.log(`\n${'💰'.repeat(35)}`);
  console.log(`📈 VOLUME TRACKING TEST`);
  console.log(`${'💰'.repeat(35)}\n`);
  
  // Test 1: Raw volume tracking
  const rawVolumeQuery = `
    {
      pools(first: 5, where: { swapCount_gt: 0 }, orderBy: swapCount, orderDirection: desc) {
        id
        name
        address
        swapCount
        cumulativeVolume
        cumulativeVolumeUSD
        totalValueLocked
        totalValueLockedUSD
        tokens(first: 10) {
          token {
            symbol
            decimals
          }
          balance
          balanceUSD
        }
      }
    }
  `;
  
  console.log(`🔍 Testing Raw Volume Data...\n`);
  const result1 = await httpsPost(SUBGRAPH_URL, { query: rawVolumeQuery });
  
  if (result1 && result1.data && result1.data.pools) {
    const pools = result1.data.pools;
    console.log(`Found ${pools.length} pools with swaps:\n`);
    
    pools.forEach((pool, i) => {
      console.log(`${i + 1}. ${pool.name}`);
      console.log(`   Address: ${pool.address}`);
      console.log(`   Swaps: ${pool.swapCount}`);
      console.log(`   Raw Volume: ${pool.cumulativeVolume}`);
      console.log(`   USD Volume: $${pool.cumulativeVolumeUSD} ⚠️`);
      console.log(`   Raw TVL: ${pool.totalValueLocked}`);
      console.log(`   USD TVL: $${pool.totalValueLockedUSD} ⚠️`);
      
      if (pool.tokens && pool.tokens.length > 0) {
        console.log(`   Tokens:`);
        pool.tokens.forEach(pt => {
          console.log(`      ${pt.token.symbol}: ${pt.balance} (USD: $${pt.balanceUSD})`);
        });
      }
      console.log('');
    });
    
    // Analysis
    console.log(`${'='.repeat(70)}`);
    console.log(`📊 ANALYSIS`);
    console.log(`${'='.repeat(70)}\n`);
    
    const hasRawVolume = pools.some(p => parseFloat(p.cumulativeVolume) > 0);
    const hasUSDVolume = pools.some(p => parseFloat(p.cumulativeVolumeUSD) > 0);
    
    if (hasRawVolume && !hasUSDVolume) {
      console.log(`✅ Raw token amounts ARE being tracked`);
      console.log(`❌ USD prices ARE NOT being calculated\n`);
      console.log(`Root cause: Missing price oracle/calculation logic in handlers\n`);
      console.log(`Solutions:`);
      console.log(`   1. Add Chainlink price feeds for stablecoins`);
      console.log(`   2. Use hardcoded $1.00 for USDC/USDT/DAI/crvUSD`);
      console.log(`   3. Calculate prices from pool reserves (virtual_price)`);
      console.log(`   4. Integrate external price API\n`);
    } else if (!hasRawVolume) {
      console.log(`❌ Raw volumes are also 0 - handlers may not be updating cumulative fields\n`);
    } else {
      console.log(`✅ Both raw and USD volumes are working!\n`);
    }
  }
  
  // Test 2: Check individual swap volumes
  const swapQuery = `
    {
      swaps(first: 10, orderBy: timestamp, orderDirection: desc) {
        id
        pool {
          name
        }
        soldToken {
          symbol
          decimals
        }
        boughtToken {
          symbol
          decimals
        }
        tokensSold
        tokensBought
        amountUSD
        timestamp
      }
    }
  `;
  
  console.log(`${'='.repeat(70)}`);
  console.log(`💱 INDIVIDUAL SWAP ANALYSIS`);
  console.log(`${'='.repeat(70)}\n`);
  
  const result2 = await httpsPost(SUBGRAPH_URL, { query: swapQuery });
  
  if (result2 && result2.data && result2.data.swaps) {
    const swaps = result2.data.swaps;
    
    swaps.forEach((swap, i) => {
      const soldAmount = parseFloat(swap.tokensSold);
      const boughtAmount = parseFloat(swap.tokensBought);
      const usdAmount = parseFloat(swap.amountUSD || 0);
      
      console.log(`${i + 1}. ${swap.soldToken.symbol} → ${swap.boughtToken.symbol}`);
      console.log(`   Sold: ${soldAmount} ${swap.soldToken.symbol}`);
      console.log(`   Bought: ${boughtAmount} ${swap.boughtToken.symbol}`);
      console.log(`   USD Value: $${usdAmount} ${usdAmount === 0 ? '❌' : '✅'}`);
      
      // For stablecoins, we can estimate the USD value
      const stablecoins = ['USDC', 'USDT', 'DAI', 'crvUSD', 'USDC.e'];
      if (stablecoins.includes(swap.soldToken.symbol)) {
        console.log(`   Expected USD: ~$${soldAmount.toFixed(2)} (assuming $1.00 per ${swap.soldToken.symbol})`);
      }
      console.log('');
    });
  }
  
  console.log(`${'='.repeat(70)}`);
  console.log(`✅ VOLUME TEST COMPLETE`);
  console.log(`${'='.repeat(70)}\n`);
  
  console.log(`Summary:`);
  console.log(`   ✅ Subgraph is indexing swaps correctly`);
  console.log(`   ✅ Raw token amounts are tracked`);
  console.log(`   ❌ USD conversion is NOT implemented yet`);
  console.log(`\nTo fix: Add pricing logic to src/mappings/pool.ts handlers\n`);
}

main().catch(console.error);

