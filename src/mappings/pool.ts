import { Address, BigInt, log } from "@graphprotocol/graph-ts";
import {
  TokenExchange,
  AddLiquidity,
  RemoveLiquidity,
  RemoveLiquidityOne,
  RemoveLiquidityImbalance,
} from "../../generated/templates/StableSwapPool/StableSwapPool";
import {
  Pool,
  Swap,
  LiquidityEvent,
  LiquidityTokenAmount,
  PoolToken,
} from "../../generated/schema";
import {
  getOrCreateUser,
  getOrCreateTransaction,
  getOrCreatePosition,
  getOrCreateToken,
  getOrCreateProtocol,
} from "../utils/entities";
import { ZERO_BI, ZERO_BD, ONE_BI } from "../utils/constants";
import { convertTokenToDecimal } from "../utils/helpers";
import { getAverageSwapPriceUSD, getAmountInUSD } from "../utils/pricing";

/**
 * Calculate and update pool TVL by summing all poolToken balances
 */
function updatePoolTVL(pool: Pool): void {
  let totalTVL = ZERO_BD;
  let totalTVLUSD = ZERO_BD;
  
  // Load all pool tokens using @derivedFrom
  let poolTokens = pool.tokens.load();
  
  for (let i = 0; i < poolTokens.length; i++) {
    totalTVL = totalTVL.plus(poolTokens[i].balance);
    totalTVLUSD = totalTVLUSD.plus(poolTokens[i].balanceUSD);
  }
  
  pool.totalValueLocked = totalTVL;
  pool.totalValueLockedUSD = totalTVLUSD;
}

/**
 * Update protocol TVL by summing all pool TVLs
 */
function updateProtocolTVL(): void {
  let protocol = getOrCreateProtocol();
  let pools = protocol.pools.load();
  
  let totalTVL = ZERO_BD;
  let totalTVLUSD = ZERO_BD;
  
  for (let i = 0; i < pools.length; i++) {
    totalTVL = totalTVL.plus(pools[i].totalValueLocked);
    totalTVLUSD = totalTVLUSD.plus(pools[i].totalValueLockedUSD);
  }
  
  protocol.totalValueLocked = totalTVL;
  protocol.totalValueLockedUSD = totalTVLUSD;
  protocol.save();
}

/**
 * Handle Token Exchange (Swap)
 * Best Practice: Use foreign keys, not arrays. Use loadRelated for derived entities.
 */
export function handleTokenExchange(event: TokenExchange): void {
  let poolAddress = event.address;
  let pool = Pool.load(poolAddress.toHexString());
  
  if (pool == null) {
    log.error("Pool not found: {}", [poolAddress.toHexString()]);
    return;
  }
  
  // Create transaction entity (Best Practice: Reuse transaction data)
  let transaction = getOrCreateTransaction(event);
  
  // Create user entity
  let user = getOrCreateUser(event.params.buyer, event.block.timestamp);
  
  // Best Practice #4: Use loadRelated to load derived entities
  // Instead of storing token arrays, we load PoolToken relationships
  let poolTokens = pool.tokens.load();
  
  if (poolTokens.length == 0) {
    log.error("No tokens found for pool: {}", [poolAddress.toHexString()]);
    return;
  }
  
  // Get sold and bought tokens from PoolToken entities
  let soldIndex = event.params.sold_id.toI32();
  let boughtIndex = event.params.bought_id.toI32();
  
  let soldPoolToken: PoolToken | null = null;
  let boughtPoolToken: PoolToken | null = null;
  
  // Best Practice: Iterate over loaded entities instead of accessing array
  for (let i = 0; i < poolTokens.length; i++) {
    if (poolTokens[i].index == soldIndex) {
      soldPoolToken = poolTokens[i];
    }
    if (poolTokens[i].index == boughtIndex) {
      boughtPoolToken = poolTokens[i];
    }
  }
  
  if (soldPoolToken == null || boughtPoolToken == null) {
    log.error("Tokens not found for swap in pool: {}", [poolAddress.toHexString()]);
    return;
  }
  
  // Load actual token entities
  let soldToken = getOrCreateToken(Address.fromString(soldPoolToken.token));
  let boughtToken = getOrCreateToken(Address.fromString(boughtPoolToken.token));
  
  // Create swap entity with unique ID
  let swapId = event.transaction.hash.toHexString() + "-" + event.logIndex.toString();
  let swap = new Swap(swapId);
  
  // Best Practice: Use foreign keys instead of embedding data
  swap.pool = pool.id;
  swap.buyer = user.id;
  swap.receiver = event.params.buyer;
  swap.transaction = transaction.id;
  
  // Token references (foreign keys, not arrays)
  swap.soldToken = soldToken.id;
  swap.boughtToken = boughtToken.id;
  swap.soldId = event.params.sold_id.toI32();
  swap.boughtId = event.params.bought_id.toI32();
  
  // Convert amounts using cached decimals (Best Practice #2)
  swap.tokensSold = convertTokenToDecimal(
    event.params.tokens_sold,
    soldToken.decimals
  );
  swap.tokensBought = convertTokenToDecimal(
    event.params.tokens_bought,
    boughtToken.decimals
  );
  
  // Calculate USD value using Curve-style stablecoin pricing
  swap.amountUSD = getAverageSwapPriceUSD(
    Address.fromString(soldToken.address.toHexString()),
    event.params.tokens_sold,
    soldToken.decimals,
    Address.fromString(boughtToken.address.toHexString()),
    event.params.tokens_bought,
    boughtToken.decimals
  );
  
  // Metadata
  swap.block = event.block.number;
  swap.timestamp = event.block.timestamp;
  swap.logIndex = event.logIndex;
  
  swap.save();
  
  // Update pool metrics (Best Practice: Aggregate data, don't store arrays)
  pool.swapCount = pool.swapCount.plus(ONE_BI);
  pool.txCount = pool.txCount.plus(ONE_BI);
  pool.cumulativeVolume = pool.cumulativeVolume.plus(swap.tokensSold);
  // Only add to volume if swap has USD value (non-zero)
  if (!swap.amountUSD.equals(ZERO_BD)) {
    pool.cumulativeVolumeUSD = pool.cumulativeVolumeUSD.plus(swap.amountUSD);
  }
  pool.save();
  
  // Update user metrics (Best Practice: Aggregate instead of arrays)
  user.swapCount = user.swapCount.plus(ONE_BI);
  if (!swap.amountUSD.equals(ZERO_BD)) {
    user.totalVolumeUSD = user.totalVolumeUSD.plus(swap.amountUSD);
  }
  user.save();
  
  // Update protocol metrics
  let protocol = getOrCreateProtocol();
  protocol.txCount = protocol.txCount.plus(ONE_BI);
  if (!swap.amountUSD.equals(ZERO_BD)) {
    protocol.totalVolumeUSD = protocol.totalVolumeUSD.plus(swap.amountUSD);
  }
  protocol.save();
  
  log.info("Swap processed: {} for pool {}", [swapId, pool.id]);
}

/**
 * Handle Add Liquidity
 * Best Practice #6: Create separate LiquidityTokenAmount entities instead of arrays
 */
export function handleAddLiquidity(event: AddLiquidity): void {
  let poolAddress = event.address;
  let pool = Pool.load(poolAddress.toHexString());
  
  if (pool == null) {
    log.error("Pool not found: {}", [poolAddress.toHexString()]);
    return;
  }
  
  let transaction = getOrCreateTransaction(event);
  let user = getOrCreateUser(event.params.provider, event.block.timestamp);
  
  // Create liquidity event entity
  let eventId = event.transaction.hash.toHexString() + "-" + event.logIndex.toString();
  let liquidityEvent = new LiquidityEvent(eventId);
  
  // Best Practice: Foreign keys instead of arrays
  liquidityEvent.pool = pool.id;
  liquidityEvent.provider = user.id;
  liquidityEvent.transaction = transaction.id;
  liquidityEvent.type = "ADD";
  
  // LP token amount
  let tokenAmounts = event.params.token_amounts;
  let lpTokenAmount = convertTokenToDecimal(event.params.token_supply, 18);
  liquidityEvent.lpTokenAmount = lpTokenAmount;
  liquidityEvent.lpTokenSupply = lpTokenAmount;
  
  liquidityEvent.invariant = null;
  liquidityEvent.block = event.block.number;
  liquidityEvent.timestamp = event.block.timestamp;
  liquidityEvent.logIndex = event.logIndex;
  
  liquidityEvent.save();
  
  // Best Practice #6: Create separate LiquidityTokenAmount entities
  // This avoids the large array problem!
  let poolTokens = pool.tokens.load();
  
  for (let i = 0; i < tokenAmounts.length; i++) {
    if (i >= poolTokens.length) break;
    
    let poolToken = poolTokens[i];
    let token = getOrCreateToken(Address.fromString(poolToken.token));
    
    // Create individual LiquidityTokenAmount entity
    let tokenAmountId = eventId + "-" + i.toString();
    let liquidityTokenAmount = new LiquidityTokenAmount(tokenAmountId);
    
    // Foreign keys (Best Practice #3)
    liquidityTokenAmount.liquidityEvent = liquidityEvent.id;
    liquidityTokenAmount.token = token.id;
    liquidityTokenAmount.index = i;
    
    // Convert amount
    liquidityTokenAmount.amount = convertTokenToDecimal(
      tokenAmounts[i],
      token.decimals
    );
    
    // Calculate USD value
    liquidityTokenAmount.amountUSD = getAmountInUSD(
      Address.fromString(token.address.toHexString()),
      tokenAmounts[i],
      token.decimals
    );
    liquidityTokenAmount.fee = ZERO_BD;
    
    liquidityTokenAmount.save();
    
    // Update PoolToken balance and USD value
    poolToken.balance = poolToken.balance.plus(liquidityTokenAmount.amount);
    if (liquidityTokenAmount.amountUSD && !liquidityTokenAmount.amountUSD.equals(ZERO_BD)) {
      poolToken.balanceUSD = poolToken.balanceUSD.plus(liquidityTokenAmount.amountUSD);
    }
    poolToken.save();
  }
  
  // Update position (Best Practice: Efficient position tracking)
  let position = getOrCreatePosition(
    poolAddress,
    event.params.provider,
    event.block.timestamp,
    event.block.number,
    event.transaction.hash
  );
  
  position.lpTokenBalance = position.lpTokenBalance.plus(lpTokenAmount);
  position.depositCount = position.depositCount.plus(ONE_BI);
  position.updatedAt = event.block.timestamp;
  position.updatedAtBlock = event.block.number;
  position.updatedAtTransaction = event.transaction.hash;
  position.save();
  
  // Update pool metrics
  pool.lpTokenSupply = pool.lpTokenSupply.plus(lpTokenAmount);
  pool.txCount = pool.txCount.plus(ONE_BI);
  
  // Recalculate TVL from all poolToken balances
  updatePoolTVL(pool);
  
  pool.save();
  
  // Update user metrics (aggregated, not arrays)
  user.liquidityEventCount = user.liquidityEventCount.plus(ONE_BI);
  user.save();
  
  let protocol = getOrCreateProtocol();
  protocol.txCount = protocol.txCount.plus(ONE_BI);
  protocol.save();
  
  // Update protocol TVL
  updateProtocolTVL();
  
  log.info("Add liquidity processed: {}", [eventId]);
}

/**
 * Handle Remove Liquidity
 */
export function handleRemoveLiquidity(event: RemoveLiquidity): void {
  let poolAddress = event.address;
  let pool = Pool.load(poolAddress.toHexString());
  
  if (pool == null) {
    return;
  }
  
  let transaction = getOrCreateTransaction(event);
  let user = getOrCreateUser(event.params.provider, event.block.timestamp);
  
  let eventId = event.transaction.hash.toHexString() + "-" + event.logIndex.toString();
  let liquidityEvent = new LiquidityEvent(eventId);
  
  liquidityEvent.pool = pool.id;
  liquidityEvent.provider = user.id;
  liquidityEvent.transaction = transaction.id;
  liquidityEvent.type = "REMOVE";
  
  let lpTokenAmount = convertTokenToDecimal(event.params.token_supply, 18);
  liquidityEvent.lpTokenAmount = lpTokenAmount;
  liquidityEvent.lpTokenSupply = lpTokenAmount;
  liquidityEvent.invariant = null;
  liquidityEvent.block = event.block.number;
  liquidityEvent.timestamp = event.block.timestamp;
  liquidityEvent.logIndex = event.logIndex;
  
  liquidityEvent.save();
  
  // Create LiquidityTokenAmount entities (Best Practice #6)
  let tokenAmounts = event.params.token_amounts;
  let poolTokens = pool.tokens.load();
  
  for (let i = 0; i < tokenAmounts.length; i++) {
    if (i >= poolTokens.length) break;
    
    let poolToken = poolTokens[i];
    let token = getOrCreateToken(Address.fromString(poolToken.token));
    
    let tokenAmountId = eventId + "-" + i.toString();
    let liquidityTokenAmount = new LiquidityTokenAmount(tokenAmountId);
    
    liquidityTokenAmount.liquidityEvent = liquidityEvent.id;
    liquidityTokenAmount.token = token.id;
    liquidityTokenAmount.index = i;
    liquidityTokenAmount.amount = convertTokenToDecimal(
      tokenAmounts[i],
      token.decimals
    );
    
    // Calculate USD value
    liquidityTokenAmount.amountUSD = getAmountInUSD(
      Address.fromString(token.address.toHexString()),
      tokenAmounts[i],
      token.decimals
    );
    liquidityTokenAmount.fee = ZERO_BD;
    
    liquidityTokenAmount.save();
    
    // Update PoolToken balance and USD value
    poolToken.balance = poolToken.balance.minus(liquidityTokenAmount.amount);
    if (liquidityTokenAmount.amountUSD && !liquidityTokenAmount.amountUSD.equals(ZERO_BD)) {
      poolToken.balanceUSD = poolToken.balanceUSD.minus(liquidityTokenAmount.amountUSD);
    }
    poolToken.save();
  }
  
  // Update position
  let position = getOrCreatePosition(
    poolAddress,
    event.params.provider,
    event.block.timestamp,
    event.block.number,
    event.transaction.hash
  );
  
  position.lpTokenBalance = position.lpTokenBalance.minus(lpTokenAmount);
  position.withdrawCount = position.withdrawCount.plus(ONE_BI);
  position.updatedAt = event.block.timestamp;
  position.updatedAtBlock = event.block.number;
  position.updatedAtTransaction = event.transaction.hash;
  position.save();
  
  pool.lpTokenSupply = pool.lpTokenSupply.minus(lpTokenAmount);
  pool.txCount = pool.txCount.plus(ONE_BI);
  
  // Recalculate TVL from all poolToken balances
  updatePoolTVL(pool);
  
  pool.save();
  
  user.liquidityEventCount = user.liquidityEventCount.plus(ONE_BI);
  user.save();
  
  let protocol = getOrCreateProtocol();
  protocol.txCount = protocol.txCount.plus(ONE_BI);
  protocol.save();
  
  // Update protocol TVL
  updateProtocolTVL();
}

/**
 * Handle Remove Liquidity One
 */
export function handleRemoveLiquidityOne(event: RemoveLiquidityOne): void {
  let poolAddress = event.address;
  let pool = Pool.load(poolAddress.toHexString());
  
  if (pool == null) {
    return;
  }
  
  let transaction = getOrCreateTransaction(event);
  let user = getOrCreateUser(event.params.provider, event.block.timestamp);
  
  let eventId = event.transaction.hash.toHexString() + "-" + event.logIndex.toString();
  let liquidityEvent = new LiquidityEvent(eventId);
  
  liquidityEvent.pool = pool.id;
  liquidityEvent.provider = user.id;
  liquidityEvent.transaction = transaction.id;
  liquidityEvent.type = "REMOVE_ONE";
  
  let lpTokenAmount = convertTokenToDecimal(event.params.token_amount, 18);
  liquidityEvent.lpTokenAmount = lpTokenAmount;
  liquidityEvent.lpTokenSupply = pool.lpTokenSupply.minus(lpTokenAmount);
  liquidityEvent.invariant = null;
  liquidityEvent.block = event.block.number;
  liquidityEvent.timestamp = event.block.timestamp;
  liquidityEvent.logIndex = event.logIndex;
  
  liquidityEvent.save();
  
  // Update position
  let position = getOrCreatePosition(
    poolAddress,
    event.params.provider,
    event.block.timestamp,
    event.block.number,
    event.transaction.hash
  );
  
  position.lpTokenBalance = position.lpTokenBalance.minus(lpTokenAmount);
  position.withdrawCount = position.withdrawCount.plus(ONE_BI);
  position.updatedAt = event.block.timestamp;
  position.updatedAtBlock = event.block.number;
  position.updatedAtTransaction = event.transaction.hash;
  position.save();
  
  pool.lpTokenSupply = pool.lpTokenSupply.minus(lpTokenAmount);
  pool.txCount = pool.txCount.plus(ONE_BI);
  pool.save();
  
  user.liquidityEventCount = user.liquidityEventCount.plus(ONE_BI);
  user.save();
  
  let protocol = getOrCreateProtocol();
  protocol.txCount = protocol.txCount.plus(ONE_BI);
  protocol.save();
}

/**
 * Handle Remove Liquidity Imbalance
 */
export function handleRemoveLiquidityImbalance(event: RemoveLiquidityImbalance): void {
  let poolAddress = event.address;
  let pool = Pool.load(poolAddress.toHexString());
  
  if (pool == null) {
    return;
  }
  
  let transaction = getOrCreateTransaction(event);
  let user = getOrCreateUser(event.params.provider, event.block.timestamp);
  
  let eventId = event.transaction.hash.toHexString() + "-" + event.logIndex.toString();
  let liquidityEvent = new LiquidityEvent(eventId);
  
  liquidityEvent.pool = pool.id;
  liquidityEvent.provider = user.id;
  liquidityEvent.transaction = transaction.id;
  liquidityEvent.type = "REMOVE_IMBALANCE";
  
  let lpTokenAmount = convertTokenToDecimal(event.params.token_supply, 18);
  liquidityEvent.lpTokenAmount = lpTokenAmount;
  liquidityEvent.lpTokenSupply = lpTokenAmount;
  liquidityEvent.invariant = null;
  liquidityEvent.block = event.block.number;
  liquidityEvent.timestamp = event.block.timestamp;
  liquidityEvent.logIndex = event.logIndex;
  
  liquidityEvent.save();
  
  // Update position
  let position = getOrCreatePosition(
    poolAddress,
    event.params.provider,
    event.block.timestamp,
    event.block.number,
    event.transaction.hash
  );
  
  position.lpTokenBalance = lpTokenAmount;
  position.withdrawCount = position.withdrawCount.plus(ONE_BI);
  position.updatedAt = event.block.timestamp;
  position.updatedAtBlock = event.block.number;
  position.updatedAtTransaction = event.transaction.hash;
  position.save();
  
  pool.lpTokenSupply = lpTokenAmount;
  pool.txCount = pool.txCount.plus(ONE_BI);
  pool.save();
  
  user.liquidityEventCount = user.liquidityEventCount.plus(ONE_BI);
  user.save();
  
  let protocol = getOrCreateProtocol();
  protocol.txCount = protocol.txCount.plus(ONE_BI);
  protocol.save();
}

