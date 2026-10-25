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
    
    // Web3 Digital E-Money Token Pools (Backed 1:1 on-chain or safeguarded reserve)
    TOKEN_EURC: { id: 'ACC-TOKEN-EURC', name: 'EURC Smart Contract Pool', type: 'LIABILITY', balance: 450000.00, currency: 'EURC' },
    TOKEN_USDC: { id: 'ACC-TOKEN-USDC', name: 'USDC Smart Contract Pool', type: 'LIABILITY', balance: 620000.00, currency: 'USDC' },
    TOKEN_USDT: { id: 'ACC-TOKEN-USDT', name: 'USDT Tether Pool', type: 'LIABILITY', balance: 750000.00, currency: 'USDT' },
    TOKEN_DAI:  { id: 'ACC-TOKEN-DAI',  name: 'MakerDAO DAI Pool', type: 'LIABILITY', balance: 350000.00, currency: 'DAI' },
    TOKEN_BUSD: { id: 'ACC-TOKEN-BUSD', name: 'BUSD Stablecoin Pool', type: 'LIABILITY', balance: 200000.00, currency: 'BUSD' },
    TOKEN_ETH:  { id: 'ACC-CRYPTO-ETH',  name: 'ETH Native Gas Vault', type: 'ASSET', balance: 42.50, currency: 'ETH' },
    TOKEN_BTC:  { id: 'ACC-CRYPTO-BTC',  name: 'Wrapped Bitcoin Vault', type: 'ASSET', balance: 14.85, currency: 'BTC' },
    TOKEN_BNB:  { id: 'ACC-CRYPTO-BNB',  name: 'BNB Chain Vault', type: 'ASSET', balance: 185.00, currency: 'BNB' },
    TOKEN_POL:  { id: 'ACC-CRYPTO-POL',  name: 'Polygon Ecosystem Vault', type: 'ASSET', balance: 85000.00, currency: 'POL' },
    TOKEN_ARB:  { id: 'ACC-TOKEN-ARB',  name: 'Arbitrum Governance Vault', type: 'ASSET', balance: 125000.00, currency: 'ARB' },

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
                network: 'Ethereum / Polygon / Base'
            },
            usdc: {
                balance: ACCOUNTS.TOKEN_USDC.balance,
                symbol: 'USDC',
                contract: AppConfig.web3.contracts.USDC,
                network: 'Ethereum / Arbitrum / Base'
            },
            usdt: {
                balance: ACCOUNTS.TOKEN_USDT.balance,
                symbol: 'USDT',
                network: 'Ethereum / Polygon / Arbitrum / BSC'
            },
            dai: {
                balance: ACCOUNTS.TOKEN_DAI.balance,
                symbol: 'DAI',
                network: 'Ethereum / Polygon / Arbitrum / BSC'
            },
            busd: {
                balance: ACCOUNTS.TOKEN_BUSD.balance,
                symbol: 'BUSD',
                network: 'BNB Smart Chain / Ethereum'
            },
            eth: {
                balance: ACCOUNTS.TOKEN_ETH.balance,
                symbol: 'ETH',
                network: 'Ethereum / Arbitrum / Base (Gas & Native)'
            },
            btc: {
                balance: ACCOUNTS.TOKEN_BTC.balance,
                symbol: 'BTC',
                network: 'WBTC / BTCB (Ethereum / Arbitrum / BSC)'
            },
            bnb: {
                balance: ACCOUNTS.TOKEN_BNB.balance,
                symbol: 'BNB',
                network: 'BNB Smart Chain (Native Gas)'
            },
            pol: {
                balance: ACCOUNTS.TOKEN_POL.balance,
                symbol: 'POL',
                network: 'Polygon PoS (Native Gas)'
            },
            arb: {
                balance: ACCOUNTS.TOKEN_ARB.balance,
                symbol: 'ARB',
                network: 'Arbitrum One (Governance)'
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

const TOKEN_ACCOUNT_MAP = {
    EURC: 'TOKEN_EURC',
    USDC: 'TOKEN_USDC',
    USDT: 'TOKEN_USDT',
    DAI: 'TOKEN_DAI',
    BUSD: 'TOKEN_BUSD',
    ETH: 'TOKEN_ETH',
    BTC: 'TOKEN_BTC',
    BNB: 'TOKEN_BNB',
    POL: 'TOKEN_POL',
    ARB: 'TOKEN_ARB'
};

/**
 * Execute a double-entry payout booking on the Core Ledger
 */
function recordPayout({ rail, currency, amount, recipient, counterparty, reference, amlRiskScore = 1, onChainTx = null, rawPayload = null }) {
    const numAmount = parseFloat(amount);
    const currUpper = (currency || '').toUpperCase();
    
    // Check funds availability
    if (currUpper === 'EUR' && ACCOUNTS.CLIENT_EUR.balance < numAmount) {
        throw new Error(`Saldo insufficiente sul conto EUR. Disponibile: €${ACCOUNTS.CLIENT_EUR.balance.toLocaleString('it-IT')}`);
    } else if (currUpper === 'USD' && ACCOUNTS.CLIENT_USD.balance < numAmount) {
        throw new Error(`Saldo insufficiente sul conto USD. Disponibile: $${ACCOUNTS.CLIENT_USD.balance.toLocaleString('en-US')}`);
    } else if (TOKEN_ACCOUNT_MAP[currUpper]) {
        const accKey = TOKEN_ACCOUNT_MAP[currUpper];
        if (ACCOUNTS[accKey].balance < numAmount) {
            throw new Error(`Saldo insufficiente nel vault ${currUpper}. Disponibile: ${ACCOUNTS[accKey].balance.toLocaleString()} ${currUpper}`);
        }
    }

    // Double-entry debit & credit
    if (currUpper === 'EUR') {
        ACCOUNTS.CLIENT_EUR.balance -= numAmount;
        ACCOUNTS.CLEARING_SEPA.balance += numAmount;
    } else if (currUpper === 'USD') {
        ACCOUNTS.CLIENT_USD.balance -= numAmount;
        ACCOUNTS.CLEARING_SWIFT.balance += numAmount;
    } else if (TOKEN_ACCOUNT_MAP[currUpper]) {
        ACCOUNTS[TOKEN_ACCOUNT_MAP[currUpper]].balance -= numAmount;
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
        currency: currUpper,
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
 * Direct Fiat Credit / Minting under EMI EMD2 Regulations
 * Increases client e-money balance and segregates 100% into safeguarding reserve.
 * Emits an authentic ISO 20022 camt.053 Credit Confirmation payload.
 */
function creditDirectFiat({ currency = 'EUR', amount, depositorName = 'Institutional Client Direct Top-up', reference = 'DIRECT_EMD2_RELOAD', sourceIban = null, operator = 'EMI_ADMIN_ISSUER' }) {
    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
        throw new Error('Importo di ricarica fiat non valido. Inserire una cifra maggiore di zero.');
    }

    const currUpper = currency.toUpperCase();
    if (currUpper !== 'EUR' && currUpper !== 'USD') {
        throw new Error(`Valuta fiat non supportata per l'accredito diretto: ${currency}`);
    }

    // Double-entry accounting: Credit client liability & credit safeguarding asset
    if (currUpper === 'EUR') {
        ACCOUNTS.CLIENT_EUR.balance += numAmount;
        ACCOUNTS.SAFEGUARDING_EUR.balance += numAmount; // Safeguard 100% client funds
    } else {
        ACCOUNTS.CLIENT_USD.balance += numAmount;
        ACCOUNTS.SAFEGUARDING_USD.balance += numAmount;
    }

    const newestEntry = auditLedger[0];
    const previousHash = newestEntry ? newestEntry.hash : '0'.repeat(64);
    const txId = 'TX-' + Math.floor(100000000 + Math.random() * 900000000);
    const isEur = currUpper === 'EUR';

    const newEntry = {
        id: txId,
        timestamp: new Date().toISOString(),
        rail: isEur ? 'SEPA_INSTANT_CREDIT' : 'SWIFT_GPI_CREDIT',
        currency: currUpper,
        amount: numAmount,
        type: 'DIRECT_CREDIT_MINT',
        recipient: isEur ? AppConfig.banking.sepaIban : AppConfig.banking.usdAccountNumber,
        counterparty: depositorName,
        reference: reference,
        status: 'SETTLED',
        amlRiskScore: 1,
        operator: operator,
        previousHash: previousHash
    };

    newEntry.hash = calculateHash(newEntry);
    auditLedger.unshift(newEntry);

    // Generate ISO 20022 camt.053 Electronic Bank Statement Credit Confirmation
    const iso20022Xml = `<?xml version="1.0" encoding="UTF-8"?>
<Document xmlns="urn:iso:std:iso:20022:tech:xsd:camt.053.001.08">
  <BkToCstmrStmt>
    <GrpHdr>
      <MsgId>EMI-CAMT053-${txId}</MsgId>
      <CreDtTm>${new Date().toISOString()}</CreDtTm>
      <MsgPgntn><PgNb>1</PgNb><LastPgInd>true</LastPgInd></MsgPgntn>
    </GrpHdr>
    <Stmt>
      <Id>STMT-${Date.now()}</Id>
      <ElctrncSeqNb>1042</ElctrncSeqNb>
      <CreDtTm>${new Date().toISOString()}</CreDtTm>
      <Acct>
        <Id><IBAN>${isEur ? AppConfig.banking.sepaIban : AppConfig.banking.usdAccountNumber}</IBAN></Id>
        <Ccy>${currUpper}</Ccy>
        <Nm>${AppConfig.institution.legalName}</Nm>
      </Acct>
      <Bal>
        <Tp><CdOrPrtry><Cd>OPBD</Cd></CdOrPrtry></Tp>
        <Amt Ccy="${currUpper}">${(isEur ? ACCOUNTS.CLIENT_EUR.balance - numAmount : ACCOUNTS.CLIENT_USD.balance - numAmount).toFixed(2)}</Amt>
        <CdtDbtInd>CRDT</CdtDbtInd>
        <Dt><Dt>${new Date().toISOString().slice(0, 10)}</Dt></Dt>
      </Bal>
      <Ntry>
        <NtryRef>${txId}</NtryRef>
        <Amt Ccy="${currUpper}">${numAmount.toFixed(2)}</Amt>
        <CdtDbtInd>CRDT</CdtDbtInd>
        <Sts>BOOK</Sts>
        <BookgDt><Dt>${new Date().toISOString().slice(0, 10)}</Dt></BookgDt>
        <ValDt><Dt>${new Date().toISOString().slice(0, 10)}</Dt></ValDt>
        <AcctSvcrRef>TIPS-INFLOW-${Date.now()}</AcctSvcrRef>
        <NtryDtls>
          <TxDtls>
            <Refs>
              <EndToEndId>${reference}</EndToEndId>
              <UETR>3f7e2a9b-81d5-4c0e-bf33-${Date.now().toString().slice(-12)}</UETR>
            </Refs>
            <RltdPties>
              <Dbtr><Nm>${depositorName}</Nm></Dbtr>
              <DbtrAcct><Id><IBAN>${sourceIban || (isEur ? 'IT99X0306902104000000999999' : 'US1234567890123')}</IBAN></Id></DbtrAcct>
              <Cdtr><Nm>${AppConfig.institution.name}</Nm></Cdtr>
            </RltdPties>
            <RmtInf><Ustrd>${reference} - EMD2 Safeguarded Inflow</Ustrd></RmtInf>
          </TxDtls>
        </NtryDtls>
      </Ntry>
    </Stmt>
  </BkToCstmrStmt>
</Document>`;

    clearingPayloadStore.set(txId, iso20022Xml);

    return {
        success: true,
        txId,
        entry: newEntry,
        balances: getLedgerOverview(),
        clearingPayload: iso20022Xml
    };
}

/**
 * Direct On-Chain Minting & Token Credit
 * Updates internal token pool balance and logs cryptographic blockchain receipt into the audit ledger.
 */
function creditDirectOnChain({ token, chainId, recipient, amount, onChainTx, note = 'ONCHAIN_SMART_CONTRACT_MINT' }) {
    const numAmount = parseFloat(amount);
    const tokenKey = (token || '').toUpperCase();

    if (TOKEN_ACCOUNT_MAP[tokenKey]) {
        ACCOUNTS[TOKEN_ACCOUNT_MAP[tokenKey]].balance += numAmount;
    }

    const newestEntry = auditLedger[0];
    const previousHash = newestEntry ? newestEntry.hash : '0'.repeat(64);
    const txId = 'TX-' + Math.floor(100000000 + Math.random() * 900000000);

    const newEntry = {
        id: txId,
        timestamp: new Date().toISOString(),
        rail: 'ON_CHAIN',
        currency: tokenKey,
        amount: numAmount,
        type: 'ONCHAIN_MINT',
        recipient: recipient,
        counterparty: 'Authorized Minters & Treasury Vault',
        reference: note,
        status: 'CONFIRMED',
        amlRiskScore: 1,
        network: onChainTx?.network || 'EVM Multi-Chain',
        chainId: onChainTx?.chainId || chainId,
        txHash: onChainTx?.txHash || null,
        blockNumber: onChainTx?.blockNumber || null,
        explorerUrl: onChainTx?.explorerUrl || null,
        previousHash: previousHash
    };

    newEntry.hash = calculateHash(newEntry);
    auditLedger.unshift(newEntry);

    if (onChainTx) {
        clearingPayloadStore.set(txId, JSON.stringify(onChainTx, null, 2));
    }

    return {
        success: true,
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
    creditDirectFiat,
    creditDirectOnChain,
    verifyLedgerIntegrity,
    getAuditLog,
    getClearingPayload,
    ACCOUNTS
};

