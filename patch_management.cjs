const fs = require('fs');

let managementJs = fs.readFileSync('pos/js/management.js', 'utf8');

// Add imports
if (!managementJs.includes('features.js')) {
    managementJs = managementJs.replace(
        `import { supabase } from './supabase.js';`,
        `import { supabase } from './supabase.js';\nimport { initFeatures, loadShifts, loadSalesDeposits } from './features.js';\nimport { initInventory } from './inventory.js';\nimport { initOperationalCosts } from './operational_costs.js';`
    );
    
    // Add to initManagement
    managementJs = managementJs.replace(
        `if (role === 'superadmin' || role === 'owner' || role === 'kepala_cabang') await loadOutlets();`,
        `if (role === 'superadmin' || role === 'owner' || role === 'kepala_cabang') await loadOutlets();\n    initFeatures();\n    await loadShifts();\n    await loadSalesDeposits();\n    await initInventory();\n    await initOperationalCosts();`
    );
    
    fs.writeFileSync('pos/js/management.js', managementJs);
    console.log("management.js patched to load new features.");
} else {
    console.log("features.js already imported in management.js");
}
