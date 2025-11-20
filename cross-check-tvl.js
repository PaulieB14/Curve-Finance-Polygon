#!/usr/bin/env node

const https = require('https');

const ETHERSCAN_API_KEY = '8X4YIZCEESWC88D8SNY16JH1SQ6FT2E2KK';
const SUBGRAPH_URL = 'https://api.studio.thegraph.com/query/111767/curve-finance-polygon/v0.0.4';

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

async function getPoolDetails(poolAddress) {
  // Get pool tokens from subgraph
  const query = `{
    pool(id: "${poolAddress.toLowerCase()}") {
      name
      address
      totalValueLockedUSD
      tokens {
        token {
          address
          symbol
          decimals
        }
        balance
        balanceUSD
      }
    }
  }`;
  
  return await httpsPost(SUBGRAPH_URL, { query });
}

async function getTokenBalance(tokenAddress, poolAddress) {
  const url = `https://api.etherscan.io/v2/api?chainid=137&module=account&action=tokenbalance&contractaddress=${tokenAddress}&address=${poolAddress}&tag=latest&apikey=${ETHERSCAN_API_KEY}`;
  return await httpsGet(url);
}

async function main() {
  console.log(`\n${'🔍'.repeat(35)}`);
  console.log(`CROSS-REFERENCE: Subgraph vs Polygonscan`);
  console.log(`${'🔍'.repeat(35)}\n`);
  
  // Check the pool with crazy TVL
  const poolAddress = '0x5225010a0ae133b357861782b0b865a48471b2c5';
  
  console.log(`📊 Analyzing Pool: ${poolAddress}\n`);
  
  // Get subgraph data
  const subgraphData = await getPoolDetails(poolAddress);
  
  if (subgraphData.data && subgraphData.data.pool) {
    const pool = subgraphData.data.pool;
    
    console.log(`🎯 Subgraph Data:`);
    console.log(`   Pool: ${pool.name}`);
    console.log(`   Total TVL USD: $${parseFloat(pool.totalValueLockedUSD).toLocaleString()}\n`);
    
    console.log(`   Pool Tokens:\n`);
    
    for (let i = 0; i < pool.tokens.length; i++) {
      const poolToken = pool.tokens[i];
      const token = poolToken.token;
      
      console.log(`   ${i + 1}. ${token.symbol} (${token.address})`);
      console.log(`      Decimals: ${token.decimals}`);
      console.log(`      Subgraph Balance: ${poolToken.balance}`);
      console.log(`      Subgraph Balance USD: $${parseFloat(poolToken.balanceUSD).toLocaleString()}`);
      
      // Get ACTUAL balance from Polygonscan
      console.log(`      Querying Polygonscan...`);
      const balanceData = await getTokenBalance(token.address, poolAddress);
      
      if (balanceData.result) {
        const actualBalance = balanceData.result;
        const decimals = parseInt(token.decimals);
        const actualBalanceDecimal = parseFloat(actualBalance) / Math.pow(10, decimals);
        
        console.log(`      ✅ Polygonscan Balance (raw): ${actualBalance}`);
        console.log(`      ✅ Polygonscan Balance (decimal): ${actualBalanceDecimal.toFixed(6)}`);
        
        // Compare
        const subgraphBalance = parseFloat(poolToken.balance);
        const difference = Math.abs(subgraphBalance - actualBalanceDecimal);
        const percentDiff = (difference / actualBalanceDecimal * 100).toFixed(2);
        
        if (difference < 0.01) {
          console.log(`      ✅ MATCH! Difference: ${difference.toFixed(10)}`);
        } else {
          console.log(`      ❌ MISMATCH! Difference: ${difference.toExponential(2)} (${percentDiff}%)`);
          console.log(`      🐛 Expected: ${actualBalanceDecimal.toFixed(6)}`);
          console.log(`      🐛 Got: ${subgraphBalance.toFixed(6)}`);
        }
      } else {
        console.log(`      ❌ Error getting balance from Polygonscan`);
      }
      
      console.log();
      
      // Rate limit respect
      await new Promise(resolve => setTimeout(resolve, 250));
    }
    
    console.log(`\n${'='.repeat(70)}`);
    console.log(`💡 DIAGNOSIS:`);
    console.log(`${'='.repeat(70)}\n`);
    
    const tvlUSD = parseFloat(pool.totalValueLockedUSD);
    if (tvlUSD > 1000000000000) {
      console.log(`❌ TVL is INSANELY HIGH ($${(tvlUSD / 1000000000000).toFixed(2)} TRILLION)`);
      console.log(`🐛 Likely issue: Decimal conversion error in balanceUSD calculation`);
      console.log(`🐛 poolToken.balanceUSD is probably NOT being divided by token decimals`);
      console.log(`🐛 Or it's being multiplied instead of divided somewhere\n`);
    }
    
  } else {
    console.log(`❌ Could not get pool data from subgraph`);
    if (subgraphData.errors) {
      console.log(`Errors:`, subgraphData.errors);
    }
  }
  
  console.log(`\n${'='.repeat(70)}\n`);
}

main().catch(console.error);

