# Deployment Instructions

## Your subgraph is ready! 🎉

**Build Status:** ✅ Complete
**IPFS Hash:** QmUbsQp4i2g2jsH9WF5de5ZaRgw4Jc7G2piATxhgAUToYh

## To Complete Deployment:

### 1. Create Subgraph in Studio
- Go to https://thegraph.com/studio/
- Click "Create a Subgraph"
- Name it (suggest: `curve-finance-polygon`)
- Select Network: **Polygon**

### 2. Deploy
After creating in Studio, they'll give you a slug. Then run:

```bash
cd /Users/paulbarba/curve-finance-polygon
graph deploy <YOUR-SUBGRAPH-SLUG-FROM-STUDIO> --version-label v0.0.1
```

Replace `<YOUR-SUBGRAPH-SLUG-FROM-STUDIO>` with the actual slug shown in Studio.

## Built With Best Practices:
✅ No large arrays (using @derivedFrom)
✅ Minimized eth_calls (token caching)  
✅ Foreign keys instead of embedded data
✅ Using loadRelated for derived entities
✅ Proper normalization
✅ No data duplication
✅ Optimized for time-travel queries

## What This Subgraph Tracks:
- All Curve pools (StableSwap, TwoCrypto, TriCrypto) on Polygon
- Swaps/exchanges with USD values
- Liquidity events (add/remove)
- User positions (LP balances)
- Hourly & daily snapshots
- Protocol-wide metrics

## Example Queries:

```graphql
# Get top pools by TVL
query TopPools {
  pools(first: 10, orderBy: totalValueLockedUSD, orderDirection: desc) {
    name
    poolType
    totalValueLockedUSD
    cumulativeVolumeUSD
  }
}

# Get user positions
query UserPositions($user: ID!) {
  user(id: $user) {
    positions {
      pool { name }
      lpTokenBalance
      valueUSD
    }
    swapCount
    totalVolumeUSD
  }
}
```

## Need Full Implementation ABIs?
The current ABIs have core events. For production, get full ABIs from:
- Polygonscan (verified contracts)
- Curve GitHub: https://github.com/curvefi/curve-contract-polygon

## Support:
- Curve Docs: https://docs.curve.finance/
- The Graph Docs: https://thegraph.com/docs/

