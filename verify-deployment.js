#!/usr/bin/env node

const https = require('https');

// Configuration
const ETHERSCAN_API_KEY = '8X4YIZCEESWC88D8SNY16JH1SQ6FT2E2KK';
const SUBGRAPH_URL = 'https://api.studio.thegraph.com/query/111767/curve-finance-polygon/v0.0.2';

// Factory contracts
const FACTORIES = {
  stableSwap: {
    address: '0x1764ee18e8B3ccA4787249Ceb249356192594585',
    startBlock: 43875489,
    name: 'StableSwap-NG'
  },
  twoCrypto: {
    address: '0x8D9A0b1E32c7B7682AD3Ef3E54308eEc88Ed0e9F',
    startBlock: 50309785,
    name: 'TwoCrypto-NG'
  },
  triCrypto: {
    address: '0xF9d5EF0A4A0f5b16ddF0C4dC81A8B0f7c1B5c8a3',
    startBlock: 48000000,
    name: 'TriCrypto-NG'
  }
};

// Helper function to make HTTPS requests
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

// Helper function to make POST requests (for GraphQL)
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

// Query Etherscan API
async function queryEtherscan(module, action, params = {}) {
  const baseUrl = 'https://api.etherscan.io/v2/api';
  const queryParams = new URLSearchParams({
    chainid: '137',
    module,
    action,
    apikey: ETHERSCAN_API_KEY,
    ...params
  });
  
  const url = `${baseUrl}?${queryParams}`;
  console.log(`🔍 Querying Etherscan: ${module}.${action}`);
  
  try {
    const result = await httpsGet(url);
    return result;
  } catch (error) {
    console.error(`❌ Error querying Etherscan:`, error.message);
    return null;
  }
}

// Query The Graph
async function querySubgraph(query) {
  console.log(`📊 Querying Subgraph...`);
  
  try {
    const result = await httpsPost(SUBGRAPH_URL, { query });
    return result;
  } catch (error) {
    console.error(`❌ Error querying subgraph:`, error.message);
    return null;
  }
}

// Check factory transaction count
async function checkFactoryTransactions(factory) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`📦 Checking ${factory.name} Factory`);
  console.log(`Address: ${factory.address}`);
  console.log(`Start Block: ${factory.startBlock}`);
  console.log(`${'='.repeat(60)}`);
  
  const txData = await queryEtherscan('account', 'txlist', {
    address: factory.address,
    startblock: factory.startBlock,
    endblock: 99999999,
    page: 1,
    offset: 5,
    sort: 'desc'
  });
  
  if (txData && txData.result) {
    console.log(`✅ Found ${txData.result.length} recent transactions`);
    
    if (txData.result.length > 0) {
      const latestTx = txData.result[0];
      console.log(`   Latest TX: ${latestTx.hash}`);
      console.log(`   Block: ${latestTx.blockNumber}`);
      console.log(`   Time: ${new Date(parseInt(latestTx.timeStamp) * 1000).toLocaleString()}`);
      console.log(`   From: ${latestTx.from}`);
    }
    
    return txData.result;
  } else {
    console.log(`❌ No transactions found or API error`);
    return [];
  }
}

// Check factory event logs
async function checkFactoryLogs(factory) {
  console.log(`\n📋 Checking Event Logs...`);
  
  const logsData = await queryEtherscan('logs', 'getLogs', {
    address: factory.address,
    fromBlock: factory.startBlock,
    toBlock: 'latest',
    page: 1,
    offset: 5
  });
  
  if (logsData && logsData.result) {
    console.log(`✅ Found ${logsData.result.length} recent events`);
    
    logsData.result.forEach((log, i) => {
      console.log(`   Event ${i + 1}: Block ${log.blockNumber}, Topics: ${log.topics.length}`);
    });
    
    return logsData.result;
  } else {
    console.log(`❌ No events found or API error`);
    return [];
  }
}

// Query subgraph meta info
async function checkSubgraphStatus() {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`🎯 SUBGRAPH STATUS CHECK`);
  console.log(`${'='.repeat(60)}`);
  
  const query = `
    {
      _meta {
        block {
          number
          hash
        }
        hasIndexingErrors
        deployment
      }
    }
  `;
  
  const result = await querySubgraph(query);
  
  if (result && result.data && result.data._meta) {
    const meta = result.data._meta;
    console.log(`✅ Subgraph is live!`);
    console.log(`   Current Block: ${meta.block.number}`);
    console.log(`   Block Hash: ${meta.block.hash}`);
    console.log(`   Has Errors: ${meta.hasIndexingErrors ? '❌ YES' : '✅ NO'}`);
    console.log(`   Deployment: ${meta.deployment}`);
    return meta;
  } else if (result && result.errors) {
    console.log(`❌ Subgraph has errors:`);
    result.errors.forEach(err => console.log(`   - ${err.message}`));
    return null;
  } else {
    console.log(`❌ Cannot reach subgraph`);
    return null;
  }
}

// Query subgraph entities
async function checkSubgraphEntities() {
  console.log(`\n📊 Checking Subgraph Entities...`);
  
  const query = `
    {
      curveProtocols(first: 1) {
        id
        totalPools
        totalVolumeUSD
      }
      pools(first: 5, orderBy: createdTimestamp, orderDirection: desc) {
        id
        name
        address
        poolType
        coins
        createdTimestamp
        swapCount
        totalVolumeUSD
      }
      swaps(first: 5, orderBy: timestamp, orderDirection: desc) {
        id
        pool {
          name
        }
        buyer
        amountIn
        amountOut
        timestamp
      }
    }
  `;
  
  const result = await querySubgraph(query);
  
  if (result && result.data) {
    const { curveProtocols, pools, swaps } = result.data;
    
    console.log(`\n📈 Protocol Stats:`);
    if (curveProtocols && curveProtocols.length > 0) {
      const protocol = curveProtocols[0];
      console.log(`   Total Pools: ${protocol.totalPools}`);
      console.log(`   Total Volume: $${protocol.totalVolumeUSD}`);
    } else {
      console.log(`   ⚠️  No protocol entity found`);
    }
    
    console.log(`\n🏊 Pools Found: ${pools ? pools.length : 0}`);
    if (pools && pools.length > 0) {
      pools.forEach((pool, i) => {
        console.log(`   ${i + 1}. ${pool.name || 'Unnamed'} (${pool.poolType})`);
        console.log(`      Address: ${pool.address}`);
        console.log(`      Coins: ${pool.coins.length}`);
        console.log(`      Swaps: ${pool.swapCount}`);
        console.log(`      Volume: $${pool.totalVolumeUSD}`);
      });
    } else {
      console.log(`   ⚠️  No pools indexed yet`);
    }
    
    console.log(`\n💱 Swaps Found: ${swaps ? swaps.length : 0}`);
    if (swaps && swaps.length > 0) {
      swaps.forEach((swap, i) => {
        console.log(`   ${i + 1}. Pool: ${swap.pool.name}`);
        console.log(`      Amount In: ${swap.amountIn}`);
        console.log(`      Amount Out: ${swap.amountOut}`);
      });
    } else {
      console.log(`   ⚠️  No swaps indexed yet`);
    }
    
    return result.data;
  } else if (result && result.errors) {
    console.log(`❌ Query errors:`);
    result.errors.forEach(err => console.log(`   - ${err.message}`));
    return null;
  } else {
    console.log(`❌ Cannot query entities`);
    return null;
  }
}

// Get current Polygon block
async function getCurrentBlock() {
  console.log(`\n🔗 Getting Current Polygon Block...`);
  
  const blockData = await queryEtherscan('proxy', 'eth_blockNumber', {});
  
  if (blockData && blockData.result) {
    const blockNumber = parseInt(blockData.result, 16);
    console.log(`   Current Block: ${blockNumber.toLocaleString()}`);
    return blockNumber;
  } else {
    console.log(`   ⚠️  Cannot fetch current block`);
    return null;
  }
}

// Compare subgraph vs on-chain
async function compareData(subgraphMeta, currentBlock) {
  if (!subgraphMeta || !currentBlock) return;
  
  console.log(`\n${'='.repeat(60)}`);
  console.log(`🔄 SYNC STATUS COMPARISON`);
  console.log(`${'='.repeat(60)}`);
  
  const subgraphBlock = parseInt(subgraphMeta.block.number);
  const blocksBehind = currentBlock - subgraphBlock;
  const percentSynced = ((subgraphBlock / currentBlock) * 100).toFixed(2);
  
  console.log(`   Subgraph Block: ${subgraphBlock.toLocaleString()}`);
  console.log(`   Current Block:  ${currentBlock.toLocaleString()}`);
  console.log(`   Blocks Behind:  ${blocksBehind.toLocaleString()}`);
  console.log(`   Progress:       ${percentSynced}%`);
  
  if (blocksBehind > 1000) {
    console.log(`   ⏳ Still syncing... (${blocksBehind} blocks to go)`);
  } else if (blocksBehind > 100) {
    console.log(`   🚀 Almost there! (${blocksBehind} blocks to go)`);
  } else {
    console.log(`   ✅ Fully synced!`);
  }
  
  // Calculate ETA (assuming ~2 seconds per block on Polygon)
  const secondsBehind = blocksBehind * 2;
  const minutesBehind = Math.floor(secondsBehind / 60);
  
  if (minutesBehind > 60) {
    console.log(`   ⏰ ETA: ~${Math.floor(minutesBehind / 60)} hours ${minutesBehind % 60} minutes`);
  } else if (minutesBehind > 0) {
    console.log(`   ⏰ ETA: ~${minutesBehind} minutes`);
  } else {
    console.log(`   ⏰ ETA: Less than a minute!`);
  }
}

// Main execution
async function main() {
  console.log(`\n${'🔥'.repeat(30)}`);
  console.log(`🚀 CURVE FINANCE POLYGON SUBGRAPH VERIFICATION`);
  console.log(`${'🔥'.repeat(30)}\n`);
  
  // Step 1: Check current block
  const currentBlock = await getCurrentBlock();
  
  // Step 2: Check subgraph status
  const subgraphMeta = await checkSubgraphStatus();
  
  // Step 3: Compare sync status
  await compareData(subgraphMeta, currentBlock);
  
  // Step 4: Check each factory on-chain
  for (const [key, factory] of Object.entries(FACTORIES)) {
    await checkFactoryTransactions(factory);
    await checkFactoryLogs(factory);
    
    // Respect API rate limits (5 calls/second)
    await new Promise(resolve => setTimeout(resolve, 250));
  }
  
  // Step 5: Check subgraph entities
  await checkSubgraphEntities();
  
  // Final summary
  console.log(`\n${'='.repeat(60)}`);
  console.log(`✅ VERIFICATION COMPLETE`);
  console.log(`${'='.repeat(60)}\n`);
  
  console.log(`📝 Summary:`);
  console.log(`   - Subgraph URL: ${SUBGRAPH_URL}`);
  console.log(`   - Check Studio: https://thegraph.com/studio/subgraph/curve-finance-polygon`);
  console.log(`   - GitHub Repo: https://github.com/PaulieB14/Curve-Finance-Polygon\n`);
}

// Run the verification
main().catch(console.error);

