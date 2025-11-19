import { Address, BigInt, log } from "@graphprotocol/graph-ts";
import {
  PlainPoolDeployed,
  MetaPoolDeployed,
} from "../../generated/StableSwapFactory/StableSwapFactory";
import {
  TwocryptoPoolDeployed,
} from "../../generated/TwoCryptoFactory/TwoCryptoFactory";
import {
  TricryptoPoolDeployed,
} from "../../generated/TriCryptoFactory/TriCryptoFactory";
import { Pool } from "../../generated/schema";
import {
  StableSwapPool as StableSwapPoolTemplate,
  TwoCryptoPool as TwoCryptoPoolTemplate,
  TriCryptoPool as TriCryptoPoolTemplate,
} from "../../generated/templates";
import {
  getOrCreateProtocol,
  getOrCreateToken,
  createPoolToken,
} from "../utils/entities";
import { ZERO_BI, ZERO_BD, ONE_BI } from "../utils/constants";

/**
 * Handle StableSwap Plain Pool Deployed
 * Best Practice: Create normalized entities with foreign keys
 */
export function handlePlainPoolDeployed(event: PlainPoolDeployed): void {
  let poolAddress = event.params.pool;
  let coins = event.params.coins;
  
  // Create pool entity
  let pool = new Pool(poolAddress.toHexString());
  pool.protocol = "curve-finance-polygon";
  pool.address = poolAddress;
  pool.poolType = "STABLESWAP";
  pool.name = "Curve StableSwap Pool";
  pool.symbol = null;
  
  // Pool parameters
  pool.lpToken = poolAddress; // For plain pools, pool is LP token
  pool.lpTokenSupply = ZERO_BD;
  pool.A = event.params.A;
  pool.fee = event.params.fee;
  pool.adminFee = ZERO_BI; // Will be fetched from pool contract
  pool.offpegFeeMultiplier = null;
  
  // Pricing
  pool.virtualPrice = ZERO_BD;
  
  // Liquidity
  pool.totalValueLocked = ZERO_BD;
  pool.totalValueLockedUSD = ZERO_BD;
  
  // Volume & Fees
  pool.cumulativeVolume = ZERO_BD;
  pool.cumulativeVolumeUSD = ZERO_BD;
  pool.cumulativeFees = ZERO_BD;
  pool.cumulativeFeesUSD = ZERO_BD;
  
  // Activity
  pool.txCount = ZERO_BI;
  pool.swapCount = ZERO_BI;
  
  // Metadata
  pool.createdAt = event.block.timestamp;
  pool.createdAtBlock = event.block.number;
  pool.createdAtTransaction = event.transaction.hash;
  
  pool.save();
  
  // Best Practice #6: Create PoolToken entities instead of storing array
  // This normalizes the many-to-many relationship
  for (let i = 0; i < coins.length; i++) {
    let coinAddress = coins[i];
    
    // Skip zero addresses
    if (coinAddress.toHexString() == "0x0000000000000000000000000000000000000000") {
      break;
    }
    
    // Best Practice #2: Cache token info to minimize eth_calls
    let token = getOrCreateToken(coinAddress);
    
    // Create PoolToken relationship (Best Practice #6)
    createPoolToken(poolAddress, coinAddress, i, false);
  }
  
  // Update protocol
  let protocol = getOrCreateProtocol();
  protocol.poolCount = protocol.poolCount.plus(ONE_BI);
  protocol.save();
  
  // Start indexing pool events
  StableSwapPoolTemplate.create(poolAddress);
  
  log.info("StableSwap Pool deployed: {}", [poolAddress.toHexString()]);
}

/**
 * Handle StableSwap Meta Pool Deployed
 */
export function handleMetaPoolDeployed(event: MetaPoolDeployed): void {
  let poolAddress = event.params.pool;
  let coin = event.params.coin;
  let basePool = event.params.base_pool;
  
  let pool = new Pool(poolAddress.toHexString());
  pool.protocol = "curve-finance-polygon";
  pool.address = poolAddress;
  pool.poolType = "STABLESWAP";
  pool.name = "Curve MetaPool";
  pool.symbol = null;
  
  pool.lpToken = poolAddress;
  pool.lpTokenSupply = ZERO_BD;
  pool.A = event.params.A;
  pool.fee = event.params.fee;
  pool.adminFee = ZERO_BI;
  pool.offpegFeeMultiplier = null;
  
  pool.virtualPrice = ZERO_BD;
  pool.totalValueLocked = ZERO_BD;
  pool.totalValueLockedUSD = ZERO_BD;
  pool.cumulativeVolume = ZERO_BD;
  pool.cumulativeVolumeUSD = ZERO_BD;
  pool.cumulativeFees = ZERO_BD;
  pool.cumulativeFeesUSD = ZERO_BD;
  pool.txCount = ZERO_BI;
  pool.swapCount = ZERO_BI;
  
  pool.createdAt = event.block.timestamp;
  pool.createdAtBlock = event.block.number;
  pool.createdAtTransaction = event.transaction.hash;
  
  pool.save();
  
  // Create token entities
  let token = getOrCreateToken(coin);
  createPoolToken(poolAddress, coin, 0, false);
  
  // Update protocol
  let protocol = getOrCreateProtocol();
  protocol.poolCount = protocol.poolCount.plus(ONE_BI);
  protocol.save();
  
  StableSwapPoolTemplate.create(poolAddress);
  
  log.info("MetaPool deployed: {}", [poolAddress.toHexString()]);
}

/**
 * Handle TwoCrypto Pool Deployed
 */
export function handleTwoCryptoPoolDeployed(event: TwocryptoPoolDeployed): void {
  let poolAddress = event.params.pool;
  let coins = event.params.coins;
  
  let pool = new Pool(poolAddress.toHexString());
  pool.protocol = "curve-finance-polygon";
  pool.address = poolAddress;
  pool.poolType = "TWOCRYPTO";
  pool.name = "Curve TwoCrypto Pool";
  pool.symbol = null;
  
  pool.lpToken = event.params.token;
  pool.lpTokenSupply = ZERO_BD;
  pool.A = event.params.A;
  pool.fee = event.params.mid_fee;
  pool.adminFee = event.params.admin_fee;
  pool.offpegFeeMultiplier = event.params.offpeg_fee_multiplier;
  
  pool.virtualPrice = ZERO_BD;
  pool.totalValueLocked = ZERO_BD;
  pool.totalValueLockedUSD = ZERO_BD;
  pool.cumulativeVolume = ZERO_BD;
  pool.cumulativeVolumeUSD = ZERO_BD;
  pool.cumulativeFees = ZERO_BD;
  pool.cumulativeFeesUSD = ZERO_BD;
  pool.txCount = ZERO_BI;
  pool.swapCount = ZERO_BI;
  
  pool.createdAt = event.block.timestamp;
  pool.createdAtBlock = event.block.number;
  pool.createdAtTransaction = event.transaction.hash;
  
  pool.save();
  
  // Create PoolToken entities for both coins
  for (let i = 0; i < 2; i++) {
    let token = getOrCreateToken(coins[i]);
    createPoolToken(poolAddress, coins[i], i, false);
  }
  
  let protocol = getOrCreateProtocol();
  protocol.poolCount = protocol.poolCount.plus(ONE_BI);
  protocol.save();
  
  TwoCryptoPoolTemplate.create(poolAddress);
  
  log.info("TwoCrypto Pool deployed: {}", [poolAddress.toHexString()]);
}

/**
 * Handle TriCrypto Pool Deployed
 */
export function handleTriCryptoPoolDeployed(event: TricryptoPoolDeployed): void {
  let poolAddress = event.params.pool;
  let coins = event.params.coins;
  
  let pool = new Pool(poolAddress.toHexString());
  pool.protocol = "curve-finance-polygon";
  pool.address = poolAddress;
  pool.poolType = "TRICRYPTO";
  pool.name = "Curve TriCrypto Pool";
  pool.symbol = null;
  
  pool.lpToken = event.params.token;
  pool.lpTokenSupply = ZERO_BD;
  pool.A = event.params.A;
  pool.fee = event.params.mid_fee;
  pool.adminFee = ZERO_BI;
  pool.offpegFeeMultiplier = event.params.offpeg_fee_multiplier;
  
  pool.virtualPrice = ZERO_BD;
  pool.totalValueLocked = ZERO_BD;
  pool.totalValueLockedUSD = ZERO_BD;
  pool.cumulativeVolume = ZERO_BD;
  pool.cumulativeVolumeUSD = ZERO_BD;
  pool.cumulativeFees = ZERO_BD;
  pool.cumulativeFeesUSD = ZERO_BD;
  pool.txCount = ZERO_BI;
  pool.swapCount = ZERO_BI;
  
  pool.createdAt = event.block.timestamp;
  pool.createdAtBlock = event.block.number;
  pool.createdAtTransaction = event.transaction.hash;
  
  pool.save();
  
  // Create PoolToken entities for all three coins
  for (let i = 0; i < 3; i++) {
    let token = getOrCreateToken(coins[i]);
    createPoolToken(poolAddress, coins[i], i, false);
  }
  
  let protocol = getOrCreateProtocol();
  protocol.poolCount = protocol.poolCount.plus(ONE_BI);
  protocol.save();
  
  TriCryptoPoolTemplate.create(poolAddress);
  
  log.info("TriCrypto Pool deployed: {}", [poolAddress.toHexString()]);
}

