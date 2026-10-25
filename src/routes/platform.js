const express = require('express');
const router = express.Router();
const coreLedger = require('../services/CoreLedger');
const compliance = require('../services/ComplianceAML');
const paymentRails = require('../services/PaymentRails');
const blockchain = require('../services/BlockchainService');
const oracle = require('../services/OracleService');
const AppConfig = require('../config/AppConfig');

/**
 * GET /balance - Backward-compatible endpoint
 */
router.get('/balance', (req, res) => {
    const overview = coreLedger.getLedgerOverview();
    res.json({
        balance: overview.fiat.eur.balance,
        usdBalance: overview.fiat.usd.balance,
        institution: overview.institution.name,
        license: overview.institution.license,
        safeguardingRatio: overview.institution.safeguardingRatio
    });
});

/**
 * GET /overview - Full institutional overview of all fiat & on-chain balances with oracle valuation and KYC status
 */
router.get('/overview', (req, res) => {
    try {
        const overview = coreLedger.getLedgerOverview();
        const complianceConfig = compliance.getComplianceConfig();
        const walletInfo = blockchain.getWalletInfo();
        const portfolioValuation = oracle.calculatePortfolioValuation(overview);
        const kycStatus = compliance.getKycProfile();

        res.json({
            ...overview,
            compliance: complianceConfig,
            walletInfo,
            portfolioValuation,
            kycStatus
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

/**
 * GET /kyc-status - Retrieve KYC user verification levels and document status
 */
router.get('/kyc-status', (req, res) => {
    try {
        const kycProfile = compliance.getKycProfile();
        res.json(kycProfile);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

/**
 * POST /kyc-document - Submit / upload required documentation for EMI regulatory compliance
 */
router.post('/kyc-document', (req, res) => {
    try {
        const { docId, filename } = req.body;
        if (!docId) {
            return res.status(400).json({ error: 'Identificativo documento obbligatorio.' });
        }
        const updatedKyc = compliance.uploadKycDocument({ docId, filename });
        res.json({
            success: true,
            message: 'Documento caricato con successo. Preso in carico dall\'ufficio Compliance per la revisione.',
            kycStatus: updatedKyc
        });
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

/**
 * GET /oracle-rates - Retrieve real-time aggregated oracle price feeds and portfolio valuation
 */
router.get('/oracle-rates', (req, res) => {
    try {
        const overview = coreLedger.getLedgerOverview();
        const valuationData = oracle.calculatePortfolioValuation(overview);
        res.json(valuationData);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

/**
 * POST /convert - Real-time asset conversion using aggregated oracle feeds
 */
router.post('/convert', (req, res) => {
    try {
        const { amount, fromAsset = 'ETH', toAsset = 'EUR' } = req.body;
        const conversion = oracle.convertAsset({
            amount: parseFloat(amount) || 0,
            fromAsset,
            toAsset
        });
        res.json(conversion);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

/**
 * GET /wallet - Retrieve operational institutional wallet details
 */
router.get('/wallet', (req, res) => {
    res.json(blockchain.getWalletInfo());
});

/**
 * GET /message/:txId - Retrieve authentic ISO 20022 XML or SWIFT FIN MT103 clearing message
 */
router.get('/message/:txId', (req, res) => {
    const { txId } = req.params;
    const payload = coreLedger.getClearingPayload(txId);
    if (!payload) {
        return res.status(404).json({ error: `Nessun messaggio di clearing archiviato per la transazione ${txId}` });
    }
    res.json({
        txId,
        payload: payload,
        format: payload.startsWith('<?xml') ? 'ISO_20022_XML' : (payload.startsWith('{1:F01') ? 'SWIFT_FIN_MT103' : 'RAW_HEX_SIGNED_TX')
    });
});

/**
 * POST /payout - Dual-rail payout execution (SEPA, SWIFT, On-Chain)
 */
router.post('/payout', async (req, res) => {
    try {
        const {
            rail = 'SEPA',
            amount,
            // Fiat SEPA fields
            iban,
            beneficiaryName,
            remittanceInfo,
            // Fiat SWIFT fields
            swiftBic,
            accountNumber,
            routingNumber,
            // Web3 On-Chain fields
            token = 'EURC',
            recipientAddress,
            network,
            customSender
        } = req.body;

        const numAmount = parseFloat(amount);
        if (!amount || isNaN(numAmount) || numAmount <= 0) {
            return res.status(400).json({ error: "Importo non valido o mancante. Inserire una cifra maggiore di zero." });
        }

        // Determine currency and recipient based on rail
        let currency = 'EUR';
        let recipientIdentifier = iban;
        let counterparty = beneficiaryName || 'Beneficiario Regolamentato';

        if (rail === 'SWIFT') {
            currency = 'USD';
            recipientIdentifier = `${accountNumber} @ ${swiftBic}`;
            if (!accountNumber || !swiftBic) {
                return res.status(400).json({ error: "Per il circuito SWIFT sono obbligatori Account Number e codice SWIFT/BIC." });
            }
        } else if (rail === 'ON_CHAIN') {
            currency = token.toUpperCase();
            recipientIdentifier = recipientAddress;
            counterparty = `EVM Wallet (${token})`;
            if (!recipientAddress) {
                return res.status(400).json({ error: "Indirizzo wallet Ethereum/EVM obbligatorio per transazioni on-chain." });
            }
        } else {
            // Default SEPA
            if (!iban) {
                return res.status(400).json({ error: "IBAN beneficiario obbligatorio per il circuito SEPA." });
            }
        }

        // 1. Mandatory AML / KYC / Sanctions Screening
        const screeningResult = compliance.screenCompliance({
            amount: numAmount,
            recipient: recipientIdentifier,
            counterpartyName: counterparty,
            rail: rail
        });

        if (!screeningResult.approved) {
            console.warn(`[AML/CFT ALERT] Payout Blocked. Reason: ${screeningResult.reason}`);
            return res.status(403).json({
                error: screeningResult.reason,
                riskScore: screeningResult.riskScore,
                blockedByCompliance: true
            });
        }

        // 2. Dispatch across selected rail
        let railReceipt = null;
        let onChainDetails = null;
        let rawPayload = null;

        if (rail === 'SEPA') {
            railReceipt = await paymentRails.dispatchSEPA({
                iban,
                amount: numAmount,
                beneficiaryName,
                remittanceInfo
            });
            rawPayload = railReceipt.isoXmlMessage;
        } else if (rail === 'SWIFT') {
            railReceipt = await paymentRails.dispatchSWIFT({
                swiftBic,
                accountNumber,
                routingNumber,
                amount: numAmount,
                beneficiaryName,
                remittanceInfo
            });
            rawPayload = railReceipt.swiftFinMessage;
        } else if (rail === 'ON_CHAIN') {
            railReceipt = await blockchain.dispatchOnChainTransaction({
                token: currency,
                recipientAddress,
                amount: numAmount,
                network,
                customSender
            });
            onChainDetails = {
                txHash: railReceipt.txHash,
                network: railReceipt.network,
                blockNumber: railReceipt.blockNumber,
                rawSignedTx: railReceipt.rawSignedTx
            };
            rawPayload = railReceipt.rawSignedTx;
        }

        // 3. Double-entry posting in Core Ledger & cryptographic chaining
        const ledgerResult = coreLedger.recordPayout({
            rail: railReceipt.rail,
            currency: currency,
            amount: numAmount,
            recipient: recipientIdentifier,
            counterparty: counterparty,
            reference: remittanceInfo || (rail === 'ON_CHAIN' ? `ONCHAIN_${currency}_TRANSFER` : 'EMI_DIRECT_CLEARING'),
            amlRiskScore: screeningResult.riskScore,
            onChainTx: onChainDetails,
            rawPayload: rawPayload
        });

        console.log(`[CORE LEDGER] Payout Settled. TxId: ${ledgerResult.txId}, Rail: ${railReceipt.rail}, Amount: ${numAmount} ${currency}`);

        res.json({
            success: true,
            message: `Payout di ${numAmount.toLocaleString('it-IT')} ${currency} eseguito con successo sul circuito ${railReceipt.rail}.`,
            txId: ledgerResult.txId,
            railDetails: railReceipt,
            ledgerEntry: ledgerResult.entry,
            hasClearingMessage: Boolean(rawPayload),
            remainingBalance: currency === 'EUR' ? ledgerResult.balances.fiat.eur.balance : 
                             (currency === 'USD' ? ledgerResult.balances.fiat.usd.balance : 
                             (currency === 'EURC' ? ledgerResult.balances.onChain.eurc.balance : ledgerResult.balances.onChain.usdc.balance)),
            currency: currency,
            balances: ledgerResult.balances
        });

    } catch (err) {
        console.error('[PAYOUT ERROR]', err.message);
        res.status(400).json({ error: err.message });
    }
});

/**
 * GET /audit-log - Retrieve immutable chained audit trail
 */
router.get('/audit-log', (req, res) => {
    const limit = parseInt(req.query.limit, 10) || 100;
    const logs = coreLedger.getAuditLog(limit);
    res.json({
        total: logs.length,
        logs: logs
    });
});

/**
 * GET /verify-ledger - Cryptographic verification of SHA-256 chain
 */
router.get('/verify-ledger', (req, res) => {
    const proof = coreLedger.verifyLedgerIntegrity();
    res.json(proof);
});

/**
 * POST /aml-screen - Pre-screening check API for frontend input validation
 */
router.post('/aml-screen', (req, res) => {
    const { amount, recipient, counterpartyName, rail } = req.body;
    const result = compliance.screenCompliance({
        amount: parseFloat(amount) || 0,
        recipient,
        counterpartyName,
        rail
    });
    res.json(result);
});

module.exports = router;
