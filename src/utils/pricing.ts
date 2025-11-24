import { Address, BigDecimal, BigInt } from '@graphprotocol/graph-ts';
import { ERC20 } from '../../generated/StableSwapFactory/ERC20';

/**
 * Stablecoin Pricing Module
 * Based on Curve Finance official subgraph approach
 * 
 * For stablecoin pools, we use hardcoded $1.00 prices
 * This is the standard approach used by Curve's official subgraphs
 */

// Known stablecoins on Polygon (all pegged to ~$1.00)
const STABLECOIN_ADDRESSES = new Map<string, string>();

// Initialize stablecoin map (lowercase addresses)
STABLECOIN_ADDRESSES.set('0x2791bca1f2de4661ed88a30c99a7a9449aa84174', 'USDC'); // USDC
STABLECOIN_ADDRESSES.set('0x3c499c542cef5e3811e1192ce70d8cc03d5c3359', 'USDC'); // USDC (native)
STABLECOIN_ADDRESSES.set('0xc2132d05d31c914a87c6611c10748aeb04b58e8f', 'USDT'); // USDT
STABLECOIN_ADDRESSES.set('0x8f3cf7ad23cd3cadbd9735aff958023239c6a063', 'DAI');  // DAI
STABLECOIN_ADDRESSES.set('0xc4ce1d6f5d98d65ee25cf85e9f2e9dcfee6cb5d6', 'crvUSD'); // crvUSD
STABLECOIN_ADDRESSES.set('0xdab529f40e671a1d4bf91361c21bf9f0c9712ab7', 'BUSD'); // BUSD
STABLECOIN_ADDRESSES.set('0x9af3b7dc29d3c4b1a5731408b6a9656fa7ac3b72', 'USDC.e'); // USDC.e

/**
 * Check if a token is a known stablecoin
 */
export function isStablecoin(tokenAddress: Address): boolean {
  const address = tokenAddress.toHexString().toLowerCase();
  return STABLECOIN_ADDRESSES.has(address);
}

/**
 * Get USD price for a token
 * Returns BigDecimal price in USD
 * 
 * For stablecoins: returns 1.00
 * For other tokens: returns 0 (can be extended with Chainlink oracles later)
 */
export function getTokenPriceUSD(tokenAddress: Address): BigDecimal {
  if (isStablecoin(tokenAddress)) {
    return BigDecimal.fromString('1.0');
  }
  
  // For non-stablecoins, return 0 for now
  // This can be extended later with:
  // - Chainlink price feeds
  // - Pool-derived prices
  // - External price APIs
  return BigDecimal.fromString('0');
}

/**
 * Convert token amount to USD value
 * Takes raw token amount and decimals, returns USD value
 */
export function getAmountInUSD(
  tokenAddress: Address,
  amount: BigInt,
  decimals: i32
): BigDecimal {
  const priceUSD = getTokenPriceUSD(tokenAddress);
  
  if (priceUSD.equals(BigDecimal.fromString('0'))) {
    return BigDecimal.fromString('0');
  }
  
  // Convert amount to decimal format
  const divisor = BigInt.fromI32(10).pow(decimals as u8);
  const amountDecimal = amount.toBigDecimal().div(divisor.toBigDecimal());
  
  // Multiply by USD price
  return amountDecimal.times(priceUSD);
}

/**
 * Get token decimals with fallback
 */
export function getTokenDecimals(tokenAddress: Address): i32 {
  const token = ERC20.bind(tokenAddress);
  const decimalsResult = token.try_decimals();
  
  if (decimalsResult.reverted) {
    // Default to 18 decimals if call fails
    return 18;
  }
  
  return decimalsResult.value;
}

/**
 * Calculate USD value for a swap
 * Uses the "sold" token as the reference price
 */
export function getSwapAmountUSD(
  soldTokenAddress: Address,
  soldAmount: BigInt,
  soldDecimals: i32
): BigDecimal {
  return getAmountInUSD(soldTokenAddress, soldAmount, soldDecimals);
}

/**
 * Calculate average price for a token pair in a swap
 * Returns the average USD price between sold and bought tokens
 */
export function getAverageSwapPriceUSD(
  soldTokenAddress: Address,
  soldAmount: BigInt,
  soldDecimals: i32,
  boughtTokenAddress: Address,
  boughtAmount: BigInt,
  boughtDecimals: i32
): BigDecimal {
  const soldUSD = getAmountInUSD(soldTokenAddress, soldAmount, soldDecimals);
  const boughtUSD = getAmountInUSD(boughtTokenAddress, boughtAmount, boughtDecimals);
  
  // If both are priced, return average
  if (!soldUSD.equals(BigDecimal.fromString('0')) && !boughtUSD.equals(BigDecimal.fromString('0'))) {
    return soldUSD.plus(boughtUSD).div(BigDecimal.fromString('2'));
  }
  
  // If only one is priced, use that one
  if (!soldUSD.equals(BigDecimal.fromString('0'))) {
    return soldUSD;
  }
  
  return boughtUSD;
}


