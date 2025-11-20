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
          resolve({ error: 'parse_error', raw: responseData });
        }
      });
    });

    req.on('error', reject);
    req.write(postData);
    req.end();
  });
}

async function testQuery(name, query, checker) {
  try {
    const result = await httpsPost(SUBGRAPH_V5, { query });
    
    if (result.errors) {
      console.log(`   ❌ ${name}: Query error`);
      console.log(`      ${result.errors[0].message}\n`);
      return false;
    }
    
    if (!result.data) {
      console.log(`   ❌ ${name}: No data returned\n`);
      return false;
    }
    
    const checkResult = checker(result.data);
    if (checkResult === true) {
      console.log(`   ✅ ${name}\n`);
      return true;
    } else {
      console.log(`   ⚠️  ${name}: ${checkResult}\n`);
      return false;
    }
  } catch (error) {
    console.log(`   ❌ ${name}: ${error.message}\n`);
    return false;
  }
}

async function main() {
  console.log(`\n${'🧪'.repeat(40)}`);
  console.log(`TESTING ALL QUERIES (v0.0.5)`);
  console.log(`${'🧪'.repeat(40)}\n`);
  
  let passed = 0;
  let total = 0;
  
  // Test 1: Protocol stats
  total++;
  if (await testQuery(
    '1. Protocol Stats (curveProtocol)',
    `{
      curveProtocol(id: "curve-protocol") {
        totalValueLockedUSD
        totalVolumeUSD
        poolCount
        txCount
        userCount
      }
    }`,
    (data) => {
      if (!data.curveProtocol) return 'Protocol entity not found';
      const p = data.curveProtocol;
      console.log(`      Pools: ${p.poolCount}, Users: ${p.userCount}, Txs: ${p.txCount}`);
      console.log(`      Volume: $${parseFloat(p.totalVolumeUSD).toLocaleString()}`);
      console.log(`      TVL: $${parseFloat(p.totalValueLockedUSD).toLocaleString()}`);
      return true;
    }
  )) passed++;
  
  // Test 2: List pools
  total++;
  if (await testQuery(
    '2. List Pools (pools)',
    `{
      pools(first: 5, orderBy: swapCount, orderDirection: desc) {
        id
        name
        poolType
        swapCount
        cumulativeVolumeUSD
        totalValueLockedUSD
      }
    }`,
    (data) => {
      if (!data.pools || data.pools.length === 0) return 'No pools found';
      console.log(`      Found ${data.pools.length} pools`);
      console.log(`      Top pool: ${data.pools[0].name} (${data.pools[0].swapCount} swaps)`);
      return true;
    }
  )) passed++;
  
  // Test 3: Pool details with tokens
  total++;
  if (await testQuery(
    '3. Pool Details with Tokens',
    `{
      pools(first: 1) {
        name
        tokens {
          index
          token {
            symbol
            decimals
          }
          balance
          balanceUSD
        }
      }
    }`,
    (data) => {
      if (!data.pools || data.pools.length === 0) return 'No pools found';
      const pool = data.pools[0];
      if (!pool.tokens || pool.tokens.length === 0) return 'No tokens found';
      console.log(`      Pool: ${pool.name}`);
      console.log(`      Tokens: ${pool.tokens.map(t => t.token.symbol).join(', ')}`);
      return true;
    }
  )) passed++;
  
  // Test 4: Swaps with USD amounts
  total++;
  if (await testQuery(
    '4. Swaps with USD Amounts',
    `{
      swaps(first: 5, orderBy: timestamp, orderDirection: desc) {
        id
        soldToken { symbol }
        boughtToken { symbol }
        amountSold
        amountBought
        amountUSD
        timestamp
      }
    }`,
    (data) => {
      if (!data.swaps || data.swaps.length === 0) return 'No swaps found yet (still indexing)';
      const swap = data.swaps[0];
      console.log(`      Found ${data.swaps.length} recent swaps`);
      console.log(`      Latest: ${parseFloat(swap.amountSold).toFixed(4)} ${swap.soldToken.symbol} → ${swap.boughtToken.symbol}`);
      console.log(`      USD: $${parseFloat(swap.amountUSD).toFixed(2)}`);
      return true;
    }
  )) passed++;
  
  // Test 5: Liquidity events
  total++;
  if (await testQuery(
    '5. Liquidity Events',
    `{
      liquidityEvents(first: 5, orderBy: timestamp, orderDirection: desc) {
        id
        type
        lpTokenAmount
        timestamp
        tokenAmounts {
          token { symbol }
          amount
          amountUSD
        }
      }
    }`,
    (data) => {
      if (!data.liquidityEvents || data.liquidityEvents.length === 0) return 'No liquidity events yet';
      const event = data.liquidityEvents[0];
      console.log(`      Found ${data.liquidityEvents.length} recent events`);
      console.log(`      Latest: ${event.type} (${event.tokenAmounts.length} tokens)`);
      return true;
    }
  )) passed++;
  
  // Test 6: Users
  total++;
  if (await testQuery(
    '6. Users (top by volume)',
    `{
      users(first: 5, orderBy: totalVolumeUSD, orderDirection: desc) {
        id
        swapCount
        totalVolumeUSD
        positionCount
      }
    }`,
    (data) => {
      if (!data.users || data.users.length === 0) return 'No users found yet';
      console.log(`      Found ${data.users.length} users`);
      console.log(`      Top user: ${data.users[0].swapCount} swaps, $${parseFloat(data.users[0].totalVolumeUSD).toFixed(2)} volume`);
      return true;
    }
  )) passed++;
  
  // Test 7: Tokens
  total++;
  if (await testQuery(
    '7. Tokens',
    `{
      tokens(first: 5) {
        symbol
        name
        decimals
        address
      }
    }`,
    (data) => {
      if (!data.tokens || data.tokens.length === 0) return 'No tokens found';
      console.log(`      Found ${data.tokens.length} tokens`);
      console.log(`      Examples: ${data.tokens.map(t => t.symbol).join(', ')}`);
      return true;
    }
  )) passed++;
  
  // Test 8: Transactions
  total++;
  if (await testQuery(
    '8. Transactions',
    `{
      transactions(first: 5, orderBy: timestamp, orderDirection: desc) {
        id
        blockNumber
        timestamp
        gasUsed
      }
    }`,
    (data) => {
      if (!data.transactions || data.transactions.length === 0) return 'No transactions yet';
      console.log(`      Found ${data.transactions.length} transactions`);
      console.log(`      Latest: Block ${data.transactions[0].blockNumber}`);
      return true;
    }
  )) passed++;
  
  // Test 9: Positions (user positions in pools)
  total++;
  if (await testQuery(
    '9. User Positions',
    `{
      positions(first: 5, orderBy: lpTokenBalance, orderDirection: desc) {
        id
        user { id }
        pool { name }
        lpTokenBalance
        depositCount
      }
    }`,
    (data) => {
      if (!data.positions || data.positions.length === 0) return 'No positions found yet';
      console.log(`      Found ${data.positions.length} positions`);
      console.log(`      Top position: ${parseFloat(data.positions[0].lpTokenBalance).toFixed(2)} LP tokens`);
      return true;
    }
  )) passed++;
  
  // Test 10: Time-travel query (specific block)
  total++;
  if (await testQuery(
    '10. Time-Travel Query (block: 57000000)',
    `{
      pools(first: 1, block: { number: 57000000 }) {
        name
        swapCount
        totalValueLockedUSD
      }
    }`,
    (data) => {
      if (!data.pools) return 'Time-travel query failed';
      console.log(`      Time-travel working! Found ${data.pools.length} pools at block 57M`);
      return true;
    }
  )) passed++;
  
  console.log(`${'='.repeat(80)}`);
  console.log(`📊 RESULTS: ${passed}/${total} queries working\n`);
  
  if (passed === total) {
    console.log(`🎉 ALL QUERIES WORKING PERFECTLY!\n`);
  } else if (passed >= total - 2) {
    console.log(`✅ Most queries working! (Some entities still indexing)\n`);
  } else {
    console.log(`⚠️  Some queries failing. Subgraph might still be syncing.\n`);
  }
  
  console.log(`${'='.repeat(80)}\n`);
}

main().catch(console.error);

