const fs = require('fs');
const buf = fs.readFileSync('D:/NailFolio/app/api/generate-design/route.ts');
const text = buf.toString('utf8');
const lines = text.split(/\r?\n/);
const line = lines[157];
console.log('Line length:', line.length);
console.log('Last 100 chars:');
console.log(JSON.stringify(line.substring(Math.max(0, line.length - 100))));
