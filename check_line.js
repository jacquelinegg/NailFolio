const fs = require('fs');
const lines = fs.readFileSync('D:/NailFolio/app/api/generate-design/route.ts', 'utf8').split(/\r?\n/);
const line = lines[157];
console.log('Line length:', line.length);
console.log('Last 100 chars:');
console.log(line.substring(Math.max(0, line.length - 100)));
