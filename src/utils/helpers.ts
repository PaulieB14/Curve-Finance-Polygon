import { BigInt, BigDecimal, Address, ethereum } from "@graphprotocol/graph-ts";
import { ERC20 } from "../../generated/StableSwapFactory/ERC20";
import { ZERO_BD, ZERO_BI, BD_18 } from "./constants";

/**
 * Convert token amount to decimal based on decimals
 * Best Practice: Minimize eth_calls by caching token info
 */
export function convertTokenToDecimal(
  amount: BigInt,
  decimals: i32
): BigDecimal {
  if (decimals == 0) {
    return amount.toBigDecimal();
  }
  
  let precision = BigInt.fromI32(10)
    .pow(decimals as u8)
    .toBigDecimal();
  
  return amount.toBigDecimal().div(precision);
}

/**
 * Get token symbol - Best Practice: Cache to avoid repeated eth_calls
 */
export function getTokenSymbol(tokenAddress: Address): string {
  let contract = ERC20.bind(tokenAddress);
  let symbolResult = contract.try_symbol();
  
  if (symbolResult.reverted) {
    return "UNKNOWN";
  }
  
  return symbolResult.value;
}

/**
 * Get token name - Best Practice: Cache to avoid repeated eth_calls
 */
export function getTokenName(tokenAddress: Address): string {
  let contract = ERC20.bind(tokenAddress);
  let nameResult = contract.try_name();
  
  if (nameResult.reverted) {
    return "Unknown Token";
  }
  
  return nameResult.value;
}

/**
 * Get token decimals - Best Practice: Cache to avoid repeated eth_calls
 */
export function getTokenDecimals(tokenAddress: Address): i32 {
  let contract = ERC20.bind(tokenAddress);
  let decimalsResult = contract.try_decimals();
  
  if (decimalsResult.reverted) {
    return 18; // default to 18
  }
  
  return decimalsResult.value;
}

/**
 * Calculate day ID from timestamp
 */
export function getDayId(timestamp: BigInt): i32 {
  return (timestamp.toI32() / 86400);
}

/**
 * Calculate hour ID from timestamp
 */
export function getHourId(timestamp: BigInt): i32 {
  return (timestamp.toI32() / 3600);
}

/**
 * Get day start timestamp
 */
export function getDayStartTimestamp(timestamp: BigInt): BigInt {
  let dayId = getDayId(timestamp);
  return BigInt.fromI32(dayId * 86400);
}

/**
 * Get hour start timestamp
 */
export function getHourStartTimestamp(timestamp: BigInt): BigInt {
  let hourId = getHourId(timestamp);
  return BigInt.fromI32(hourId * 3600);
}

/**
 * Get pool name from contract (tries name() function, falls back to LP token name)
 */
export function getPoolName(poolAddress: Address, lpTokenAddress: Address): string {
  // Try to get name from pool contract directly
  let poolContract = ERC20.bind(poolAddress);
  let nameResult = poolContract.try_name();
  
  if (!nameResult.reverted && nameResult.value.length > 0) {
    return nameResult.value;
  }
  
  // Fall back to LP token name
  let lpTokenContract = ERC20.bind(lpTokenAddress);
  let lpNameResult = lpTokenContract.try_name();
  
  if (!lpNameResult.reverted && lpNameResult.value.length > 0) {
    return lpNameResult.value;
  }
  
  // Final fallback
  return "Curve Pool";
}

/**
 * Get pool symbol from contract (tries symbol() function, falls back to LP token symbol)
 */
export function getPoolSymbol(poolAddress: Address, lpTokenAddress: Address): string | null {
  // Try to get symbol from pool contract directly
  let poolContract = ERC20.bind(poolAddress);
  let symbolResult = poolContract.try_symbol();
  
  if (!symbolResult.reverted && symbolResult.value.length > 0) {
    return symbolResult.value;
  }
  
  // Fall back to LP token symbol
  let lpTokenContract = ERC20.bind(lpTokenAddress);
  let lpSymbolResult = lpTokenContract.try_symbol();
  
  if (!lpSymbolResult.reverted && lpSymbolResult.value.length > 0) {
    return lpSymbolResult.value;
  }
  
  return null;
}


