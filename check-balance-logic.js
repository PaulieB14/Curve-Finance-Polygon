#!/usr/bin/env node

const https = require('https');

const SUBGRAPH_V5 = 'https://api.studio.thegraph.com/query/111767/curve-finance-polygon/v0.0.5';

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
  console.log(`\n${'📊'.repeat(40)}`);
  console.log(`CHECKING BALANCE ACCUMULATION LOGIC`);
  console.log(`${'📊'.repeat(40)}\n`);
  
  const poolAddress = '0x5225010a0ae133b357861782b0b865a48471b2c5';
  
  // Get recent liquidity events
  const query = `{
    _meta { block { number } }
    pool(id: "${poolAddress}") {
      name
      totalValueLockedUSD
      tokens {
        index
        token { symbol decimals }
        balance
        balanceUSD
      }
    }
    liquidityEvents(
      first: 20,
      orderBy: timestamp,
      orderDirection: desc,
      where: { pool: "${poolAddress}" }
    ) {
      id
      type
      timestamp
      block
      lpTokenAmount
      tokenAmounts {
        index
        token { symbol decimals }
        amount
        amountUSD
      }
    }
  }`;
  
  const result = await httpsPost(SUBGRAPH_V5, { query });
  
  if (!result.data) {
    console.log(`❌ Could not query subgraph\n`);
    return;
  }
  
  const { _meta, pool, liquidityEvents } = result.data;
  
  console.log(`🎯 Current State (Block ${parseInt(_meta.block.number).toLocaleString()}):\n`);
  console.log(`Pool: ${pool.name}`);
  console.log(`TVL: $${parseFloat(pool.totalValueLockedUSD).toLocaleString()}\n`);
  
  console.log(`Token Balances:\n`);
  pool.tokens.sort((a, b) => a.index - b.index).forEach(pt => {
    console.log(`  ${pt.index}. ${pt.token.symbol}: ${parseFloat(pt.balance).toFixed(6)} ($${parseFloat(pt.balanceUSD).toLocaleString()})`);
  });
  
  console.log(`\n${'='.repeat(80)}`);
  console.log(`📜 Recent Liquidity Events (last 20):\n`);
  
  // Calculate net change from events
  const netChange = { 0: 0, 1: 0 };
  
  liquidityEvents.forEach((event, idx) => {
    const date = new Date(parseInt(event.timestamp) * 1000);
    console.log(`${idx + 1}. ${event.type} - Block ${event.block} - ${date.toISOString().slice(0, 16)}`);
    
    if (event.tokenAmounts && event.tokenAmounts.length > 0) {
      event.tokenAmounts.forEach(ta => {
        const amount = parseFloat(ta.amount);
        const sign = event.type === 'ADD' ? '+' : '-';
        console.log(`   ${sign} ${ta.token.symbol}: ${amount.toFixed(6)}`);
        
        // Track net change
        if (event.type === 'ADD') {
          netChange[ta.index] += amount;
        } else {
          netChange[ta.index] -= amount;
        }
      });
    }
    console.log();
  });
  
  console.log(`${'='.repeat(80)}`);
  console.log(`💡 Net Change from Last 20 Events:\n`);
  
  pool.tokens.sort((a, b) => a.index - b.index).forEach(pt => {
    const change = netChange[pt.index] || 0;
    console.log(`  ${pt.token.symbol}: ${change > 0 ? '+' : ''}${change.toFixed(6)}`);
  });
  
  console.log(`\n${'='.repeat(80)}`);
  console.log(`🔍 Analysis:\n`);
  
  const tvl = parseFloat(pool.totalValueLockedUSD);
  
  if (tvl > 1000000000000) {
    console.log(`❌ TVL is BROKEN ($${(tvl / 1000000000000).toFixed(2)} TRILLION)`);
    console.log(`   The index matching bug is still present!\n`);
  } else if (tvl > 1000000000) {
    console.log(`⚠️  TVL seems high ($${(tvl / 1000000000).toFixed(2)} BILLION)`);
    console.log(`   Might be accumulating incorrectly.\n`);
  } else {
    console.log(`✅ TVL is in reasonable range ($${tvl.toLocaleString()})`);
    console.log(`   Index matching fix appears to be working!\n`);
    
    // Check if adds are > removes
    const adds = liquidityEvents.filter(e => e.type === 'ADD').length;
    const removes = liquidityEvents.filter(e => e.type === 'REMOVE' || e.type === 'REMOVE_ONE' || e.type === 'REMOVE_IMBALANCE').length;
    
    console.log(`   Recent activity: ${adds} ADDs, ${removes} REMOVEs`);
    
    if (adds > removes) {
      console.log(`   ℹ️  More ADDs than REMOVEs explains positive balance\n`);
    }
  }
}

main().catch(console.error);

