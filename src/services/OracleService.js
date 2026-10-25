const crypto = require('crypto');

/**
 * Aggregated Oracle Price Feed Service
 * Consolidates real-time price feeds for Fiat (EUR, USD) and On-Chain assets (EURC, USDC, ETH).
 * Emulates Chainlink Decentralized Oracle Network (DON) feeds, ECB reference rates, and Uniswap TWAP.
 */

// Base rates (USD as reference peg)
const BASE_PRICES = {
    EUR_USD: 1.0845,   // 1 EUR = 1.0845 USD (ECB / Chainlink Forex)
    USD_EUR: 0.9220,   // 1 USD = 0.9220 EUR
    ETH_USD: 3450.80,  // 1 ETH = $3450.80 USD
    ETH_EUR: 3182.02,  // 1 ETH = €3182.02 EUR
    EURC_EUR: 1.0000,  // 1 EURC = 1.0000 EUR (1:1 Regulated Stablecoin)
    USDC_USD: 1.0000,  // 1 USDC = 1.0000 USD (1:1 Regulated Stablecoin)
    EURC_USD: 1.0845,  // 1 EURC = 1.0845 USD
    USDC_EUR: 0.9220   // 1 USDC = 0.9220 EUR
};

// Oracle heartbeat and round tracking
let lastRoundId = 18446744073709562000n;
let lastUpdateTimestamp = Date.now();

// Micro-variance generator for live oracle heartbeat
function getLiveRates() {
    // Generate deterministic minute-based micro-fluctuations (within 0.05%)
    const now = Date.now();
    const cycle = Math.sin(now / 15000) * 0.0008; // +/- 0.08%
    const ethCycle = Math.cos(now / 12000) * 0.0025; // +/- 0.25%

    const eurUsd = parseFloat((BASE_PRICES.EUR_USD * (1 + cycle)).toFixed(4));
    const usdEur = parseFloat((1 / eurUsd).toFixed(4));
    const ethUsd = parseFloat((BASE_PRICES.ETH_USD * (1 + ethCycle)).toFixed(2));
    const ethEur = parseFloat((ethUsd * usdEur).toFixed(2));

    const roundId = (++lastRoundId).toString();

    return {
        timestamp: new Date().toISOString(),
        roundId: roundId,
        heartbeatSeconds: 15,
        sources: [
            'Chainlink Decentralized Oracle Network (ETH/USD Aggregator v3)',
            'BCE / European Central Bank Reference Daily Rates (EUR/USD)',
            'Uniswap v3 TWAP (EURC/USDC Pool 0.01% fee tier)'
        ],
        rates: {
            EUR_USD: eurUsd,
            USD_EUR: usdEur,
            ETH_USD: ethUsd,
            ETH_EUR: ethEur,
            EURC_EUR: 1.0000,
            USDC_USD: 1.0000,
            EURC_USD: eurUsd,
            USDC_EUR: usdEur
        },
        feedDetails: {
            'ETH/USD': {
                price: ethUsd,
                decimals: 8,
                oracle: 'Chainlink DON (0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419)',
                confidence: '99.98%',
                change24h: '+2.41%'
            },
            'EUR/USD': {
                price: eurUsd,
                decimals: 8,
                oracle: 'ECB Daily Reference / Chainlink (0xb49f677943BC038e9857d61E7d053CaA2C17E440)',
                confidence: '99.99%',
                change24h: '+0.12%'
            },
            'EURC/EUR': {
                price: 1.0000,
                decimals: 6,
                oracle: 'Circle Mint 1:1 Parity Verifier',
                confidence: '100.00%',
                change24h: '0.00%'
            },
            'USDC/USD': {
                price: 1.0000,
                decimals: 6,
                oracle: 'Circle Mint 1:1 Parity Verifier',
                confidence: '100.00%',
                change24h: '0.00%'
            }
        }
    };
}

/**
 * Calculates real-time valuation of on-chain holdings vs fiat balances
 */
function calculatePortfolioValuation(ledgerBalances) {
    const oracle = getLiveRates();
    const rates = oracle.rates;

    // Fiat Balances
    const eurFiat = ledgerBalances.fiat.eur.balance;
    const usdFiat = ledgerBalances.fiat.usd.balance;

    // On-Chain Balances
    const eurcTokens = ledgerBalances.onChain.eurc.balance;
    const usdcTokens = ledgerBalances.onChain.usdc.balance;
    const ethTokens = ledgerBalances.onChain.eth.balance;

    // Valuations in EUR
    const eurFiatInEur = eurFiat;
    const usdFiatInEur = usdFiat * rates.USD_EUR;
    const totalFiatInEur = eurFiatInEur + usdFiatInEur;

    const eurcInEur = eurcTokens * rates.EURC_EUR;
    const usdcInEur = usdcTokens * rates.USDC_EUR;
    const ethInEur = ethTokens * rates.ETH_EUR;
    const totalOnChainInEur = eurcInEur + usdcInEur + ethInEur;

    const grandTotalInEur = totalFiatInEur + totalOnChainInEur;

    // Valuations in USD
    const eurFiatInUsd = eurFiat * rates.EUR_USD;
    const usdFiatInUsd = usdFiat;
    const totalFiatInUsd = eurFiatInUsd + usdFiatInUsd;

    const eurcInUsd = eurcTokens * rates.EURC_USD;
    const usdcInUsd = usdcTokens * rates.USDC_USD;
    const ethInUsd = ethTokens * rates.ETH_USD;
    const totalOnChainInUsd = eurcInUsd + usdcInUsd + ethInUsd;

    const grandTotalInUsd = totalFiatInUsd + totalOnChainInUsd;

    // Percentage breakdown
    const fiatSharePercent = ((totalFiatInEur / grandTotalInEur) * 100).toFixed(1);
    const onChainSharePercent = ((totalOnChainInEur / grandTotalInEur) * 100).toFixed(1);

    return {
        oracleData: oracle,
        valuation: {
            totalInEur: grandTotalInEur,
            totalInUsd: grandTotalInUsd,
            fiat: {
                totalEur: totalFiatInEur,
                totalUsd: totalFiatInUsd,
                sharePercent: fiatSharePercent,
                eurAccount: { amount: eurFiat, valueEur: eurFiatInEur, valueUsd: eurFiatInUsd },
                usdAccount: { amount: usdFiat, valueEur: usdFiatInEur, valueUsd: usdFiatInUsd }
            },
            onChain: {
                totalEur: totalOnChainInEur,
                totalUsd: totalOnChainInUsd,
                sharePercent: onChainSharePercent,
                eurc: { amount: eurcTokens, valueEur: eurcInEur, valueUsd: eurcInUsd, rateEur: rates.EURC_EUR },
                usdc: { amount: usdcTokens, valueEur: usdcInEur, valueUsd: usdcInUsd, rateEur: rates.USDC_EUR },
                eth: { amount: ethTokens, valueEur: ethInEur, valueUsd: ethInUsd, rateEur: rates.ETH_EUR }
            }
        }
    };
}

/**
 * Converts an arbitrary amount from one asset to another using aggregated rates
 */
function convertAsset({ amount, fromAsset, toAsset }) {
    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount < 0) {
        throw new Error('Importo non valido per la conversione.');
    }

    const oracle = getLiveRates();
    const rates = oracle.rates;

    const from = fromAsset.toUpperCase();
    const to = toAsset.toUpperCase();

    if (from === to) {
        return {
            amount: numAmount,
            fromAsset: from,
            toAsset: to,
            result: numAmount,
            rate: 1.0,
            oracleTimestamp: oracle.timestamp
        };
    }

    // Step 1: Normalize 'from' asset to EUR base
    let valueInEur = 0;
    if (from === 'EUR' || from === 'EURC') {
        valueInEur = numAmount;
    } else if (from === 'USD' || from === 'USDC') {
        valueInEur = numAmount * rates.USD_EUR;
    } else if (from === 'ETH') {
        valueInEur = numAmount * rates.ETH_EUR;
    } else {
        throw new Error(`Asset di origine non supportato: ${fromAsset}`);
    }

    // Step 2: Convert EUR base to 'to' asset
    let finalAmount = 0;
    let effectiveRate = 0;

    if (to === 'EUR' || to === 'EURC') {
        finalAmount = valueInEur;
        effectiveRate = finalAmount / numAmount;
    } else if (to === 'USD' || to === 'USDC') {
        finalAmount = valueInEur * rates.EUR_USD;
        effectiveRate = finalAmount / numAmount;
    } else if (to === 'ETH') {
        finalAmount = valueInEur / rates.ETH_EUR;
        effectiveRate = finalAmount / numAmount;
    } else {
        throw new Error(`Asset di destinazione non supportato: ${toAsset}`);
    }

    return {
        amount: numAmount,
        fromAsset: from,
        toAsset: to,
        result: parseFloat(finalAmount.toFixed(to === 'ETH' ? 6 : 2)),
        rate: parseFloat(effectiveRate.toFixed(to === 'ETH' ? 8 : 4)),
        inverseRate: parseFloat((1 / effectiveRate).toFixed(from === 'ETH' ? 8 : 4)),
        oracleRoundId: oracle.roundId,
        oracleTimestamp: oracle.timestamp,
        oracleSources: oracle.sources
    };
}

module.exports = {
    getLiveRates,
    calculatePortfolioValuation,
    convertAsset
};
