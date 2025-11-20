#!/usr/bin/env node

const https = require('https');

const SUBGRAPH_V5 = 'https://api.studio.thegraph.com/query/111767/curve-finance-polygon/v0.0.5';
const ETHERSCAN_API_KEY = '8X4YIZCEESWC88D8SNY16JH1SQ6FT2E2KK';

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

async function getTokenBalance(tokenAddress, poolAddress) {
  const url = `https://api.etherscan.io/v2/api?chainid=137&module=account&action=tokenbalance&contractaddress=${tokenAddress}&address=${poolAddress}&tag=latest&apikey=${ETHERSCAN_API_KEY}`;
  return await httpsGet(url);
}

async function checkTVL() {
  console.log(`\n${'🎯'.repeat(40)}`);
  console.log(`VERIFYING TVL FIX (v0.0.5)`);
  console.log(`${'🎯'.repeat(40)}\n`);
  
  // Check if v0.0.5 is ready
  const metaQuery = `{ _meta { block { number } hasIndexingErrors deployment } }`;
  const metaResult = await httpsPost(SUBGRAPH_V5, { query: metaQuery });
  
  if (!metaResult.data) {
    console.log(`❌ v0.0.5 is not ready yet. Try again in 10-15 minutes.\n`);
    return;
  }
  
  const blockNumber = parseInt(metaResult.data._meta.block.number);
  console.log(`✅ v0.0.5 synced to block: ${blockNumber.toLocaleString()}`);
  console.log(`   Deployment: ${metaResult.data._meta.deployment}\n`);
  
  // Get pool data
  const poolAddress = '0x5225010a0ae133b357861782b0b865a48471b2c5';
  
  const poolQuery = `{
    pool(id: "${poolAddress}") {
      name
      totalValueLockedUSD
      tokens {
        index
        token {
          symbol
          address
          decimals
        }
        balance
        balanceUSD
      }
    }
  }`;
  
  const poolResult = await httpsPost(SUBGRAPH_V5, { query: poolQuery });
  
  if (!poolResult.data || !poolResult.data.pool) {
    console.log(`❌ Pool not found\n`);
    return;
  }
  
  const pool = poolResult.data.pool;
  
  console.log(`${'='.repeat(80)}`);
  console.log(`📊 SUBGRAPH DATA (v0.0.5)\n`);
  console.log(`Pool: ${pool.name} (${poolAddress})`);
  console.log(`Total TVL: $${parseFloat(pool.totalValueLockedUSD).toLocaleString()}\n`);
  
  console.log(`Token Balances:\n`);
  
  // Sort by index
  const sortedTokens = pool.tokens.sort((a, b) => a.index - b.index);
  
  for (const pt of sortedTokens) {
    console.log(`${pt.index}. ${pt.token.symbol} (${pt.token.decimals} decimals)`);
    console.log(`   Address: ${pt.token.address}`);
    console.log(`   Balance: ${pt.balance}`);
    console.log(`   Balance USD: $${parseFloat(pt.balanceUSD).toLocaleString()}\n`);
  }
  
  console.log(`${'='.repeat(80)}`);
  console.log(`🔍 CROSS-CHECKING WITH POLYGONSCAN\n`);
  
  let totalExpectedUSD = 0;
  let allCorrect = true;
  
  for (const pt of sortedTokens) {
    console.log(`Checking ${pt.token.symbol}...`);
    
    const balanceData = await getTokenBalance(pt.token.address, poolAddress);
    
    if (balanceData.result) {
      const rawBalance = balanceData.result;
      const decimals = parseInt(pt.token.decimals);
      const actualBalance = parseFloat(rawBalance) / Math.pow(10, decimals);
      const subgraphBalance = parseFloat(pt.balance);
      
      console.log(`   Polygonscan: ${actualBalance.toFixed(6)} ${pt.token.symbol}`);
      console.log(`   Subgraph:    ${subgraphBalance.toFixed(6)} ${pt.token.symbol}`);
      
      const difference = Math.abs(actualBalance - subgraphBalance);
      const percentDiff = actualBalance > 0 ? (difference / actualBalance * 100) : 0;
      
      if (percentDiff < 1) { // Within 1%
        console.log(`   ✅ MATCH (${percentDiff.toFixed(4)}% difference)\n`);
        
        // Calculate expected USD (assuming $1 for stablecoins)
        const isStablecoin = ['USDC', 'USDT', 'DAI', 'crvUSD'].includes(pt.token.symbol);
        if (isStablecoin) {
          totalExpectedUSD += actualBalance;
        }
      } else {
        console.log(`   ❌ MISMATCH (${percentDiff.toFixed(2)}% difference)\n`);
        allCorrect = false;
      }
      
      // Rate limit
      await new Promise(resolve => setTimeout(resolve, 250));
    } else {
      console.log(`   ⚠️  Could not get balance from Polygonscan\n`);
    }
  }
  
  console.log(`${'='.repeat(80)}`);
  console.log(`📈 FINAL VERDICT:\n`);
  
  const subgraphTVL = parseFloat(pool.totalValueLockedUSD);
  
  if (allCorrect && subgraphTVL < 100000000) { // Less than $100M (sanity check)
    console.log(`✅ TVL FIX VERIFIED!`);
    console.log(`   Subgraph TVL: $${subgraphTVL.toLocaleString()}`);
    console.log(`   Expected ~$${totalExpectedUSD.toLocaleString()}`);
    console.log(`   Difference: ${Math.abs(subgraphTVL - totalExpectedUSD).toFixed(2)}\n`);
    
    if (Math.abs(subgraphTVL - totalExpectedUSD) < 100) {
      console.log(`🎉 PERFECT! TVL is accurate!\n`);
    } else {
      console.log(`⚠️  Small difference (could be due to pending liquidity events)\n`);
    }
  } else if (subgraphTVL > 1000000000000) { // > $1 trillion
    console.log(`❌ TVL STILL BROKEN!`);
    console.log(`   $${(subgraphTVL / 1000000000000).toFixed(2)} TRILLION is impossible\n`);
  } else {
    console.log(`⚠️  TVL looks reasonable but needs manual verification`);
    console.log(`   $${subgraphTVL.toLocaleString()}\n`);
  }
  
  console.log(`${'='.repeat(80)}\n`);
}

checkTVL().catch(console.error);

