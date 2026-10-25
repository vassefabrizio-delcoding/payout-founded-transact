const compliance = require('./ComplianceAML');

/**
 * Backward compatibility adapter for Limits service
 * Delegates directly to the comprehensive EMI Compliance & AML engine.
 */
function verifyTransaction(amount, recipient = null, counterpartyName = null, rail = 'SEPA') {
    const check = compliance.screenCompliance({
        amount: parseFloat(amount),
        recipient: recipient,
        counterpartyName: counterpartyName,
        rail: rail
    });

    return {
        valid: check.approved,
        reason: check.reason,
        riskScore: check.riskScore,
        flags: check.flags
    };
}

function getLimits() {
    return compliance.getComplianceConfig();
}

function updateLimits(single, daily, kycTier) {
    return compliance.updateComplianceConfig({
        maxSingleTx: single,
        maxDailyCumulative: daily,
        kycTier: kycTier
    });
}

module.exports = {
    verifyTransaction,
    getLimits,
    updateLimits
};
