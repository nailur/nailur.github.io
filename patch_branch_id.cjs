const fs = require('fs');

let attJs = fs.readFileSync('pos/js/attendance.js', 'utf8');
// Fix branch_id in attendance.js
attJs = attJs.replace(
    /\.eq\('branch_id', profile\.branch_id\)/g,
    `...((profile.branch_id) ? [{filter: 'eq', args: ['branch_id', profile.branch_id]}] : [])`
);
// A safer way is to just rebuild the query manually instead of regexing chained methods.
attJs = fs.readFileSync('pos/js/attendance.js', 'utf8');
attJs = attJs.replace(
    `const { data: allData, error: allError } = await supabase\n        .from('attendance')\n        .select('*, profiles(name), branches(name), shifts(name)')\n        .eq('branch_id', profile.branch_id)\n        .order('clock_in', { ascending: false })\n        .limit(100);`,
    `let allQuery = supabase.from('attendance').select('*, profiles(name), branches(name), shifts(name)').order('clock_in', { ascending: false }).limit(100);\n    if(profile.branch_id) allQuery = allQuery.eq('branch_id', profile.branch_id);\n    const { data: allData, error: allError } = await allQuery;`
);
fs.writeFileSync('pos/js/attendance.js', attJs);
console.log("attendance.js branch_id bug fixed.");

let opsJs = fs.readFileSync('pos/js/operational_costs.js', 'utf8');
opsJs = opsJs.replace(
    `const { data: cats } = await supabase\n        .from('inventory_categories')\n        .select('*')\n        .eq('branch_id', profile.branch_id);`,
    `let catQuery = supabase.from('inventory_categories').select('*');\n    if(profile.branch_id) catQuery = catQuery.eq('branch_id', profile.branch_id);\n    const { data: cats } = await catQuery;`
);
fs.writeFileSync('pos/js/operational_costs.js', opsJs);
console.log("operational_costs.js branch_id bug fixed.");
