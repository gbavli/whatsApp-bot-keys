const xlsx = require('xlsx');
const path = require('path');

const EXCEL_FILE_PATH = path.join(__dirname, 'keys.xlsx');

async function getPrice(make, model, year) {
  try {
    const workbook = xlsx.readFile(EXCEL_FILE_PATH);
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const rows = xlsx.utils.sheet_to_json(sheet);

    const yearNum = parseInt(year, 10);
    const lowerMake = make.toLowerCase();
    const lowerModel = model.toLowerCase();

    let closestMatch = null;
    let closestYearDiff = Infinity;

    for (const row of rows) {
      const yearRangeStr = (row['Year Range'] || '').trim();
      const rowMake = (row['Make'] || '').trim().toLowerCase();
      const rowModel = (row['Model'] || '').trim().toLowerCase();

      if (!yearRangeStr || !rowMake || !rowModel) continue;
      if (rowMake !== lowerMake || rowModel !== lowerModel) continue;

      // Parse year range (supports hyphen or en-dash)
      let startYear, endYear;
      const rangeMatch = yearRangeStr.match(/^(\d{4})\s*[-–]\s*(\d{4})$/);
      if (rangeMatch) {
        startYear = parseInt(rangeMatch[1], 10);
        endYear = parseInt(rangeMatch[2], 10);
      } else {
        startYear = endYear = parseInt(yearRangeStr, 10);
      }

      if (isNaN(startYear) || isNaN(endYear)) continue;

      if (yearNum >= startYear && yearNum <= endYear) {
        return formatResponseText(
          formatResponse(row, make, model, year, false)
        );
      }

      const midRange = (startYear + endYear) / 2;
      const diff = Math.abs(midRange - yearNum);
      if (diff < closestYearDiff) {
        closestYearDiff = diff;
        closestMatch = { row, year: `${startYear}-${endYear}` };
      }
    }

    if (closestMatch) {
      const { row, year } = closestMatch;
      return formatResponseText(
        formatResponse(row, make, model, year, true)
      );
    }

    return null;
  } catch (err) {
    console.error('Error in getPrice:', err);
    return null;
  }
}

function formatResponse(row, make, model, year, isClosest = false) {
  return {
    make: capitalize(make),
    model: capitalize(model),
    year,
    key: row.F || row['Key'] || 'N/A',
    keyMin: row.H || row['Key Min'] || 'N/A',
    remoteMin: row.J || row['Remote Min'] || 'N/A',
    pushToStartMin: row.L || row['Push-to-Start Min'] || 'N/A',
    ignitionMin: row.N || row['Ignition Change/Fix Min'] || 'N/A',
    note: isClosest ? '(closest match found)' : ''
  };
}

function capitalize(str) {
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
}

function formatResponseText(result) {
  return `🔑 ${result.make} ${result.model} ${result.year}
• Key: ${result.key}
• Key Min: ${result.keyMin}
• Remote Min: ${result.remoteMin}
• P2S Min: ${result.pushToStartMin}
• Ignition Change/Fix: ${result.ignitionMin}
${result.note ? '📝 ' + result.note : ''}`;
}

module.exports = { getPrice };