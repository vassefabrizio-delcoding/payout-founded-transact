/**
 * YieldStrategyService.js
 * -----------------------------------------------------------------------------
 * Institutional Yield & ROI Simulation Engine for Regulated EMI Portfolios.
 * Compares interest-bearing bank safeguarding accounts (BCE / Sovereign paper under EMD2)
 * versus institutional on-chain stablecoin staking (EURC / USDC DeFi Prime pools).
 */

class YieldStrategyService {
    constructor() {
        this.benchmarks = {
            safeguarding: {
                name: 'Conto di Salvaguardia Bancario (EMD2 Regulated)',
                code: 'SAFEGUARDING_BANK',
                institution: 'Banca Depositaria Istituzionale (Banca d\'Italia / BCE)',
                riskRating: 'AAA',
                riskScore: 1.0,
                liquidity: 'T+0 (Disponibilità Immediata)',
                capitalProtection: '100% Segregazione Fondi Clienti (Art. 7 Direttiva 2009/110/CE)',
                currentApy: 3.25, // BCE deposit facility baseline
                treasuryBillsApy: 3.45,
                effectiveApy: 3.35,
                feesBps: 10 // 0.10% custodia bancaria istituzionale
            },
            stakedStablecoins: {
                name: 'Staking On-Chain Stablecoin (EVM Smart Contract)',
                code: 'ONCHAIN_STAKED_STABLECOINS',
                protocol: 'Aave v3 Prime / Sky DSR / Compound Institutional Vaults',
                riskRating: 'A-',
                riskScore: 4.8,
                liquidity: 'T+1 (Unstaking smart contract + gas)',
                capitalProtection: 'Over-collateralized / Smart contract audited',
                eurcApy: 5.40,
                usdcApy: 6.85,
                effectiveApy: 6.125, // Media ponderata
                gasRebalanceBps: 15 // 0.15% stima gas/transazioni annuali
            }
        };

        this.scenarios = {
            baseline: {
                id: 'baseline',
                label: 'Scenario Baseline (Tassi Ufficiali Correnti BCE/DeFi)',
                safeguardingRate: 3.35,
                stakedRate: 6.125
            },
            conservative: {
                id: 'conservative',
                label: 'Scenario Conservativo (Taglio Tassi BCE & DeFi Calma)',
                safeguardingRate: 2.60,
                stakedRate: 4.40
            },
            expansion: {
                id: 'expansion',
                label: 'Scenario Espansivo (Alti Volumi DeFi & Picco Rendimento)',
                safeguardingRate: 3.80,
                stakedRate: 8.65
            }
        };
    }

    /**
     * Get baseline benchmark configuration and market yields
     */
    getBenchmarks() {
        return {
            updatedAt: new Date().toISOString(),
            benchmarks: this.benchmarks,
            scenarios: this.scenarios,
            regulatoryGuidelines: {
                standard: 'EMD2 (Electronic Money Directive 2009/110/EC) & D.Lgs 385/1993 (TUB)',
                maxUnregulatedAllocation: 40, // Max 40% in alternative liquid assets without additional capital requirement
                recommendedSafeguardingRatio: 70 // 70% bank safeguarding recommended
            }
        };
    }

    /**
     * Simulate yield projections over time
     * @param {Object} params
     * @param {number} params.principal - Initial capital in EUR
     * @param {number} params.safeguardingShare - Percentage (0-100) allocated to safeguarding
     * @param {number} params.horizonMonths - Duration in months (e.g. 1, 3, 6, 12, 24, 36, 60)
     * @param {string} params.scenario - 'baseline' | 'conservative' | 'expansion'
     * @param {string} params.compounding - 'monthly' | 'daily' | 'annual'
     */
    simulateYield({
        principal = 500000,
        safeguardingShare = 70,
        horizonMonths = 12,
        scenario = 'baseline',
        compounding = 'monthly'
    } = {}) {
        const capital = Math.max(1000, Number(principal) || 500000);
        const safeShare = Math.min(100, Math.max(0, Number(safeguardingShare) || 70));
        const stakedShare = 100 - safeShare;
        const months = Math.min(60, Math.max(1, parseInt(horizonMonths, 10) || 12));
        const selectedScenario = this.scenarios[scenario] || this.scenarios.baseline;

        const safeAnnualNet = Math.max(0, (selectedScenario.safeguardingRate - (this.benchmarks.safeguarding.feesBps / 100)) / 100);
        const stakedAnnualNet = Math.max(0, (selectedScenario.stakedRate - ((this.benchmarks.stakedStablecoins.gasRebalanceBps || 15) / 100)) / 100);
        const blendedAnnualNet = (safeAnnualNet * (safeShare / 100)) + (stakedAnnualNet * (stakedShare / 100));

        // Compounding frequency per year
        let n = 12; // monthly
        if (compounding === 'daily') n = 365;
        if (compounding === 'annual') n = 1;

        const trajectory = [];
        const startDate = new Date();

        let currentSafeCapital = capital * (safeShare / 100);
        let currentStakedCapital = capital * (stakedShare / 100);

        // Generate month-by-month points
        for (let m = 0; m <= months; m++) {
            const date = new Date(startDate);
            date.setMonth(date.getMonth() + m);

            const tYears = m / 12;

            // Compound interest formula: A = P * (1 + r/n)^(n*t)
            const safeBal = capital * Math.pow(1 + (safeAnnualNet / n), n * tYears);
            const stakedBal = capital * Math.pow(1 + (stakedAnnualNet / n), n * tYears);
            
            // Blended trajectory
            const hybridSafePart = (capital * (safeShare / 100)) * Math.pow(1 + (safeAnnualNet / n), n * tYears);
            const hybridStakedPart = (capital * (stakedShare / 100)) * Math.pow(1 + (stakedAnnualNet / n), n * tYears);
            const hybridBal = hybridSafePart + hybridStakedPart;

            trajectory.push({
                month: m,
                dateStr: date.toLocaleDateString('it-IT', { month: 'short', year: '2-digit' }),
                fullDate: date.toISOString().split('T')[0],
                safeguardingBalance: Math.round(safeBal * 100) / 100,
                safeguardingYield: Math.round((safeBal - capital) * 100) / 100,
                stakedBalance: Math.round(stakedBal * 100) / 100,
                stakedYield: Math.round((stakedBal - capital) * 100) / 100,
                hybridBalance: Math.round(hybridBal * 100) / 100,
                hybridYield: Math.round((hybridBal - capital) * 100) / 100,
                hybridSafePortion: Math.round(hybridSafePart * 100) / 100,
                hybridStakedPortion: Math.round(hybridStakedPart * 100) / 100
            });
        }

        const lastPoint = trajectory[trajectory.length - 1];
        const deltaVsSafeguarding = Math.round((lastPoint.hybridBalance - lastPoint.safeguardingBalance) * 100) / 100;
        const hybridRoiPct = Math.round(((lastPoint.hybridBalance - capital) / capital) * 10000) / 100;
        const safeRoiPct = Math.round(((lastPoint.safeguardingBalance - capital) / capital) * 10000) / 100;
        const stakedRoiPct = Math.round(((lastPoint.stakedBalance - capital) / capital) * 10000) / 100;

        // Weighted Risk Index (1.0 = zero risk AAA, 10.0 = high risk)
        const weightedRiskScore = Math.round(((this.benchmarks.safeguarding.riskScore * safeShare) + (this.benchmarks.stakedStablecoins.riskScore * stakedShare)) / 10) / 10;

        // EMD2 Regulatory status
        let emd2Status = 'FULL_EMD2_COMPLIANT';
        let emd2Message = 'Allocazione conforme al 100% con i requisiti di salvaguardia fondi EMD2.';
        if (safeShare < 60 && safeShare >= 40) {
            emd2Status = 'SAFEGUARDING_SURVEILLANCE';
            emd2Message = 'Allocazione con quota Web3 elevata. Richiede monitoraggio liquidità T+0 e riserva supplementare.';
        } else if (safeShare < 40) {
            emd2Status = 'EXCEEDS_RECOMMENDED_DEFI_CAP';
            emd2Message = 'Attenzione: quota di salvaguardia inferiore al 40%. Richiede riserva di capitale proprio (Tier 1 capital buffer).';
        }

        return {
            params: {
                principal: capital,
                safeguardingShare: safeShare,
                stakedShare: stakedShare,
                horizonMonths: months,
                scenario: selectedScenario.id,
                compounding: compounding
            },
            rates: {
                safeguardingGross: selectedScenario.safeguardingRate,
                safeguardingNet: Math.round(safeAnnualNet * 10000) / 100,
                stakedGross: selectedScenario.stakedRate,
                stakedNet: Math.round(stakedAnnualNet * 10000) / 100,
                blendedEffectiveApy: Math.round(blendedAnnualNet * 10000) / 100
            },
            results: {
                initialCapital: capital,
                finalHybridBalance: lastPoint.hybridBalance,
                totalNetYieldEarned: lastPoint.hybridYield,
                hybridRoiPercent: hybridRoiPct,
                safeguardingFinalBalance: lastPoint.safeguardingBalance,
                safeguardingYieldEarned: lastPoint.safeguardingYield,
                safeguardingRoiPercent: safeRoiPct,
                stakedFinalBalance: lastPoint.stakedBalance,
                stakedYieldEarned: lastPoint.stakedYield,
                stakedRoiPercent: stakedRoiPct,
                extraEarningsVsSafeOnly: deltaVsSafeguarding
            },
            riskAndCompliance: {
                riskScore: weightedRiskScore,
                riskLabel: weightedRiskScore <= 2.2 ? 'Basso (Istituzionale Conservativo)' : (weightedRiskScore <= 3.5 ? 'Moderato (Bilanciato Regolamentato)' : 'Dinamico (Forte Esposizione Web3)'),
                emd2Status: emd2Status,
                emd2Message: emd2Message,
                liquidityBufferT0: `${safeShare}% T+0 istantaneo`,
                liquidityBufferT1: `${stakedShare}% T+1 protocollo DeFi`
            },
            trajectory: trajectory
        };
    }
}

module.exports = new YieldStrategyService();
