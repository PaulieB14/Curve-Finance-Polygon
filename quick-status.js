#!/usr/bin/env node

const https = require('https');

const V3 = 'https://api.studio.thegraph.com/query/111767/curve-finance-polygon/v0.0.3';
const V4 = 'https://api.studio.thegraph.com/query/111767/curve-finance-polygon/v0.0.4';
const V5 = 'https://api.studio.thegraph.com/query/111767/curve-finance-polygon/v0.0.5';
const LATEST = 'https://api.studio.thegraph.com/query/111767/curve-finance-polygon/version/latest';

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
      },
      timeout: 5000
    };

    const req = https.request(options, (res) => {
      let responseData = '';
      res.on('data', (chunk) => responseData += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(responseData));
        } catch (e) {
          resolve({ error: 'parse_error' });
        }
      });
    });

    req.on('error', () => resolve({ error: 'network_error' }));
    req.on('timeout', () => resolve({ error: 'timeout' }));
    req.write(postData);
    req.end();
  });
}

async function checkVersion(url, label) {
  const query = `{
    _meta { block { number } deployment }
    pools(first: 1, orderBy: swapCount, orderDirection: desc) {
      totalValueLockedUSD
      cumulativeVolumeUSD
    }
  }`;
  
  const result = await httpsPost(url, { query });
  
  if (result.error || !result.data) {
    return { label, status: '❌ Not ready', block: 'N/A', tvl: 'N/A' };
  }
  
  const block = parseInt(result.data._meta.block.number);
  const tvl = result.data.pools.length > 0 ? parseFloat(result.data.pools[0].totalValueLockedUSD) : 0;
  
  let tvlDisplay;
  if (tvl > 1000000000000) {
    tvlDisplay = `$${(tvl / 1000000000000).toFixed(1)}T 🐛`;
  } else if (tvl > 1000000000) {
    tvlDisplay = `$${(tvl / 1000000000).toFixed(1)}B ⚠️`;
  } else if (tvl > 1000000) {
    tvlDisplay = `$${(tvl / 1000000).toFixed(1)}M`;
  } else {
    tvlDisplay = `$${tvl.toLocaleString()}`;
  }
  
  return { 
    label, 
    status: '✅ Live', 
    block: block.toLocaleString(), 
    tvl: tvlDisplay,
    deployment: result.data._meta.deployment
  };
}

async function main() {
  console.log(`\n${'⏱️ '.repeat(20)}`);
  console.log(`CHECKING SUBGRAPH STATUS...`);
  console.log(`${'⏱️ '.repeat(20)}\n`);
  
  const results = await Promise.all([
    checkVersion(V3, 'v0.0.3'),
    checkVersion(V4, 'v0.0.4'),
    checkVersion(V5, 'v0.0.5'),
    checkVersion(LATEST, '/latest')
  ]);
  
  console.log(`📊 Version Status:\n`);
  
  results.forEach(r => {
    console.log(`${r.label.padEnd(12)} ${r.status.padEnd(12)} Block: ${r.block.padEnd(15)} TVL: ${r.tvl}`);
  });
  
  console.log(`\n${'='.repeat(80)}\n`);
  
  const v5 = results.find(r => r.label === 'v0.0.5');
  const latest = results.find(r => r.label === '/latest');
  
  if (v5.status === '❌ Not ready') {
    console.log(`⏳ v0.0.5 is still deploying...`);
    console.log(`   This usually takes 10-20 minutes for the first sync.`);
    console.log(`   Try again in 10 minutes.\n`);
  } else {
    console.log(`✅ v0.0.5 is LIVE!`);
    console.log(`   Block: ${v5.block}`);
    console.log(`   TVL: ${v5.tvl}\n`);
    
    if (v5.tvl.includes('T') || v5.tvl.includes('B')) {
      console.log(`   🐛 TVL still looks wrong - might need more time to re-index\n`);
    } else {
      console.log(`   🎉 TVL looks reasonable! Run verify-tvl-fix.js for detailed check.\n`);
    }
  }
  
  if (latest.deployment && v5.deployment) {
    if (latest.deployment === v5.deployment) {
      console.log(`✅ /version/latest points to v0.0.5\n`);
    } else {
      console.log(`⏳ /version/latest still points to older version`);
      console.log(`   Latest deployment: ${latest.deployment.slice(0, 20)}...`);
      console.log(`   v0.0.5 deployment:  ${v5.deployment.slice(0, 20)}...\n`);
    }
  }
}

main().catch(console.error);

