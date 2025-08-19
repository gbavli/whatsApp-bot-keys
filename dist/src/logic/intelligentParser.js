"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.smartParseVehicle = smartParseVehicle;
const aliases_1 = require("../config/aliases");
// Common stop words to ignore
const STOP_WORDS = [
    'car', 'vehicle', 'auto', 'automobile', 'the', 'a', 'an', 'for', 'my', 'i', 'need', 'want',
    'key', 'keys', 'remote', 'fob', 'price', 'quote', 'cost', 'how', 'much', 'is', 'it', 'please',
    'can', 'you', 'help', 'me', 'with', 'get', 'find', 'lookup', 'search'
];
// String similarity function (simple Levenshtein distance)
function levenshteinDistance(str1, str2) {
    const matrix = [];
    for (let i = 0; i <= str2.length; i++) {
        matrix[i] = [i];
    }
    for (let j = 0; j <= str1.length; j++) {
        matrix[0][j] = j;
    }
    for (let i = 1; i <= str2.length; i++) {
        for (let j = 1; j <= str1.length; j++) {
            if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
                matrix[i][j] = matrix[i - 1][j - 1];
            }
            else {
                matrix[i][j] = Math.min(matrix[i - 1][j - 1] + 1, matrix[i][j - 1] + 1, matrix[i - 1][j] + 1);
            }
        }
    }
    return matrix[str2.length][str1.length];
}
function similarityScore(str1, str2) {
    const distance = levenshteinDistance(str1.toLowerCase(), str2.toLowerCase());
    const maxLength = Math.max(str1.length, str2.length);
    return 1 - distance / maxLength;
}
// Find best matching make from available data
function findBestMake(input, availableMakes) {
    const normalizedInput = input.toLowerCase().trim();
    // Check aliases first
    if (aliases_1.MAKE_ALIASES[normalizedInput]) {
        const aliasedMake = aliases_1.MAKE_ALIASES[normalizedInput];
        // Verify the aliased make exists in our data
        const exactMatch = availableMakes.find(m => m.toLowerCase() === aliasedMake.toLowerCase());
        if (exactMatch) {
            return { make: exactMatch, score: 1.0 };
        }
    }
    // Find best fuzzy match
    let bestMatch = { make: '', score: 0 };
    for (const make of availableMakes) {
        const score = similarityScore(normalizedInput, make);
        if (score > bestMatch.score && score > 0.6) { // Minimum 60% similarity
            bestMatch = { make, score };
        }
    }
    return bestMatch;
}
// Find best matching model from available data for a specific make
function findBestModel(input, availableModels) {
    const normalizedInput = input.toLowerCase().trim();
    let bestMatch = { model: '', score: 0 };
    for (const model of availableModels) {
        const score = similarityScore(normalizedInput, model);
        if (score > bestMatch.score && score > 0.7) { // Minimum 70% similarity for models
            bestMatch = { model, score };
        }
    }
    return bestMatch;
}
// Extract potential vehicle information from complex text (like locksmith tickets)
function extractVehicleFromText(input) {
    // Look for year make model patterns in the text
    const patterns = [
        // Pattern: "2008 Ford F250 - Regular turn key"
        /(\d{4})\s+([a-zA-Z]+)\s+([a-zA-Z0-9\-\s]+?)(?:\s*[-–]\s*|\s*\n|\s*$)/g,
        // Pattern: "Ford F250 2008"  
        /([a-zA-Z]+)\s+([a-zA-Z0-9\-\s]+?)\s+(\d{4})/g,
        // Pattern: "2008 Ford F-250" (with dash)
        /(\d{4})\s+([a-zA-Z]+)\s+([a-zA-Z0-9\-]+)/g,
        // Pattern: lines containing year and text
        /^.*(\d{4}).*([a-zA-Z]+).*([a-zA-Z0-9\-]+).*$/gm
    ];
    const vehicleStrings = [];
    for (const pattern of patterns) {
        let match;
        while ((match = pattern.exec(input)) !== null) {
            if (match[1] && match[2] && match[3]) {
                // Check if first capture group is a year
                const year = parseInt(match[1], 10);
                if (year >= 1980 && year <= 2030) {
                    vehicleStrings.push(`${match[1]} ${match[2]} ${match[3]}`.trim());
                }
                else {
                    // Try other combinations
                    const possibleYear1 = parseInt(match[2], 10);
                    const possibleYear2 = parseInt(match[3], 10);
                    if (possibleYear1 >= 1980 && possibleYear1 <= 2030) {
                        vehicleStrings.push(`${match[2]} ${match[1]} ${match[3]}`.trim());
                    }
                    else if (possibleYear2 >= 1980 && possibleYear2 <= 2030) {
                        vehicleStrings.push(`${match[3]} ${match[1]} ${match[2]}`.trim());
                    }
                }
            }
        }
    }
    // If no patterns match, return the original input cleaned
    if (vehicleStrings.length === 0) {
        vehicleStrings.push(input);
    }
    return vehicleStrings;
}
// Clean and normalize input text
function cleanInput(input) {
    return input
        .toLowerCase()
        // Handle common number words
        .replace(/\btwo\b/g, '2')
        .replace(/\bthree\b/g, '3')
        .replace(/\bfour\b/g, '4')
        .replace(/\bfive\b/g, '5')
        .replace(/\bsix\b/g, '6')
        .replace(/\bseven\b/g, '7')
        .replace(/\beight\b/g, '8')
        .replace(/\bnine\b/g, '9')
        // Handle common model variations 
        .replace(/\bf[-\s]?150\b/g, 'f150')
        .replace(/\bf[-\s]?250\b/g, 'f250')
        .replace(/\bf[-\s]?350\b/g, 'f350')
        .replace(/\bf[-\s]?450\b/g, 'f450')
        .replace(/\bf[-\s]?550\b/g, 'f550')
        .replace(/\bc[-\s]?class\b/g, 'c-class')
        .replace(/\be[-\s]?class\b/g, 'e-class')
        .replace(/\bs[-\s]?class\b/g, 's-class')
        .replace(/\bm[-\s]?class\b/g, 'm-class')
        .replace(/\bg[-\s]?class\b/g, 'g-class')
        // Handle Ram/Dodge
        .replace(/\bram\s+(\d{4})\b/g, 'ram-$1')
        .replace(/\bdodge\s+ram\b/g, 'ram')
        // Remove extra punctuation and normalize
        .replace(/['"`,;:!?(){}[\]]/g, ' ') // Remove quotes, punctuation
        .replace(/[-_+=|\\\/]/g, ' ') // Replace separators with spaces
        .replace(/[^\w\s]/g, ' ') // Replace any remaining non-alphanumeric with spaces
        .replace(/\s+/g, ' ') // Multiple spaces to single space
        .trim()
        .split(' ')
        .filter(word => word.length > 0 && !STOP_WORDS.includes(word));
}
// Extract year from words
function extractYear(words) {
    for (let i = 0; i < words.length; i++) {
        const word = words[i];
        if (!word)
            continue;
        // Handle 4-digit years
        let year = parseInt(word, 10);
        if (year >= 1980 && year <= 2030) {
            const remainingWords = [...words.slice(0, i), ...words.slice(i + 1)];
            return { year, remainingWords };
        }
        // Handle 2-digit years (convert to 4-digit)
        if (year >= 80 && year <= 99) {
            year += 1900; // 80-99 → 1980-1999
            const remainingWords = [...words.slice(0, i), ...words.slice(i + 1)];
            return { year, remainingWords };
        }
        if (year >= 0 && year <= 30) {
            year += 2000; // 00-30 → 2000-2030
            const remainingWords = [...words.slice(0, i), ...words.slice(i + 1)];
            return { year, remainingWords };
        }
    }
    return null;
}
// Process a single vehicle string
function processVehicleString(vehicleString, vehicleData) {
    const words = cleanInput(vehicleString);
    if (words.length < 2) {
        return [];
    }
    // Extract year
    const yearResult = extractYear(words);
    if (!yearResult) {
        return [];
    }
    const { year, remainingWords } = yearResult;
    if (remainingWords.length === 0) {
        return [];
    }
    // Get unique makes and models from data
    const availableMakes = [...new Set(vehicleData.map(v => v.make))];
    const results = [];
    // Try different combinations of remaining words as make/model
    if (remainingWords.length === 1) {
        // Only one word - could be model only, find matching make/model combinations
        const word = remainingWords[0];
        if (!word)
            return [];
        for (const vehicle of vehicleData) {
            const modelScore = similarityScore(word, vehicle.model);
            if (modelScore > 0.7) {
                results.push({
                    make: vehicle.make,
                    model: vehicle.model,
                    year,
                    confidence: modelScore * 0.8, // Lower confidence for model-only
                });
            }
        }
    }
    else if (remainingWords.length >= 2) {
        // Multiple words - try different make/model combinations
        // Try each word as make, rest as model
        for (let i = 0; i < remainingWords.length; i++) {
            const potentialMake = remainingWords[i];
            if (!potentialMake)
                continue;
            const potentialModel = remainingWords.filter((_, idx) => idx !== i).join(' ');
            const makeMatch = findBestMake(potentialMake, availableMakes);
            if (makeMatch.score > 0.6) {
                // Get models for this make
                const modelsForMake = vehicleData
                    .filter(v => v.make.toLowerCase() === makeMatch.make.toLowerCase())
                    .map(v => v.model);
                const modelMatch = findBestModel(potentialModel, modelsForMake);
                if (modelMatch.score > 0.7) {
                    results.push({
                        make: makeMatch.make,
                        model: modelMatch.model,
                        year,
                        confidence: (makeMatch.score + modelMatch.score) / 2,
                    });
                }
            }
        }
        // Also try first word as make, rest as model
        if (remainingWords.length >= 2) {
            const firstAsMake = remainingWords[0];
            if (!firstAsMake)
                return results;
            const restAsModel = remainingWords.slice(1).join(' ');
            const makeMatch = findBestMake(firstAsMake, availableMakes);
            if (makeMatch.score > 0.6) {
                const modelsForMake = vehicleData
                    .filter(v => v.make.toLowerCase() === makeMatch.make.toLowerCase())
                    .map(v => v.model);
                const modelMatch = findBestModel(restAsModel, modelsForMake);
                if (modelMatch.score > 0.7) {
                    results.push({
                        make: makeMatch.make,
                        model: modelMatch.model,
                        year,
                        confidence: (makeMatch.score + modelMatch.score) / 2,
                    });
                }
            }
        }
    }
    return results;
}
// Main intelligent parsing function
function smartParseVehicle(input, vehicleData) {
    console.log(`🔍 Smart parsing input: "${input}"`);
    // First, extract potential vehicle strings from the complex text
    const vehicleStrings = extractVehicleFromText(input);
    console.log(`📝 Extracted vehicle strings:`, vehicleStrings);
    const allResults = [];
    // Process each potential vehicle string
    for (const vehicleString of vehicleStrings) {
        const results = processVehicleString(vehicleString, vehicleData);
        allResults.push(...results);
    }
    // Sort by confidence and remove duplicates
    const uniqueResults = allResults
        .sort((a, b) => b.confidence - a.confidence)
        .filter((result, index, arr) => {
        // Remove duplicates
        return !arr.slice(0, index).some(prev => prev.make === result.make &&
            prev.model === result.model &&
            prev.year === result.year);
    });
    console.log(`🎯 Smart parser final results:`, uniqueResults.slice(0, 3));
    return uniqueResults.slice(0, 3); // Return top 3 matches
}
