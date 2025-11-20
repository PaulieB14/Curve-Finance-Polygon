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
  const poolAddress = '0x5225010a0ae133b357861782b0b865a48471b2c5';
  
  console.log(`\n${'🔍'.repeat(40)}`);
  console.log(`DEBUGGING POOL LIQUIDITY EVENTS`);
  console.log(`${'🔍'.repeat(40)}\n`);
  console.log(`Pool: ${poolAddress}\n`);
  
  // Get all liquidity events
  const query = `{
    pool(id: "${poolAddress}") {
      name
      address
      totalValueLockedUSD
      tokens {
        token {
          symbol
          decimals
        }
        balance
        balanceUSD
      }
    }
    liquidityEvents(
      first: 10,
      orderBy: timestamp,
      orderDirection: desc,
      where: { pool: "${poolAddress}" }
    ) {
      id
      type
      timestamp
      lpTokenAmount
      tokenAmounts {
        token {
          symbol
          decimals
        }
        amount
        amountUSD
      }
    }
  }`;
  
  const result = await httpsPost(SUBGRAPH_URL, { query });
  
  if (result.data) {
    const { pool, liquidityEvents } = result.data;
    
    console.log(`📊 Current Pool State:`);
    console.log(`   Name: ${pool.name}`);
    console.log(`   TVL USD: $${parseFloat(pool.totalValueLockedUSD).toLocaleString()}\n`);
    
    console.log(`   Token Balances:\n`);
    pool.tokens.forEach((pt, i) => {
      console.log(`   ${i + 1}. ${pt.token.symbol} (${pt.token.decimals} decimals)`);
      console.log(`      Balance: ${pt.balance}`);
      console.log(`      Balance USD: $${parseFloat(pt.balanceUSD).toLocaleString()}\n`);
    });
    
    console.log(`\n${'='.repeat(80)}`);
    console.log(`📜 Recent Liquidity Events (last 10):\n`);
    
    liquidityEvents.forEach((event, idx) => {
      const date = new Date(parseInt(event.timestamp) * 1000);
      console.log(`${idx + 1}. ${event.type} - ${date.toISOString()}`);
      console.log(`   Event ID: ${event.id}`);
      console.log(`   LP Tokens: ${event.lpTokenAmount}`);
      
      if (event.tokenAmounts && event.tokenAmounts.length > 0) {
        console.log(`   Token Amounts:`);
        event.tokenAmounts.forEach(ta => {
          console.log(`      ${ta.token.symbol}: ${ta.amount} (USD: $${parseFloat(ta.amountUSD).toLocaleString()})`);
        });
      }
      console.log();
    });
    
    console.log(`\n${'='.repeat(80)}`);
    console.log(`💡 Analysis:\n`);
    
    // Check if ADDs and REMOVEs are balanced
    const adds = liquidityEvents.filter(e => e.type === 'ADD').length;
    const removes = liquidityEvents.filter(e => e.type === 'REMOVE').length;
    
    console.log(`   Total Events: ${liquidityEvents.length}`);
    console.log(`   ADD events: ${adds}`);
    console.log(`   REMOVE events: ${removes}\n`);
    
    // Check if any single event has huge USD amounts
    liquidityEvents.forEach(event => {
      if (event.tokenAmounts) {
        event.tokenAmounts.forEach(ta => {
          const usd = parseFloat(ta.amountUSD);
          if (usd > 1000000000) { // > $1 billion
            console.log(`   ⚠️  HUGE AMOUNT: ${event.type} - ${ta.token.symbol}: $${usd.toLocaleString()}`);
            console.log(`      Decimal amount: ${ta.amount}`);
            console.log(`      Event: ${event.id}\n`);
          }
        });
      }
    });
    
  } else if (result.errors) {
    console.log(`❌ Errors:`, result.errors);
  }
}

main().catch(console.error);

