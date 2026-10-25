const express = require('express');
const cors = require('cors');
const path = require('path');
const AppConfig = require('./config/AppConfig');
const platformRoutes = require('./routes/platform');
const complianceRoutes = require('./routes/compliance');

const app = express();
app.use(cors());
app.use(express.json());

// Serve static assets from public directory
app.use(express.static(path.join(__dirname, '../public')));

// Mount API routes
app.use('/api/platform', platformRoutes);
app.use('/api/admin', complianceRoutes);
app.use('/api', platformRoutes); // Backward compatibility

// Single Page Application route fallback
app.get('*', (req, res, next) => {
    if (req.accepts('html')) {
        res.sendFile(path.join(__dirname, '../public/index.html'));
    } else {
        next();
    }
});

const PORT = process.env.PORT || AppConfig.server.port;
const HOST = AppConfig.server.host;

if (require.main === module) {
    app.listen(PORT, HOST, () => {
        console.log(`[EMI GATEWAY] Server operational on http://${HOST}:${PORT}`);
        console.log(`[INSTITUTION] ${AppConfig.institution.name} (${AppConfig.institution.licenseNumber})`);
        console.log(`[CORE LEDGER] Multi-rail Fiat (EUR/USD) and Web3 (${AppConfig.web3.walletAddress}) active.`);
        console.log(`[ZERO .ENV] Operating 100% autonomously out-of-the-box.`);
    });
}

module.exports = app;
