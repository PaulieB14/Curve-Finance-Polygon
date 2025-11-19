# Curve Finance Polygon Subgraph

A comprehensive, optimized subgraph for indexing Curve Finance pools, swaps, liquidity, and user positions on Polygon.

## 🎯 Best Practices Applied

This subgraph implements **all 7 best practices** from The Graph's official guidelines:

### 1. **Avoiding Large Arrays with @derivedFrom**

Instead of storing arrays directly on entities (which causes data duplication), we use `@derivedFrom` for reverse lookups:

```graphql
type Pool @entity {
  # ❌ BAD: transactions: [String!]!
  # ✅ GOOD: Use @derivedFrom
  swaps: [Swap!]! @derivedFrom(field: "pool")
  liquidityEvents: [LiquidityEvent!]! @derivedFrom(field: "pool")
}
```

**Why?** Graph Node tracks all entity changes for time-travel queries. Updating arrays creates complete copies, bloating the database.

### 2. **Minimizing eth_calls**

Token information (symbol, name, decimals) is cached on first access:

```typescript
// src/utils/entities.ts
export function getOrCreateToken(tokenAddress: Address): Token {
  let token = Token.load(tokenAddress.toHexString());
  
  if (token == null) {
    // Make eth_calls once and cache
    token.symbol = getTokenSymbol(tokenAddress);
    token.name = getTokenName(tokenAddress);
    token.decimals = getTokenDecimals(tokenAddress);
    token.save();
  }
  
  return token;
}
```

### 3. **Using Foreign Keys Instead of Embedded Data**

Entities reference each other by ID (foreign keys) rather than embedding data:

```typescript
let swap = new Swap(swapId);
swap.pool = pool.id;              // Foreign key, not embedded object
swap.buyer = user.id;             // Foreign key
swap.soldToken = soldToken.id;    // Foreign key
swap.boughtToken = boughtToken.id; // Foreign key
```

### 4. **Using loadRelated for Derived Entities**

When processing events, we use `loadRelated` to access derived relationships:

```typescript
// Load PoolToken entities using @derivedFrom relationship
let poolTokens = pool.tokens.load();

for (let i = 0; i < poolTokens.length; i++) {
  let poolToken = poolTokens[i];
  // Process each token...
}
```

### 5. **Proper Entity Normalization**

Complex relationships are normalized into separate entities:

```graphql
# Instead of storing token arrays in Pool:
type PoolToken @entity {
  id: ID!
  pool: Pool!
  token: Token!
  index: Int!
  balance: BigDecimal!
}
```

### 6. **Avoiding Data Duplication**

Instead of storing token amounts as arrays in `LiquidityEvent`, we create separate entities:

```graphql
type LiquidityEvent @entity {
  # ❌ BAD: tokenAmounts: [BigDecimal!]!
  # ✅ GOOD: Use separate entity
  tokenAmounts: [LiquidityTokenAmount!]! @derivedFrom(field: "liquidityEvent")
}

type LiquidityTokenAmount @entity {
  id: ID!
  liquidityEvent: LiquidityEvent!
  token: Token!
  amount: BigDecimal!
}
```

### 7. **Optimized for Time-Travel Queries**

All entities use immutable IDs and track temporal data:

```typescript
// Unique, immutable IDs
let swapId = event.transaction.hash.toHexString() + "-" + event.logIndex.toString();

// Track timestamps and blocks
swap.timestamp = event.block.timestamp;
swap.block = event.block.number;
```

## 📊 Data Tracked

- **Pools**: All StableSwap, TwoCrypto, and TriCrypto pools
- **Swaps**: Every token exchange with USD values
- **Liquidity Events**: Deposits, withdrawals, and position changes
- **User Positions**: LP token balances per user per pool
- **Snapshots**: Hourly and daily pool/protocol metrics
- **Tokens**: Comprehensive token metadata

## 🚀 Quick Start

### 1. Install Dependencies

```bash
cd curve-finance-polygon
yarn install
```

### 2. Get ABIs

You'll need to create ABI files in the `abis/` directory:

- `StableSwapFactory.json`
- `StableSwapPool.json`
- `TwoCryptoFactory.json`
- `TwoCryptoPool.json`
- `TriCryptoFactory.json`
- `TriCryptoPool.json`
- `ERC20.json`

You can get these from:
- Curve's GitHub: https://github.com/curvefi/curve-contract-polygon
- Polygonscan: Verify and download contract ABIs

### 3. Generate Code

```bash
yarn codegen
```

### 4. Build

```bash
yarn build
```

### 5. Authenticate

```bash
yarn auth
# Or manually:
graph auth --studio 197473b84a136c4b515a57659d8f710f
```

### 6. Deploy

```bash
yarn deploy
```

## 📝 Example Queries

### Get Pool with All Swaps

```graphql
query GetPoolSwaps {
  pool(id: "0x...") {
    name
    tvlUSD: totalValueLockedUSD
    volume: cumulativeVolumeUSD
    swaps(first: 10, orderBy: timestamp, orderDirection: desc) {
      buyer {
        address
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
    }
  }
}
```

### Get User Positions

```graphql
query GetUserPositions {
  user(id: "0x...") {
    positions {
      pool {
        name
      }
      lpTokenBalance
      valueUSD
    }
    swapCount
    totalVolumeUSD
  }
}
```

### Get Daily Protocol Metrics

```graphql
query GetProtocolDailyMetrics {
  protocolDaySnapshots(first: 30, orderBy: day, orderDirection: desc) {
    day
    totalValueLockedUSD
    dailyVolumeUSD
    dailyFeesUSD
    dailyUserCount
  }
}
```

## 🏗️ Architecture

```
curve-finance-polygon/
├── schema.graphql           # GraphQL schema (best practices applied)
├── subgraph.yaml           # Subgraph manifest
├── src/
│   ├── mappings/
│   │   ├── factory.ts      # Factory event handlers
│   │   └── pool.ts         # Pool event handlers (swaps, liquidity)
│   └── utils/
│       ├── constants.ts    # Constants
│       ├── helpers.ts      # Helper functions
│       └── entities.ts     # Entity creation/loading
└── abis/                   # Contract ABIs
```

## 📚 Resources

- [The Graph Docs](https://thegraph.com/docs/)
- [Curve Finance Docs](https://docs.curve.finance/)
- [Best Practices: Avoiding Large Arrays](https://thegraph.com/blog/...)
- [Curve Polygon Contracts](https://docs.curve.finance/deployments/integration/)

## 🔧 Contract Addresses (Polygon)

- **StableSwap-NG Factory**: `0x1764ee18e8B3ccA4787249Ceb249356192594585`
- **TwoCrypto-NG Factory**: `0x8D9A0b1E32c7B7682AD3Ef3E54308eEc88Ed0e9F`
- **TriCrypto-NG Factory**: `0xF9d5EF0A4A0f5b16ddF0C4dC81A8B0f7c1B5c8a3`
- **Address Provider**: `0x5ffe7FB82894076ECB99A30D6A32e969e6e35E98`

## 📄 License

MIT

