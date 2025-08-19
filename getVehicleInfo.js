// getVehicleInfo.js
const xlsx = require('xlsx');
const path = require('path');
const stringSimilarity = require('string-similarity');

const makeAliases = {
  chevy: 'Chevrolet',
  vw: 'Volkswagen',
  merc: 'Mercedes-Benz',
  benz: 'Mercedes-Benz',
  bmw: 'BMW',
  ford: 'Ford',
  toyota: 'Toyota',
  nissan: 'Nissan',
  honda: 'Honda'
};

function clean(text) {
  return String(text || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s\-]/gi, '')
    .trim();
}

function normalizeMake(inputMake) {
  const cleaned = clean(inputMake);
  return makeAliases[cleaned] || capitalizeFirstLetter(cleaned);
}

function capitalizeFirstLetter(string) {
  return string.charAt(0).toUpperCase() + string.slice(1);
}

// פונקציה ראשית שמקבלת Make, Model, Year
function getVehicleInfo(makeInput, modelInput, yearInput) {
  const filePath = path.join(__dirname, 'keys.xlsx');
  const workbook = xlsx.readFile(filePath);
  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];
  const data = xlsx.utils.sheet_to_json(worksheet);

  const make = normalizeMake(makeInput);
  const cleanedModelInput = clean(modelInput);

  const models = data.map(row => String(row.Model));
  const bestModelMatch = stringSimilarity.findBestMatch(cleanedModelInput, models);
  const model = bestModelMatch.bestMatch.target;

  const possibleMatches = data.filter(row =>
    String(row.Make).toLowerCase() === make.toLowerCase() &&
    clean(row.Model) === clean(model)
  );

  if (possibleMatches.length === 0) {
    return `No matching record found for make "${makeInput}" and model "${modelInput}".`;
  }

  const match = possibleMatches.find(row => {
    const yearRange = String(row['Year Range'] || '');
    const [from, to] = yearRange.split('-').map(y => parseInt(y.trim(), 10));
    return yearInput >= from && yearInput <= to;
  });

  if (!match) {
    const availableRanges = possibleMatches
      .map(row => row['Year Range'])
      .filter(Boolean)
      .join(', ');
    return `Found ${make} ${model}, but year ${yearInput} is out of range.\nAvailable year ranges: ${availableRanges}`;
  }

  return `${match.Make} ${match.Model} ${match['Year Range']}

Key: ${match.Key || ''}
Key Min: $${match['Key Minimum Price'] || ''}
Remote Min: $${match['Remote Minimum Price'] || ''}
Push-to-Start Min: $${match['P2S Minimum Price'] || ''}
Ignition Change/Fix Min: $${match['Ignition Change/Fix Minimum Price'] || ''}`;
}

module.exports = getVehicleInfo;