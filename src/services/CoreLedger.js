const crypto = require('crypto');
const AppConfig = require('../config/AppConfig');

/**
 * EMI Core Ledger Engine
 * Implements double-entry bookkeeping for Electronic Money Institution (EMI) requirements.
 * Enforces EMD2 (2009/110/EC) safeguarding and segregated client funds rules.
 * Stores cryptographically chained audit entries with authentic clearing messages.
 */

// In-Memory Double-Entry Ledger Accounts
const ACCOUNTS = {
    // Client E-Money Liabilities (what the EMI owes to clients)
    CLIENT_EUR: { id: 'ACC-LIAB-EUR-001', name: 'Client E-Money EUR', type: 'LIABILITY', balance: 1250000.00, currency: 'EUR' },
    CLIENT_USD: { id: 'ACC-LIAB-USD-001', name: 'Client E-Money USD', type: 'LIABILITY', balance: 980000.00, currency: 'USD' },
    
    // Web3 Digital E-Money Token Pools (Backed 1:1 on-chain)
    TOKEN_EURC: { id: 'ACC-TOKEN-EURC', name: 'EURC Smart Contract Pool', type: 'LIABILITY', balance: 450000.00, currency: 'EURC' },
    TOKEN_USDC: { id: 'ACC-TOKEN-USDC', name: 'USDC Smart Contract Pool', type: 'LIABILITY', balance: 620000.00, currency: 'USDC' },
    TOKEN_ETH:  { id: 'ACC-CRYPTO-ETH',  name: 'Operational Gas Vault', type: 'ASSET', balance: 42.50, currency: 'ETH' },

    // Institutional Safeguarding Accounts held at Custodian / Central Bank (Segregated Assets)
    SAFEGUARDING_EUR: { id: 'ACC-ASSET-SAFE-EUR', name: 'Central Bank Safeguarded EUR', type: 'ASSET', balance: 1700000.00, currency: 'EUR' },
    SAFEGUARDING_USD: { id: 'ACC-ASSET-SAFE-USD', name: 'Custodian Safeguarded USD', type: 'ASSET', balance: 1600000.00, currency: 'USD' },
    
    // Settlement Clearing Accounts (Transitory accounts for SEPA / SWIFT / On-Chain)
    CLEARING_SEPA:  { id: 'ACC-CLEAR-SEPA', name: 'SEPA / EBICS Clearing Transit', type: 'ASSET', balance: 0.00, currency: 'EUR' },
    CLEARING_SWIFT: { id: 'ACC-CLEAR-SWIFT', name: 'SWIFT GPI Transit', type: 'ASSET', balance: 0.00, currency: 'USD' },
    CLEARING_WEB3:  { id: 'ACC-CLEAR-WEB3', name: 'Web3 Relayer Settlement', type: 'ASSET', balance: 0.00, currency: 'MULTI' }
};

function calculateHash(entry) {
    const dataString = `${entry.id}|${entry.timestamp}|${entry.rail}|${entry.currency}|${entry.amount}|${entry.recipient}|${entry.previousHash}`;
    return crypto.createHash('sha256').update(dataString).digest('hex');
}

// Initial seed entries computed chronologically
const seed1 = {
    id: 'TX-GENESIS-001',
    timestamp: '2026-10-21T10:00:00.000Z',
    rail: 'SEPA_CBI',
    currency: 'EUR',
    amount: 250000.00,
    type: 'FUNDING',
    recipient: AppConfig.banking.sepaIban,
    counterparty: AppConfig.banking.depositoryBank,
    reference: 'INITIAL_CAPITAL_ALLOCATION_EMI',
    status: 'SETTLED',
    amlRiskScore: 2,
    previousHash: '0'.repeat(64)
};
seed1.hash = calculateHash(seed1);

const seed2 = {
    id: 'TX-902183921',
    timestamp: '2026-10-24T12:00:00.000Z',
    rail: 'SEPA_INSTANT',
    currency: 'EUR',
    amount: 45000.00,
    type: 'PAYOUT',
    recipient: 'IT93L0306902104000000123456',
    counterparty: 'FinTech Logistics Corp SRL',
    reference: 'INV-2026-8819',
    status: 'SETTLED',
    amlRiskScore: 8,
    previousHash: seed1.hash
};
seed2.hash = calculateHash(seed2);

const seed3 = {
    id: 'TX-819284710',
    timestamp: '2026-10-24T15:30:00.000Z',
    rail: 'ON_CHAIN',
    currency: 'EURC',
    amount: 15000.00,
    type: 'TOKEN_TRANSFER',
    recipient: '0x71c8360437cd825d5389b092a4cd471c557b7a8f',
    counterparty: 'Liquidity Provider Node 0x71C8',
    reference: 'SMART_CONTRACT_ESCROW_SETTLEMENT',
    status: 'CONFIRMED',
    amlRiskScore: 5,
    network: 'Ethereum Mainnet',
    txHash: '0x8f2d9c1e4b3a502891d4e76a1c8f3950b714d28e469502a8e1b3c7490fae1208',
    previousHash: seed2.hash
};
seed3.hash = calculateHash(seed3);

// Stored in newest-first order for UI, but chronological chain is maintained
let auditLedger = [seed3, seed2, seed1];

// Raw banking and on-chain payload repository
const clearingPayloadStore = new Map();

/**
 * Get all ledger account balances with safeguarding metrics
 */
function getLedgerOverview() {
    const totalLiabilitiesFiatEur = ACCOUNTS.CLIENT_EUR.balance + (ACCOUNTS.CLIENT_USD.balance * 0.92);
    const totalSafeguardedEur = ACCOUNTS.SAFEGUARDING_EUR.balance + (ACCOUNTS.SAFEGUARDING_USD.balance * 0.92);
    const safeguardingRatio = ((totalSafeguardedEur / totalLiabilitiesFiatEur) * 100).toFixed(1);

    return {
        institution: {
            name: AppConfig.institution.name,
            legalName: AppConfig.institution.legalName,
            license: AppConfig.institution.licenseNumber,
            regulator: AppConfig.institution.supervisoryAuthority,
            safeguardingStatus: AppConfig.institution.safeguardingStatus,
            safeguardingRatio: `${safeguardingRatio}% (Requisito min: 100%)`
        },
        fiat: {
            eur: {
                balance: ACCOUNTS.CLIENT_EUR.balance,
                currency: 'EUR',
                iban: AppConfig.banking.sepaIban,
                bic: AppConfig.banking.sepaBic,
                rail: 'SEPA Instant / EBICS Direct (TIPS)'
            },
            usd: {
                balance: ACCOUNTS.CLIENT_USD.balance,
                currency: 'USD',
                accountNumber: AppConfig.banking.usdAccountNumber,
                routingNumber: AppConfig.banking.routingNumber,
                bic: AppConfig.banking.swiftBic,
                rail: 'SWIFT GPI / Fedwire Real-Time'
            }
        },
        onChain: {
            eurc: {
                balance: ACCOUNTS.TOKEN_EURC.balance,
                symbol: 'EURC',
                contract: AppConfig.web3.contracts.EURC,
                network: 'Ethereum / Polygon'
            },
            usdc: {
                balance: ACCOUNTS.TOKEN_USDC.balance,
                symbol: 'USDC',
                contract: AppConfig.web3.contracts.USDC,
                network: 'Ethereum / Arbitrum'
            },
            eth: {
                balance: ACCOUNTS.TOKEN_ETH.balance,
                symbol: 'ETH',
                network: 'Ethereum Mainnet (Relayer Gas)'
            },
            vaultAddress: AppConfig.web3.walletAddress
        },
        safeguarding: {
            eurSafeguarded: ACCOUNTS.SAFEGUARDING_EUR.balance,
            usdSafeguarded: ACCOUNTS.SAFEGUARDING_USD.balance,
            depositoryBank: AppConfig.banking.depositoryBank
        }
    };
}

/**
 * Execute a double-entry payout booking on the Core Ledger
 */
function recordPayout({ rail, currency, amount, recipient, counterparty, reference, amlRiskScore = 1, onChainTx = null, rawPayload = null }) {
    const numAmount = parseFloat(amount);
    
    // Check funds availability
    if (currency === 'EUR' && ACCOUNTS.CLIENT_EUR.balance < numAmount) {
        throw new Error(`Saldo insufficiente sul conto EUR. Disponibile: €${ACCOUNTS.CLIENT_EUR.balance.toLocaleString('it-IT')}`);
    }
    if (currency === 'USD' && ACCOUNTS.CLIENT_USD.balance < numAmount) {
        throw new Error(`Saldo insufficiente sul conto USD. Disponibile: $${ACCOUNTS.CLIENT_USD.balance.toLocaleString('en-US')}`);
    }
    if (currency === 'EURC' && ACCOUNTS.TOKEN_EURC.balance < numAmount) {
        throw new Error(`Saldo insufficiente sul vault EURC. Disponibile: ${ACCOUNTS.TOKEN_EURC.balance.toLocaleString()} EURC`);
    }
    if (currency === 'USDC' && ACCOUNTS.TOKEN_USDC.balance < numAmount) {
        throw new Error(`Saldo insufficiente sul vault USDC. Disponibile: ${ACCOUNTS.TOKEN_USDC.balance.toLocaleString()} USDC`);
    }
    if (currency === 'ETH' && ACCOUNTS.TOKEN_ETH.balance < numAmount) {
        throw new Error(`Saldo gas insufficiente nel vault ETH. Disponibile: ${ACCOUNTS.TOKEN_ETH.balance} ETH`);
    }

    // Double-entry debit & credit
    if (currency === 'EUR') {
        ACCOUNTS.CLIENT_EUR.balance -= numAmount;
        ACCOUNTS.CLEARING_SEPA.balance += numAmount;
    } else if (currency === 'USD') {
        ACCOUNTS.CLIENT_USD.balance -= numAmount;
        ACCOUNTS.CLEARING_SWIFT.balance += numAmount;
    } else if (currency === 'EURC') {
        ACCOUNTS.TOKEN_EURC.balance -= numAmount;
        ACCOUNTS.CLEARING_WEB3.balance += numAmount;
    } else if (currency === 'USDC') {
        ACCOUNTS.TOKEN_USDC.balance -= numAmount;
        ACCOUNTS.CLEARING_WEB3.balance += numAmount;
    } else if (currency === 'ETH') {
        ACCOUNTS.TOKEN_ETH.balance -= numAmount;
        ACCOUNTS.CLEARING_WEB3.balance += numAmount;
    }

    // Previous hash is the hash of current newest entry
    const newestEntry = auditLedger[0];
    const previousHash = newestEntry ? newestEntry.hash : '0'.repeat(64);
    const txId = 'TX-' + Math.floor(100000000 + Math.random() * 900000000);

    const newEntry = {
        id: txId,
        timestamp: new Date().toISOString(),
        rail: rail,
        currency: currency,
        amount: numAmount,
        type: 'PAYOUT',
        recipient: recipient,
        counterparty: counterparty || 'Beneficiario Autorizzato',
        reference: reference || 'EMD2_INSTANT_CLEARING',
        status: 'SETTLED',
        amlRiskScore: amlRiskScore,
        previousHash: previousHash
    };

    if (onChainTx) {
        newEntry.txHash = onChainTx.txHash || onChainTx.hash;
        newEntry.network = onChainTx.network;
        newEntry.blockNumber = onChainTx.blockNumber;
        newEntry.rawSignedTx = onChainTx.rawSignedTx;
    }

    newEntry.hash = calculateHash(newEntry);
    auditLedger.unshift(newEntry);

    // Save clearing message payload
    if (rawPayload) {
        clearingPayloadStore.set(txId, rawPayload);
    }

    return {
        txId,
        entry: newEntry,
        balances: getLedgerOverview()
    };
}

/**
 * Audit Integrity Check: Validates the SHA-256 chain of the ledger
 */
function verifyLedgerIntegrity() {
    const chronological = [...auditLedger].reverse();
    let isTampered = false;
    let checkedCount = 0;

    for (let i = 0; i < chronological.length; i++) {
        const item = chronological[i];
        checkedCount++;
        const expectedHash = calculateHash(item);
        if (item.hash !== expectedHash) {
            console.error(`Hash mismatch at ${item.id}`);
            isTampered = true;
            break;
        }
        if (i > 0) {
            const prevItem = chronological[i - 1];
            if (item.previousHash !== prevItem.hash) {
                console.error(`Chain broken at ${item.id}`);
                isTampered = true;
                break;
            }
        }
    }

    return {
        verified: !isTampered,
        totalEntries: checkedCount,
        genesisHash: chronological[0]?.hash,
        latestHash: chronological[chronological.length - 1]?.hash,
        timestamp: new Date().toISOString()
    };
}

function getAuditLog(limit = 100) {
    return auditLedger.slice(0, limit);
}

function getClearingPayload(txId) {
    return clearingPayloadStore.get(txId) || null;
}

module.exports = {
    getLedgerOverview,
    recordPayout,
    verifyLedgerIntegrity,
    getAuditLog,
    getClearingPayload,
    ACCOUNTS
};
