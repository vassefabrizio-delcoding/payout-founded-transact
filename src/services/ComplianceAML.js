/**
 * EMI Compliance & AML Screening Module
 * Implements 5th Anti-Money Laundering Directive (5AMLD / 6AMLD) & FATF Travel Rule
 * for Electronic Money Institutions.
 */

// Risk and limits state (can be configured at runtime by Compliance Officer)
const complianceState = {
    maxSingleTx: 500000.00,
    maxDailyCumulative: 2500000.00,
    currentDailySpent: 45000.00,
    smurfingThreshold: 9900.00, // FATF structuring alert trigger
    kycTier: 'TIER_3_ENTERPRISE', // TIER_1_BASIC (1k), TIER_2_STANDARD (50k), TIER_3_ENTERPRISE (500k)
    recentTransactionsTimestamps: []
};

// KYC Dossier & Regulatory Verification Records for EMI Compliance
const kycDossier = {
    entityName: 'Delcoding Logistics & Tech S.p.A.',
    taxId: 'IT09823410928',
    registrationNumber: 'MI-2849201',
    currentTier: 'TIER_3_ENTERPRISE',
    tierStatus: 'VERIFIED_ACTIVE',
    complianceOfficer: 'Dott.ssa M. Ferri (MLRO / Responsabile Antiriciclaggio)',
    lastVerificationAudit: '2026-09-15T09:30:00.000Z',
    nextScheduledReview: '2027-09-15T09:30:00.000Z',
    completionRate: 83, // percentage
    tiers: [
        {
            id: 'TIER_1_BASIC',
            name: 'Tier 1: Semplificata (SDD)',
            subtext: 'Simplified Due Diligence (Art. 23 D.Lgs 231/07)',
            limitPerTx: 1000.00,
            status: 'COMPLETED',
            color: 'emerald',
            badge: 'VERIFICATO 100%',
            requirements: ['Identità e codice fiscale del rappresentante legale', 'Verifica email istituzionale e recapito telefonico certificato']
        },
        {
            id: 'TIER_2_STANDARD',
            name: 'Tier 2: Ordinaria (CDD)',
            subtext: 'Customer Due Diligence (Art. 18 D.Lgs 231/07)',
            limitPerTx: 50000.00,
            status: 'COMPLETED',
            color: 'emerald',
            badge: 'VERIFICATO 100%',
            requirements: ['Certificato di residenza e utenza della sede legale (<3 mesi)', 'Questionario antiriciclaggio e valutazione profilo di rischio', 'Coordinate bancarie IBAN d\'appoggio verificate']
        },
        {
            id: 'TIER_3_ENTERPRISE',
            name: 'Tier 3: Rafforzata (EDD / Enterprise EMI)',
            subtext: 'Enhanced Due Diligence (Art. 24 D.Lgs 231/07)',
            limitPerTx: 500000.00,
            status: 'IN_REVIEW',
            color: 'amber',
            badge: 'ATTIVO • RINNOVO IN CORSO',
            requirements: ['Visura Camerale ordinaria e storica aggiornata', 'Dichiarazione identificativa Titolare Effettivo (UBO >25%)', 'Attestazione Origine dei Fondi (Source of Wealth)', 'Rinnovo annuale fascicolo di adeguata verifica antiriciclaggio']
        }
    ],
    documents: [
        {
            id: 'DOC-ID-01',
            type: 'IDENTITY_LEGAL_REP',
            title: 'Documento d\'Identità Rappresentante Legale',
            filename: 'Passaporto_Legale_Rappresentante_2026.pdf',
            category: 'Tier 1 & 2',
            status: 'VERIFIED',
            statusLabel: 'VERIFICATO',
            issuedDate: '2024-03-10',
            expiryDate: '2034-03-10',
            verifiedBy: 'Sistemi Automatici OCR & Banca Depositaria',
            isMandatory: true
        },
        {
            id: 'DOC-UBO-02',
            type: 'UBO_DECLARATION',
            title: 'Dichiarazione Titolare Effettivo (Registro UBO >25%)',
            filename: 'Dichiarazione_UBO_Attestata_Registro_Imprese.pdf',
            category: 'Tier 3 (EDD)',
            status: 'VERIFIED',
            statusLabel: 'VERIFICATO',
            issuedDate: '2026-01-20',
            expiryDate: '2027-01-20',
            verifiedBy: 'Ufficio Compliance & Notariato',
            isMandatory: true
        },
        {
            id: 'DOC-VIS-03',
            type: 'COMPANY_REGISTRATION',
            title: 'Visura Camerale Storica CCIAA (<6 mesi)',
            filename: 'Visura_Camerale_CCIAA_Milano_2026.pdf',
            category: 'Tier 2 & 3',
            status: 'VERIFIED',
            statusLabel: 'VERIFICATO',
            issuedDate: '2026-08-01',
            expiryDate: '2027-02-01',
            verifiedBy: 'Registro Imprese Telematico',
            isMandatory: true
        },
        {
            id: 'DOC-SOW-04',
            type: 'SOURCE_OF_WEALTH',
            title: 'Attestazione Origine dei Fondi (Source of Wealth)',
            filename: 'Relazione_Bancaria_Source_of_Funds_2026.pdf',
            category: 'Tier 3 (EDD)',
            status: 'IN_REVIEW',
            statusLabel: 'IN REVISIONE',
            issuedDate: '2026-10-18',
            expiryDate: '2027-10-18',
            verifiedBy: 'In valutazione da Compliance Officer',
            isMandatory: true
        },
        {
            id: 'DOC-AML-05',
            type: 'AML_QUESTIONNAIRE_RENEWAL',
            title: 'Rinnovo Questionario Adeguata Verifica Antiriciclaggio (5AMLD)',
            filename: null,
            category: 'Tier 3 (EDD)',
            status: 'REQUIRED',
            statusLabel: 'RICHIESTO',
            issuedDate: null,
            expiryDate: '2026-11-30',
            verifiedBy: 'In attesa di caricamento documentale',
            isMandatory: true
        },
        {
            id: 'DOC-AUDIT-06',
            type: 'FINANCIAL_AUDIT_REPORT',
            title: 'Relazione di Revisione & Bilancio d\'Esercizio Auditato',
            filename: null,
            category: 'Estensione Fidi (> €500k)',
            status: 'OPTIONAL',
            statusLabel: 'FACOLTATIVO',
            issuedDate: null,
            expiryDate: null,
            verifiedBy: 'Opzionale per estensione massimali fiduciari',
            isMandatory: false
        }
    ]
};

// Simulated Sanctions Watchlist (OFAC, EU Consolidated, High Risk Jurisdictions, Blacklisted Addresses)
const SANCTIONED_ENTITIES = [
    'RUSSIAN EXPORT CORPORATION',
    'IRAN PETROCHEMICAL TRADING',
    'NORTH KOREA TECH SERVICES',
    'SYRIAN COMMERCIAL ENTERPRISE',
    'DARKNET MIXER LLC',
    'TORNADO CASH PROTOCOL'
];

const SANCTIONED_IBAN_PREFIXES = ['RU', 'IR', 'KP', 'SY', 'CU'];

const BLACKLISTED_CRYPTO_ADDRESSES = [
    '0x8576acc5c05d6ce0b48b3b337abc18421592792c',
    '0xd90e2f925da726b50c4ed8d0fb90ad053324f31b',
    '0x72a5843cc08275c80f4a869a8e9e7fa56a640191'
];

/**
 * Screen counterparties for AML, PEP, and Sanctions compliance
 */
function screenCompliance({ amount, recipient, counterpartyName, rail }) {
    const numAmount = parseFloat(amount);
    const flags = [];
    let riskScore = 1;

    // 1. Sanctions Check by Recipient
    if (recipient) {
        const cleanRecipient = recipient.trim().toUpperCase();
        const countryCode = cleanRecipient.substring(0, 2);
        if (SANCTIONED_IBAN_PREFIXES.includes(countryCode)) {
            return {
                approved: false,
                reason: `BLOCCO SANZIONI: Il paese del conto destinatario (${countryCode}) appartiene all'elenco delle giurisdizioni ad alto rischio e sanzionate (OFAC / EU).`,
                riskScore: 99,
                sanctionHit: true
            };
        }

        if (rail === 'ON_CHAIN' && BLACKLISTED_CRYPTO_ADDRESSES.includes(recipient.toLowerCase())) {
            return {
                approved: false,
                reason: 'BLOCCO ON-CHAIN: L\'indirizzo wallet destinatario è identificato nei registri OFAC / Chainalysis per attività illecite.',
                riskScore: 100,
                sanctionHit: true
            };
        }
    }

    // 2. Counterparty Name Screening
    if (counterpartyName) {
        const upperName = counterpartyName.toUpperCase();
        for (const entity of SANCTIONED_ENTITIES) {
            if (upperName.includes(entity)) {
                return {
                    approved: false,
                    reason: `BLOCCO AML: Il beneficiario '${counterpartyName}' corrisponde a un'entità inclusa nella lista delle sanzioni internazionali.`,
                    riskScore: 95,
                    sanctionHit: true
                };
            }
        }
    }

    // 3. KYC Tier Limits Enforcement
    let tierMax = 500000;
    if (complianceState.kycTier === 'TIER_1_BASIC') tierMax = 1000;
    else if (complianceState.kycTier === 'TIER_2_STANDARD') tierMax = 50000;
    
    if (numAmount > tierMax) {
        return {
            approved: false,
            reason: `Superamento del limite per il livello KYC corrente (${complianceState.kycTier}). Limite consentito: €${tierMax.toLocaleString('it-IT')}`,
            riskScore: 40
        };
    }

    // 4. EMI Risk Limit Thresholds
    if (numAmount > complianceState.maxSingleTx) {
        return {
            approved: false,
            reason: `L'importo di €${numAmount.toLocaleString('it-IT')} supera il tetto massimo autorizzato per singola transazione (€${complianceState.maxSingleTx.toLocaleString('it-IT')}).`,
            riskScore: 50
        };
    }

    if ((complianceState.currentDailySpent + numAmount) > complianceState.maxDailyCumulative) {
        return {
            approved: false,
            reason: `Il cumulo giornaliero delle transazioni (€${(complianceState.currentDailySpent + numAmount).toLocaleString('it-IT')}) supererebbe il limite autorizzato dal risk management (€${complianceState.maxDailyCumulative.toLocaleString('it-IT')}).`,
            riskScore: 60
        };
    }

    // 5. Anti-Smurfing / Structuring Detection
    if (numAmount >= 9000 && numAmount <= 9999) {
        flags.push('AVVISO STRUCTURING (Smurfing): Importo prossimo alla soglia di segnalazione antiriciclaggio.');
        riskScore += 25;
    }

    if (numAmount >= 100000) {
        flags.push('TRANSAZIONE AD ALTO VALORE: Registrazione avanzata nel report di vigilanza bancaria.');
        riskScore += 15;
    }

    const now = Date.now();
    complianceState.recentTransactionsTimestamps = complianceState.recentTransactionsTimestamps.filter(t => now - t < 60000);
    if (complianceState.recentTransactionsTimestamps.length >= 5) {
        flags.push('HIGH FREQUENCY VELOCITY ALERT: Rilevate più di 5 disposizioni al minuto.');
        riskScore += 20;
    }
    complianceState.recentTransactionsTimestamps.push(now);

    complianceState.currentDailySpent += numAmount;

    return {
        approved: true,
        riskScore: Math.min(riskScore, 45),
        flags: flags,
        dailySpent: complianceState.currentDailySpent,
        remainingDailyLimit: complianceState.maxDailyCumulative - complianceState.currentDailySpent
    };
}

function getComplianceConfig() {
    return {
        ...complianceState,
        sanctionsCount: SANCTIONED_ENTITIES.length + SANCTIONED_IBAN_PREFIXES.length + BLACKLISTED_CRYPTO_ADDRESSES.length,
        amlStatus: 'ACTIVE_REALTIME_MONITORING'
    };
}

function updateComplianceConfig({ maxSingleTx, maxDailyCumulative, kycTier }) {
    if (maxSingleTx !== undefined && !isNaN(Number(maxSingleTx))) {
        complianceState.maxSingleTx = Number(maxSingleTx);
    }
    if (maxDailyCumulative !== undefined && !isNaN(Number(maxDailyCumulative))) {
        complianceState.maxDailyCumulative = Number(maxDailyCumulative);
    }
    if (kycTier) {
        complianceState.kycTier = kycTier;
        kycDossier.currentTier = kycTier;
    }
    return getComplianceConfig();
}

/**
 * Returns complete KYC profile with user verification levels and pending documentation
 */
function getKycProfile() {
    const totalMandatory = kycDossier.documents.filter(d => d.isMandatory).length;
    const completedMandatory = kycDossier.documents.filter(d => d.isMandatory && d.status === 'VERIFIED').length;
    const inReviewCount = kycDossier.documents.filter(d => d.status === 'IN_REVIEW').length;
    const pendingRequiredCount = kycDossier.documents.filter(d => d.isMandatory && d.status === 'REQUIRED').length;

    const rate = Math.round(((completedMandatory + (inReviewCount * 0.5)) / totalMandatory) * 100);
    kycDossier.completionRate = rate;

    return {
        ...kycDossier,
        activeLimits: {
            maxSingleTx: complianceState.maxSingleTx,
            maxDailyCumulative: complianceState.maxDailyCumulative,
            currentDailySpent: complianceState.currentDailySpent
        },
        stats: {
            totalMandatory,
            completedMandatory,
            inReviewCount,
            pendingRequiredCount
        }
    };
}

/**
 * Uploads/submits a KYC regulatory compliance document
 */
function uploadKycDocument({ docId, filename }) {
    const doc = kycDossier.documents.find(d => d.id === docId);
    if (!doc) {
        throw new Error(`Documento con ID ${docId} non trovato nel fascicolo KYC.`);
    }

    doc.filename = filename || `${doc.type.toLowerCase()}_submitted_${Date.now()}.pdf`;
    doc.status = 'IN_REVIEW';
    doc.statusLabel = 'IN REVISIONE';
    doc.issuedDate = new Date().toISOString().substring(0, 10);
    doc.verifiedBy = 'Preso in carico dall\'Ufficio Compliance EMI';

    return getKycProfile();
}

module.exports = {
    screenCompliance,
    getComplianceConfig,
    updateComplianceConfig,
    getKycProfile,
    uploadKycDocument,
    SANCTIONED_ENTITIES,
    BLACKLISTED_CRYPTO_ADDRESSES
};
