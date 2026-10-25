const express = require('express');
const router = express.Router();
const compliance = require('../services/ComplianceAML');
const coreLedger = require('../services/CoreLedger');
const AppConfig = require('../config/AppConfig');

/**
 * GET /api/admin/compliance - Overview of regulatory parameters and institutional licenses
 */
router.get('/compliance', (req, res) => {
    try {
        const config = compliance.getComplianceConfig();
        const overview = coreLedger.getLedgerOverview();
        res.json({
            config,
            safeguarding: overview.safeguarding,
            institution: AppConfig.institution,
            banking: AppConfig.banking,
            web3: {
                walletAddress: AppConfig.web3.walletAddress,
                certificateThumbprint: AppConfig.web3.certificateThumbprint
            }
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

/**
 * POST /api/admin/limits - Runtime reconfiguration of risk parameters
 */
router.post('/limits', (req, res) => {
    try {
        const { maxSingleTx, maxDailyCumulative, kycTier } = req.body;
        const updated = compliance.updateComplianceConfig({
            maxSingleTx,
            maxDailyCumulative,
            kycTier
        });
        res.json({
            success: true,
            message: 'Parametri di rischio e limiti KYC aggiornati a runtime con successo.',
            config: updated
        });
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

/**
 * POST /api/admin/test-screening - Sandbox testing of AML & sanctions rules
 */
router.post('/test-screening', (req, res) => {
    try {
        const { amount = 1000, recipient, counterpartyName, rail = 'SEPA' } = req.body;
        const result = compliance.screenCompliance({
            amount: parseFloat(amount),
            recipient,
            counterpartyName,
            rail
        });
        res.json(result);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

module.exports = router;
