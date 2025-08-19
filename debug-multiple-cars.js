// Test multiple vehicles to see if the year range bug affects all cars
const XLSX = require('xlsx');

// Read Excel data
const workbook = XLSX.readFile('./keys.xlsx');
const worksheet = workbook.Sheets[workbook.SheetNames[0]];
const rawData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

const vehicleData = rawData.slice(1).map((row) => ({
  yearRange: String(row[0] || '').trim(),
  make: String(row[1] || '').trim(),
  model: String(row[2] || '').trim(),
  key: String(row[5] || '').trim(),
  keyMinPrice: String(row[7] || '').trim(),
  remoteMinPrice: String(row[9] || '').trim(),
  p2sMinPrice: String(row[11] || '').trim(),
  ignitionMinPrice: String(row[13] || '').trim(),
}));

function normalizeString(str) {
  return str.toLowerCase().replace(/[^a-z0-9]/g, '');
}

function isYearInRange(year, yearRange) {
  if (!yearRange) return false;
  
  if (/^\d{4}$/.test(yearRange.trim())) {
    return parseInt(yearRange.trim(), 10) === year;
  }
  
  const rangeMatch = yearRange.match(/^(\d{4})\s*[-–]\s*(\d{4})$/);
  if (rangeMatch && rangeMatch[1] && rangeMatch[2]) {
    const startYear = parseInt(rangeMatch[1], 10);
    const endYear = parseInt(rangeMatch[2], 10);
    return year >= startYear && year <= endYear;
  }
  
  return false;
}

function getRangeSpan(yearRange) {
  if (/^\d{4}$/.test(yearRange.trim())) {
    return 1;
  }
  
  const rangeMatch = yearRange.match(/^(\d{4})\s*[-–]\s*(\d{4})$/);
  if (rangeMatch && rangeMatch[1] && rangeMatch[2]) {
    const startYear = parseInt(rangeMatch[1], 10);
    const endYear = parseInt(rangeMatch[2], 10);
    return endYear - startYear + 1;
  }
  
  return Number.MAX_SAFE_INTEGER;
}

function testVehicle(make, model, year) {
  console.log(`\n=== Testing: ${make} ${model} ${year} ===`);
  
  // Find potential matches
  const potentialMatches = vehicleData.filter((row) =>
    normalizeString(row.make) === normalizeString(make) &&
    normalizeString(row.model) === normalizeString(model)
  );
  
  if (potentialMatches.length === 0) {
    console.log('❌ No potential matches found');
    return;
  }
  
  console.log(`Found ${potentialMatches.length} potential matches:`);
  potentialMatches.forEach((match, i) => {
    console.log(`  ${i+1}. ${match.yearRange} (KeyMin: ${match.keyMinPrice})`);
  });
  
  // Find year matches
  const yearMatches = potentialMatches.filter((row) => isYearInRange(year, row.yearRange));
  
  if (yearMatches.length === 0) {
    console.log('❌ No year matches found');
    return;
  }
  
  console.log(`\nYear ${year} matches:`);
  yearMatches.forEach((match, i) => {
    const span = getRangeSpan(match.yearRange);
    console.log(`  ${i+1}. ${match.yearRange} (span: ${span})`);
  });
  
  // Get best match
  const bestMatch = yearMatches.reduce((best, current) => {
    const bestSpan = getRangeSpan(best.yearRange);
    const currentSpan = getRangeSpan(current.yearRange);
    return currentSpan < bestSpan ? current : best;
  });
  
  console.log(`✅ BEST MATCH: ${bestMatch.yearRange} - KeyMin: $${bestMatch.keyMinPrice}`);
  
  // Check if the year actually falls in the selected range
  const actuallyInRange = isYearInRange(year, bestMatch.yearRange);
  if (!actuallyInRange) {
    console.log(`🚨 BUG DETECTED! Year ${year} does NOT fall in selected range ${bestMatch.yearRange}`);
  }
}

// Test various vehicles with years that should have clear matches
console.log('Testing multiple vehicles to detect systematic matching issues...');

testVehicle('Honda', 'Civic', 2015);
testVehicle('Ford', 'F150', 2010);  
testVehicle('Chevrolet', 'Silverado', 2018);
testVehicle('BMW', '3 Series', 2005);
testVehicle('Toyota', 'Camry', 2012);