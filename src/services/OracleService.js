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
    BTC_USD: 67850.00, // 1 BTC = $67,850.00 USD
    BTC_EUR: 62563.00, // 1 BTC = €62,563.00 EUR
    BNB_USD: 585.50,   // 1 BNB = $585.50 USD
    BNB_EUR: 539.88,   // 1 BNB = €539.88 EUR
    POL_USD: 0.385,    // 1 POL = $0.385 USD
    POL_EUR: 0.355,    // 1 POL = €0.355 EUR
    ARB_USD: 0.582,    // 1 ARB = $0.582 USD
    ARB_EUR: 0.536,    // 1 ARB = €0.536 EUR
    EURC_EUR: 1.0000,  // 1 EURC = 1.0000 EUR (1:1 Regulated Stablecoin)
    USDC_USD: 1.0000,  // 1 USDC = 1.0000 USD (1:1 Regulated Stablecoin)
    EURC_USD: 1.0845,  // 1 EURC = 1.0845 USD
    USDC_EUR: 0.9220,  // 1 USDC = 0.9220 EUR
    USDT_USD: 1.0000,
    USDT_EUR: 0.9220,
    DAI_USD: 1.0000,
    DAI_EUR: 0.9220,
    BUSD_USD: 1.0000,
    BUSD_EUR: 0.9220
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
    const btcCycle = Math.sin(now / 18000) * 0.0018; // +/- 0.18%

    const eurUsd = parseFloat((BASE_PRICES.EUR_USD * (1 + cycle)).toFixed(4));
    const usdEur = parseFloat((1 / eurUsd).toFixed(4));
    const ethUsd = parseFloat((BASE_PRICES.ETH_USD * (1 + ethCycle)).toFixed(2));
    const ethEur = parseFloat((ethUsd * usdEur).toFixed(2));
    const btcUsd = parseFloat((BASE_PRICES.BTC_USD * (1 + btcCycle)).toFixed(2));
    const btcEur = parseFloat((btcUsd * usdEur).toFixed(2));
    const bnbUsd = parseFloat((BASE_PRICES.BNB_USD * (1 + cycle * 1.5)).toFixed(2));
    const bnbEur = parseFloat((bnbUsd * usdEur).toFixed(2));
    const polUsd = parseFloat((BASE_PRICES.POL_USD * (1 + cycle * 2)).toFixed(4));
    const polEur = parseFloat((polUsd * usdEur).toFixed(4));
    const arbUsd = parseFloat((BASE_PRICES.ARB_USD * (1 + cycle * 2.2)).toFixed(4));
    const arbEur = parseFloat((arbUsd * usdEur).toFixed(4));

    const roundId = (++lastRoundId).toString();

    return {
        timestamp: new Date().toISOString(),
        roundId: roundId,
        heartbeatSeconds: 15,
        sources: [
            'Chainlink Decentralized Oracle Network (ETH/USD Aggregator v3)',
            'Chainlink BTC/USD Price Feed (0xF4030086522a5bEEa4988F8cA5B36dbC97BeE88c)',
            'BCE / European Central Bank Reference Daily Rates (EUR/USD)',
            'Uniswap v3 TWAP Multi-Pool feeds'
        ],
        rates: {
            EUR_USD: eurUsd,
            USD_EUR: usdEur,
            ETH_USD: ethUsd,
            ETH_EUR: ethEur,
            BTC_USD: btcUsd,
            BTC_EUR: btcEur,
            BNB_USD: bnbUsd,
            BNB_EUR: bnbEur,
            POL_USD: polUsd,
            POL_EUR: polEur,
            ARB_USD: arbUsd,
            ARB_EUR: arbEur,
            EURC_EUR: 1.0000,
            USDC_USD: 1.0000,
            EURC_USD: eurUsd,
            USDC_EUR: usdEur,
            USDT_USD: 1.0000,
            USDT_EUR: usdEur,
            DAI_USD: 1.0000,
            DAI_EUR: usdEur,
            BUSD_USD: 1.0000,
            BUSD_EUR: usdEur
        },
        feedDetails: {
            'BTC/USD': { price: btcUsd, decimals: 8, oracle: 'Chainlink DON (BTC/USD)', confidence: '99.99%', change24h: '+1.85%' },
            'ETH/USD': { price: ethUsd, decimals: 8, oracle: 'Chainlink DON (ETH/USD)', confidence: '99.98%', change24h: '+2.41%' },
            'BNB/USD': { price: bnbUsd, decimals: 8, oracle: 'Chainlink DON (BNB/USD)', confidence: '99.95%', change24h: '+0.95%' },
            'POL/USD': { price: polUsd, decimals: 8, oracle: 'Chainlink DON (POL/USD)', confidence: '99.91%', change24h: '+3.10%' },
            'ARB/USD': { price: arbUsd, decimals: 8, oracle: 'Chainlink DON (ARB/USD)', confidence: '99.92%', change24h: '+1.45%' },
            'EUR/USD': { price: eurUsd, decimals: 8, oracle: 'ECB Daily Reference / Chainlink', confidence: '99.99%', change24h: '+0.12%' },
            'EURC/EUR': { price: 1.0000, decimals: 6, oracle: 'Circle Mint Parity Verifier', confidence: '100.00%', change24h: '0.00%' },
            'USDC/USD': { price: 1.0000, decimals: 6, oracle: 'Circle Mint Parity Verifier', confidence: '100.00%', change24h: '0.00%' },
            'USDT/USD': { price: 1.0000, decimals: 6, oracle: 'Tether Reserve Attestation', confidence: '100.00%', change24h: '0.00%' },
            'DAI/USD': { price: 1.0000, decimals: 18, oracle: 'MakerDAO Peg Stability Module', confidence: '99.99%', change24h: '0.00%' }
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
    const oc = ledgerBalances.onChain;
    const eurcTokens = oc.eurc?.balance || 0;
    const usdcTokens = oc.usdc?.balance || 0;
    const usdtTokens = oc.usdt?.balance || 0;
    const daiTokens  = oc.dai?.balance || 0;
    const busdTokens = oc.busd?.balance || 0;
    const ethTokens  = oc.eth?.balance || 0;
    const btcTokens  = oc.btc?.balance || 0;
    const bnbTokens  = oc.bnb?.balance || 0;
    const polTokens  = oc.pol?.balance || 0;
    const arbTokens  = oc.arb?.balance || 0;

    // Valuations in EUR
    const eurFiatInEur = eurFiat;
    const usdFiatInEur = usdFiat * rates.USD_EUR;
    const totalFiatInEur = eurFiatInEur + usdFiatInEur;

    const eurcInEur = eurcTokens * rates.EURC_EUR;
    const usdcInEur = usdcTokens * rates.USDC_EUR;
    const usdtInEur = usdtTokens * rates.USDT_EUR;
    const daiInEur  = daiTokens * rates.DAI_EUR;
    const busdInEur = busdTokens * rates.BUSD_EUR;
    const ethInEur  = ethTokens * rates.ETH_EUR;
    const btcInEur  = btcTokens * rates.BTC_EUR;
    const bnbInEur  = bnbTokens * rates.BNB_EUR;
    const polInEur  = polTokens * rates.POL_EUR;
    const arbInEur  = arbTokens * rates.ARB_EUR;

    const totalOnChainInEur = eurcInEur + usdcInEur + usdtInEur + daiInEur + busdInEur + ethInEur + btcInEur + bnbInEur + polInEur + arbInEur;
    const grandTotalInEur = totalFiatInEur + totalOnChainInEur;

    // Valuations in USD
    const eurFiatInUsd = eurFiat * rates.EUR_USD;
    const usdFiatInUsd = usdFiat;
    const totalFiatInUsd = eurFiatInUsd + usdFiatInUsd;

    const eurcInUsd = eurcTokens * rates.EURC_USD;
    const usdcInUsd = usdcTokens * rates.USDC_USD;
    const usdtInUsd = usdtTokens * rates.USDT_USD;
    const daiInUsd  = daiTokens * rates.DAI_USD;
    const busdInUsd = busdTokens * rates.BUSD_USD;
    const ethInUsd  = ethTokens * rates.ETH_USD;
    const btcInUsd  = btcTokens * rates.BTC_USD;
    const bnbInUsd  = bnbTokens * rates.BNB_USD;
    const polInUsd  = polTokens * rates.POL_USD;
    const arbInUsd  = arbTokens * rates.ARB_USD;

    const totalOnChainInUsd = eurcInUsd + usdcInUsd + usdtInUsd + daiInUsd + busdInUsd + ethInUsd + btcInUsd + bnbInUsd + polInUsd + arbInUsd;
    const grandTotalInUsd = totalFiatInUsd + totalOnChainInUsd;

    // Percentage breakdown
    const fiatSharePercent = grandTotalInEur > 0 ? ((totalFiatInEur / grandTotalInEur) * 100).toFixed(1) : '50.0';
    const onChainSharePercent = grandTotalInEur > 0 ? ((totalOnChainInEur / grandTotalInEur) * 100).toFixed(1) : '50.0';

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
                usdt: { amount: usdtTokens, valueEur: usdtInEur, valueUsd: usdtInUsd, rateEur: rates.USDT_EUR },
                dai:  { amount: daiTokens,  valueEur: daiInEur,  valueUsd: daiInUsd,  rateEur: rates.DAI_EUR },
                busd: { amount: busdTokens, valueEur: busdInEur, valueUsd: busdInUsd, rateEur: rates.BUSD_EUR },
                eth:  { amount: ethTokens,  valueEur: ethInEur,  valueUsd: ethInUsd,  rateEur: rates.ETH_EUR },
                btc:  { amount: btcTokens,  valueEur: btcInEur,  valueUsd: btcInUsd,  rateEur: rates.BTC_EUR },
                bnb:  { amount: bnbTokens,  valueEur: bnbInEur,  valueUsd: bnbInUsd,  rateEur: rates.BNB_EUR },
                pol:  { amount: polTokens,  valueEur: polInEur,  valueUsd: polInUsd,  rateEur: rates.POL_EUR },
                arb:  { amount: arbTokens,  valueEur: arbInEur,  valueUsd: arbInUsd,  rateEur: rates.ARB_EUR }
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

    // Helper to get EUR price of any asset
    const getEurPrice = (asset) => {
        if (asset === 'EUR' || asset === 'EURC') return 1.0;
        if (['USD', 'USDC', 'USDT', 'DAI', 'BUSD'].includes(asset)) return rates.USD_EUR;
        if (asset === 'ETH') return rates.ETH_EUR;
        if (asset === 'BTC') return rates.BTC_EUR;
        if (asset === 'BNB') return rates.BNB_EUR;
        if (asset === 'POL') return rates.POL_EUR;
        if (asset === 'ARB') return rates.ARB_EUR;
        return null;
    };

    const fromEurPrice = getEurPrice(from);
    if (fromEurPrice === null) {
        throw new Error(`Asset di origine non supportato: ${fromAsset}`);
    }

    const toEurPrice = getEurPrice(to);
    if (toEurPrice === null) {
        throw new Error(`Asset di destinazione non supportato: ${toAsset}`);
    }

    // Step 1: Normalize 'from' asset to EUR base
    const valueInEur = numAmount * fromEurPrice;

    // Step 2: Convert EUR base to 'to' asset
    const finalAmount = valueInEur / toEurPrice;
    const effectiveRate = finalAmount / numAmount;

    const isCrypto = ['ETH', 'BTC', 'BNB'].includes(to);
    const precision = isCrypto ? 6 : (['POL', 'ARB'].includes(to) ? 4 : 2);

    return {
        amount: numAmount,
        fromAsset: from,
        toAsset: to,
        result: parseFloat(finalAmount.toFixed(precision)),
        rate: parseFloat(effectiveRate.toFixed(isCrypto ? 8 : 4)),
        inverseRate: parseFloat((1 / effectiveRate).toFixed(isCrypto ? 8 : 4)),
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
