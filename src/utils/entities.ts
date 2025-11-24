import { Address, BigInt, Bytes, ethereum } from "@graphprotocol/graph-ts";
import {
  CurveProtocol,
  Token,
  Pool,
  User,
  Transaction,
  Position,
  PoolToken,
} from "../../generated/schema";
import { ZERO_BI, ZERO_BD, ONE_BI, PROTOCOL_ID } from "./constants";
import { getTokenSymbol, getTokenName, getTokenDecimals } from "./helpers";

/**
 * Get or create Protocol entity
 * Best Practice: Single source of truth for protocol metrics
 */
export function getOrCreateProtocol(): CurveProtocol {
  let protocol = CurveProtocol.load(PROTOCOL_ID);
  
  if (protocol == null) {
    protocol = new CurveProtocol(PROTOCOL_ID);
    protocol.poolCount = ZERO_BI;
    protocol.totalVolume = ZERO_BD;
    protocol.totalVolumeUSD = ZERO_BD;
    protocol.totalValueLocked = ZERO_BD;
    protocol.totalValueLockedUSD = ZERO_BD;
    protocol.totalFees = ZERO_BD;
    protocol.totalFeesUSD = ZERO_BD;
    protocol.txCount = ZERO_BI;
    protocol.userCount = ZERO_BI;
    protocol.save();
  }
  
  return protocol;
}

/**
 * Get or create Token entity
 * Best Practice: Cache token info to minimize eth_calls
 */
export function getOrCreateToken(tokenAddress: Address): Token {
  let token = Token.load(tokenAddress.toHexString());
  
  if (token == null) {
    token = new Token(tokenAddress.toHexString());
    token.address = tokenAddress;
    
    // Make eth_calls once and cache
    token.symbol = getTokenSymbol(tokenAddress);
    token.name = getTokenName(tokenAddress);
    token.decimals = getTokenDecimals(tokenAddress);
    
    token.lastPriceUSD = ZERO_BD;
    token.lastPriceBlock = ZERO_BI;
    
    token.save();
  }
  
  return token;
}

/**
 * Get or create User entity
 * Best Practice: Track user metrics efficiently
 */
export function getOrCreateUser(
  userAddress: Address,
  timestamp: BigInt
): User {
  let user = User.load(userAddress.toHexString());
  
  if (user == null) {
    user = new User(userAddress.toHexString());
    user.address = userAddress;
    user.swapCount = ZERO_BI;
    user.liquidityEventCount = ZERO_BI;
    user.totalVolumeUSD = ZERO_BD;
    user.positionCount = ZERO_BI;
    user.firstInteractionAt = timestamp;
    user.lastInteractionAt = timestamp;
    
    // Increment protocol user count
    let protocol = getOrCreateProtocol();
    protocol.userCount = protocol.userCount.plus(ONE_BI);
    protocol.save();
    
    user.save();
  } else {
    // Update last interaction
    user.lastInteractionAt = timestamp;
    user.save();
  }
  
  return user;
}

/**
 * Get or create Transaction entity
 * Best Practice: Reuse transaction data
 */
export function getOrCreateTransaction(event: ethereum.Event): Transaction {
  let transaction = Transaction.load(event.transaction.hash.toHexString());
  
  if (transaction == null) {
    transaction = new Transaction(event.transaction.hash.toHexString());
    transaction.blockNumber = event.block.number;
    transaction.timestamp = event.block.timestamp;
    transaction.gasUsed = event.receipt ? event.receipt!.gasUsed : null;
    transaction.gasPrice = event.transaction.gasPrice;
    transaction.save();
  }
  
  return transaction;
}

/**
 * Get or create Position entity
 * Best Practice: Efficient position tracking without arrays
 */
export function getOrCreatePosition(
  poolAddress: Address,
  userAddress: Address,
  timestamp: BigInt,
  block: BigInt,
  txHash: Bytes
): Position {
  let id = poolAddress.toHexString() + "-" + userAddress.toHexString();
  let position = Position.load(id);
  
  if (position == null) {
    position = new Position(id);
    position.pool = poolAddress.toHexString();
    position.user = userAddress.toHexString();
    position.lpTokenBalance = ZERO_BD;
    position.valueUSD = ZERO_BD;
    position.depositCount = ZERO_BI;
    position.withdrawCount = ZERO_BI;
    position.createdAt = timestamp;
    position.updatedAt = timestamp;
    position.updatedAtBlock = block;
    position.updatedAtTransaction = txHash;
    
    // Increment user position count
    let user = getOrCreateUser(userAddress, timestamp);
    user.positionCount = user.positionCount.plus(ONE_BI);
    user.save();
    
    position.save();
  }
  
  return position;
}

/**
 * Create PoolToken relationship entity
 * Best Practice #6: Normalize many-to-many relationships
 */
export function createPoolToken(
  poolAddress: Address,
  tokenAddress: Address,
  index: i32,
  isUnderlying: boolean
): PoolToken {
  let id = poolAddress.toHexString() 
    + "-" + tokenAddress.toHexString() 
    + "-" + index.toString();
  
  let poolToken = new PoolToken(id);
  poolToken.pool = poolAddress.toHexString();
  poolToken.token = tokenAddress.toHexString();
  poolToken.index = index;
  poolToken.balance = ZERO_BD;
  poolToken.balanceUSD = ZERO_BD;
  poolToken.isUnderlying = isUnderlying;
  poolToken.rate = ZERO_BD;
  
  poolToken.save();
  
  return poolToken;
}

/**
 * Initialize a static pool (not deployed via factory)
 * Used for legacy pools that are indexed directly
 */
export function initializeStaticPool(
  poolAddress: Address,
  poolType: string,
  poolName: string,
  event: ethereum.Event
): Pool {
  let pool = new Pool(poolAddress.toHexString());
  pool.protocol = PROTOCOL_ID;
  pool.address = poolAddress;
  pool.poolType = poolType;
  pool.name = poolName;
  pool.symbol = null;
  
  // Pool parameters - will be updated from contract calls if needed
  pool.lpToken = poolAddress; // Default: pool is LP token
  pool.lpTokenSupply = ZERO_BD;
  pool.A = ZERO_BI;
  pool.fee = ZERO_BI;
  pool.adminFee = ZERO_BI;
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
  
  // Update protocol
  let protocol = getOrCreateProtocol();
  protocol.poolCount = protocol.poolCount.plus(ONE_BI);
  protocol.save();
  
  return pool;
}

