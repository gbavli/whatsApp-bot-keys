// Full debug of matching process for Toyota Corolla 2014
const XLSX = require('xlsx');

// Read Excel data
const workbook = XLSX.readFile('./keys.xlsx');
const worksheet = workbook.Sheets[workbook.SheetNames[0]];
const rawData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

// Parse vehicle data exactly like the app does
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

// Matching functions from the actual code
function normalizeString(str) {
  return str.toLowerCase().replace(/[^a-z0-9]/g, '');
}

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

function getRangeSpan(yearRange) {
  // Single year has span of 1
  if (/^\d{4}$/.test(yearRange.trim())) {
    return 1;
  }
  
  // Year range span
  const rangeMatch = yearRange.match(/^(\d{4})\s*[-–]\s*(\d{4})$/);
  if (rangeMatch && rangeMatch[1] && rangeMatch[2]) {
    const startYear = parseInt(rangeMatch[1], 10);
    const endYear = parseInt(rangeMatch[2], 10);
    return endYear - startYear + 1;
  }
  
  return Number.MAX_SAFE_INTEGER;
}

// Full matching process
function matchVehicle(make, model, year) {
  console.log(`\n=== MATCHING: ${make} ${model} ${year} ===`);
  
  // Find all potential matches for make and model
  const potentialMatches = vehicleData.filter((row) =>
    normalizeString(row.make) === normalizeString(make) &&
    normalizeString(row.model) === normalizeString(model)
  );
  
  console.log(`Found ${potentialMatches.length} potential matches:`);
  potentialMatches.forEach((match, i) => {
    console.log(`  ${i+1}. ${match.yearRange} ${match.make} ${match.model} (KeyMin: ${match.keyMinPrice})`);
  });
  
  if (potentialMatches.length === 0) {
    console.log('No potential matches found');
    return null;
  }
  
  // Find matches that include the requested year
  const yearMatches = potentialMatches.filter((row) => {
    const matches = isYearInRange(year, row.yearRange);
    console.log(`  Testing ${row.yearRange}: ${matches ? 'MATCHES' : 'no match'}`);
    return matches;
  });
  
  console.log(`\nYear ${year} matches ${yearMatches.length} records:`);
  yearMatches.forEach((match, i) => {
    const span = getRangeSpan(match.yearRange);
    console.log(`  ${i+1}. ${match.yearRange} (span: ${span}) - KeyMin: ${match.keyMinPrice}`);
  });
  
  if (yearMatches.length === 0) {
    console.log('No year matches found');
    return null;
  }
  
  // Pick the most specific (smallest year range)
  const bestMatch = yearMatches.reduce((best, current) => {
    const bestSpan = getRangeSpan(best.yearRange);
    const currentSpan = getRangeSpan(current.yearRange);
    console.log(`  Comparing: ${best.yearRange} (span ${bestSpan}) vs ${current.yearRange} (span ${currentSpan})`);
    return currentSpan < bestSpan ? current : best;
  });
  
  console.log(`\nBEST MATCH: ${bestMatch.yearRange} ${bestMatch.make} ${bestMatch.model}`);
  return bestMatch;
}

// Test the exact case from the logs
const result = matchVehicle('Toyota', 'Corolla', 2014);
console.log('\n=== FINAL RESULT ===');
if (result) {
  console.log(`Year Range: ${result.yearRange}`);
  console.log(`Vehicle: ${result.make} ${result.model}`);
  console.log(`Key Min: ${result.keyMinPrice}`);
} else {
  console.log('No match found');
}