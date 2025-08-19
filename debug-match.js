// Debug script for Toyota Corolla 2014 matching issue
const XLSX = require('xlsx');

// Read Excel data
const workbook = XLSX.readFile('./keys.xlsx');
const worksheet = workbook.Sheets[workbook.SheetNames[0]];
const rawData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

// Parse vehicle data 
const vehicleData = rawData.slice(1).map((row) => ({
  yearRange: String(row[0] || '').trim(),
  make: String(row[1] || '').trim(),
  model: String(row[2] || '').trim(),
  key: String(row[5] || '').trim(),
  keyMinPrice: String(row[7] || '').trim(),
}));

// Find Toyota Corolla records
const toyotaCorollas = vehicleData.filter(v => 
  v.make.toLowerCase() === 'toyota' && 
  v.model.toLowerCase() === 'corolla'
);

console.log('Toyota Corolla records found:');
toyotaCorollas.forEach((record, i) => {
  console.log(`${i+1}. ${record.yearRange} | ${record.make} ${record.model} | KeyMin: ${record.keyMinPrice}`);
});

// Test year 2014 matching
function isYearInRange(year, yearRange) {
  if (!yearRange) return false;
  
  // Handle single year
  if (/^\d{4}$/.test(yearRange.trim())) {
    return parseInt(yearRange.trim(), 10) === year;
  }
  
  // Handle year range
  const rangeMatch = yearRange.match(/^(\d{4})\s*[-–]\s*(\d{4})$/);
  if (rangeMatch && rangeMatch[1] && rangeMatch[2]) {
    const startYear = parseInt(rangeMatch[1], 10);
    const endYear = parseInt(rangeMatch[2], 10);
    return year >= startYear && year <= endYear;
  }
  
  return false;
}

console.log('\nTesting year 2014 against each Toyota Corolla record:');
toyotaCorollas.forEach((record, i) => {
  const matches = isYearInRange(2014, record.yearRange);
  console.log(`${i+1}. ${record.yearRange} -> ${matches ? 'MATCHES' : 'no match'}`);
});