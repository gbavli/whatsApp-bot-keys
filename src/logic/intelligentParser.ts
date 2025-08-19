import { VehicleData } from '../data/vehicleLookup';
import { MAKE_ALIASES } from '../config/aliases';

// Helper function to check if year falls within a range
function isYearInRange(year: number, yearRange: string): boolean {
  if (!yearRange) return false;
  
  // Handle single year
  if (!/[-–]/.test(yearRange)) {
    return parseInt(yearRange, 10) === year;
  }
  
  // Handle range like "2015-2018"
  const parts = yearRange.split(/[-–]/).map(y => parseInt(y.trim(), 10));
  const start = parts[0];
  const end = parts[1];
  
  if (start === undefined || end === undefined) return false;
  return year >= start && year <= end;
}

export interface SmartParseResult {
  make: string;
  model: string;
  year: number;
  confidence: number; // 0-1 score
}

// Common stop words to ignore
const STOP_WORDS = [
  'car', 'vehicle', 'auto', 'automobile', 'the', 'a', 'an', 'for', 'my', 'i', 'need', 'want',
  'key', 'keys', 'remote', 'fob', 'price', 'quote', 'cost', 'how', 'much', 'is', 'it', 'please',
  'can', 'you', 'help', 'me', 'with', 'get', 'find', 'lookup', 'search'
];

// String similarity function (simple Levenshtein distance)
function levenshteinDistance(str1: string, str2: string): number {
  const matrix: number[][] = [];
  for (let i = 0; i <= str2.length; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= str1.length; j++) {
    matrix[0]![j] = j;
  }
  for (let i = 1; i <= str2.length; i++) {
    for (let j = 1; j <= str1.length; j++) {
      if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
        matrix[i]![j] = matrix[i - 1]![j - 1]!;
      } else {
        matrix[i]![j] = Math.min(
          matrix[i - 1]![j - 1]! + 1,
          matrix[i]![j - 1]! + 1,
          matrix[i - 1]![j]! + 1
        );
      }
    }
  }
  return matrix[str2.length]![str1.length]!;
}

function similarityScore(str1: string, str2: string): number {
  const distance = levenshteinDistance(str1.toLowerCase(), str2.toLowerCase());
  const maxLength = Math.max(str1.length, str2.length);
  return 1 - distance / maxLength;
}

// Check if a word could be ambiguous (common word that's also a vehicle make/model)
function isAmbiguousWord(word: string, context: string[]): boolean {
  const ambiguousWords: { [key: string]: string[] } = {
    'focus': ['focus', 'concentrate', 'attention'],
    'ram': ['ram', 'memory', 'push', 'hit'],
    'pilot': ['pilot', 'driver', 'captain', 'test'],
    'ranger': ['ranger', 'park', 'forest', 'guard'],
    'escape': ['escape', 'get', 'away', 'from'],
    'fusion': ['fusion', 'nuclear', 'combine'],
    'accord': ['accord', 'agreement', 'harmony'],
    'fit': ['fit', 'size', 'healthy', 'exercise']
  };
  
  const wordLower = word.toLowerCase();
  if (!ambiguousWords[wordLower]) return false;
  
  // Check if context suggests non-vehicle meaning
  const nonVehicleIndicators = ambiguousWords[wordLower]!;
  return context.some(w => nonVehicleIndicators.includes(w.toLowerCase()));
}

// Find best matching make from available data with context awareness
function findBestMake(input: string, availableMakes: string[], context: string[] = []): { make: string; score: number } {
  const normalizedInput = input.toLowerCase().trim();
  
  // Skip if word is ambiguous in this context
  if (isAmbiguousWord(input, context)) {
    return { make: '', score: 0 };
  }
  
  // Check aliases first
  if (MAKE_ALIASES[normalizedInput]) {
    const aliasedMake = MAKE_ALIASES[normalizedInput];
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

// Enhanced similarity with better typo tolerance
function enhancedSimilarityScore(str1: string, str2: string): number {
  const s1 = str1.toLowerCase().trim();
  const s2 = str2.toLowerCase().trim();
  
  // Exact match
  if (s1 === s2) return 1.0;
  
  // Handle common typos and variations
  const typoMap: { [key: string]: string[] } = {
    'toyota': ['toyoto', 'toyata', 'toyta'],
    'chevrolet': ['chevrlet', 'chevroelt', 'chevy'],
    'volkswagen': ['volkswagon', 'volkwagen', 'vw'],
    'mercedes': ['mercedez', 'mercedes-benz', 'benz'],
    'corolla': ['corollla', 'corola', 'carolla'],
    'camry': ['camery', 'camri'],
    'accord': ['acord', 'accrd']
  };
  
  // Check if one is a typo variant of the other
  for (const [correct, typos] of Object.entries(typoMap)) {
    if ((s1 === correct && typos.includes(s2)) || (s2 === correct && typos.includes(s1))) {
      return 0.95; // Very high score for known typos
    }
  }
  
  // Use standard Levenshtein for other cases
  return similarityScore(s1, s2);
}

// Remove trim levels and special editions from model names
function cleanModelName(model: string): string {
  const trimLevels = [
    // Common trim levels
    'base', 'lx', 'ex', 'dx', 'si', 'type-r', 'type r',
    'le', 'se', 'xle', 'limited', 'platinum', 'premium',
    'sport', 'touring', 'hybrid', 'awd', '4wd', 'fwd',
    'coupe', 'sedan', 'wagon', 'hatchback', 'convertible',
    // Ford specific
    'xl', 'xlt', 'lariat', 'king ranch', 'platinum', 'raptor',
    // Mercedes specific
    'c300', 'c350', 'c63', 'amg', 'matic',
    // BMW specific
    'i', 'xi', 'xdrive', 'm-sport', 'm sport',
    // Special editions
    'anniversary', 'edition', 'special', 'gt', 'gts', 'rs', 'ss'
  ];
  
  let cleaned = model.toLowerCase().trim();
  
  // Remove trim levels
  for (const trim of trimLevels) {
    const regex = new RegExp(`\\b${trim}\\b`, 'gi');
    cleaned = cleaned.replace(regex, '').trim();
  }
  
  // Clean up extra spaces
  cleaned = cleaned.replace(/\s+/g, ' ').trim();
  
  return cleaned || model; // Return original if cleaning resulted in empty string
}

// Find best matching model from available data for a specific make
function findBestModel(input: string, availableModels: string[], context: string[] = []): { model: string; score: number } {
  const cleanedInput = cleanModelName(input);
  
  // Skip if model name is ambiguous in context
  if (isAmbiguousWord(input, context)) {
    return { model: '', score: 0 };
  }
  
  let bestMatch = { model: '', score: 0 };
  
  for (const model of availableModels) {
    const cleanedModel = cleanModelName(model);
    
    // Try both original and cleaned versions
    const scoreOriginal = enhancedSimilarityScore(input, model);
    const scoreCleaned = enhancedSimilarityScore(cleanedInput, cleanedModel);
    const score = Math.max(scoreOriginal, scoreCleaned);
    
    if (score > bestMatch.score && score > 0.6) { // Lowered threshold due to better matching
      bestMatch = { model, score };
    }
  }
  
  return bestMatch;
}

// Separate multiple vehicles from text
function separateMultipleVehicles(input: string): string[] {
  // Split on common separators that indicate multiple vehicles
  const separators = [',', ';', '\n', ' and ', ' & ', ' or ', ' also '];
  let segments = [input];
  
  for (const sep of separators) {
    const newSegments: string[] = [];
    for (const segment of segments) {
      newSegments.push(...segment.split(sep));
    }
    segments = newSegments;
  }
  
  return segments
    .map(s => s.trim())
    .filter(s => s.length > 5) // Minimum reasonable length for vehicle info
    .filter(s => /\d{4}|\d{2}/.test(s)); // Must contain what looks like a year
}

// Extract potential vehicle information from complex text (like locksmith tickets)
function extractVehicleFromText(input: string): string[] {
  // First separate multiple vehicles
  const segments = separateMultipleVehicles(input);
  const vehicleStrings: string[] = [];
  
  for (const segment of segments) {
    // Look for year make model patterns in each segment
    const patterns = [
      // Pattern: "2008 Ford F250 - Regular turn key"
      /(\d{4})\s+([a-zA-Z]+)\s+([a-zA-Z0-9\-\s]+?)(?:\s*[-–]\s*|\s*\n|\s*$)/g,
      // Pattern: "Ford F250 2008"  
      /([a-zA-Z]+)\s+([a-zA-Z0-9\-\s]+?)\s+(\d{4})/g,
      // Pattern: "2008 Ford F-250" (with dash)
      /(\d{4})\s+([a-zA-Z]+)\s+([a-zA-Z0-9\-]+)/g,
      // Pattern: Model Year Make (reverse)
      /([a-zA-Z0-9\-\s]+?)\s+(\d{4})\s+([a-zA-Z]+)/g,
      // Pattern: lines containing year and text
      /^.*(\d{4}).*([a-zA-Z]+).*([a-zA-Z0-9\-]+).*$/gm
    ];
    
    for (const pattern of patterns) {
      let match;
      while ((match = pattern.exec(segment)) !== null) {
        if (match[1] && match[2] && match[3]) {
          // Check if first capture group is a year
          const year = parseInt(match[1], 10);
          if (year >= 1980 && year <= 2030) {
            // Skip if this looks like a phone number or address
            const fullMatch = match[0];
            if (!isPhoneNumberPattern(match[1], fullMatch.split(' ')) && 
                !isAddressContext(match[1], fullMatch.split(' '), 0)) {
              vehicleStrings.push(`${match[1]} ${match[2]} ${match[3]}`.trim());
            }
          } else {
            // Try other combinations
            const possibleYear1 = parseInt(match[2], 10);
            const possibleYear2 = parseInt(match[3], 10);
            if (possibleYear1 >= 1980 && possibleYear1 <= 2030) {
              vehicleStrings.push(`${match[2]} ${match[1]} ${match[3]}`.trim());
            } else if (possibleYear2 >= 1980 && possibleYear2 <= 2030) {
              vehicleStrings.push(`${match[3]} ${match[1]} ${match[2]}`.trim());
            }
          }
        }
      }
    }
    
    // If no patterns match this segment, add it as-is if it looks like vehicle info
    if (vehicleStrings.length === 0 && /\d{4}/.test(segment)) {
      vehicleStrings.push(segment);
    }
  }
  
  // If no patterns match, return the original input cleaned
  if (vehicleStrings.length === 0) {
    vehicleStrings.push(input);
  }
  
  return vehicleStrings;
}

// Clean and normalize input text
function cleanInput(input: string): string[] {
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

// Check if a number could be a phone number pattern
function isPhoneNumberPattern(word: string, context: string[]): boolean {
  // Phone patterns: 555-1234, (555)123-4567, 555.123.4567, etc.
  const phonePatterns = [
    /\d{3}[-.]?\d{4}$/, // 555-1234 or 5551234
    /\(?\d{3}\)?[-.]?\d{3}[-.]?\d{4}/, // (555)123-4567
    /1?[-.]?\d{3}[-.]?\d{3}[-.]?\d{4}/ // 1-555-123-4567
  ];
  
  // Check if word matches phone pattern
  const wordAsNumber = parseInt(word, 10);
  if (wordAsNumber >= 1000 && wordAsNumber <= 9999) {
    // Look for phone indicators in context
    const phoneIndicators = ['call', 'phone', 'number', 'contact', 'reach', 'text', 'message'];
    return context.some(w => phoneIndicators.includes(w.toLowerCase()));
  }
  
  return false;
}

// Check if a year appears in an address context
function isAddressContext(word: string, context: string[], index: number): boolean {
  const addressIndicators = ['road', 'street', 'ave', 'avenue', 'blvd', 'boulevard', 'dr', 'drive', 'lane', 'way', 'ct', 'court'];
  const nearbyWords = [
    ...context.slice(Math.max(0, index - 2), index),
    ...context.slice(index + 1, Math.min(context.length, index + 3))
  ];
  
  return nearbyWords.some(w => addressIndicators.includes(w.toLowerCase()));
}

// Extract year from words with enhanced validation
function extractYear(words: string[]): { year: number; remainingWords: string[] } | null {
  const currentYear = new Date().getFullYear();
  const maxVehicleYear = currentYear + 1; // Allow next model year
  
  for (let i = 0; i < words.length; i++) {
    const word = words[i];
    if (!word) continue;
    
    // Handle 4-digit years - be more restrictive
    let year = parseInt(word, 10);
    if (year >= 1980 && year <= maxVehicleYear) {
      // Skip if this looks like a phone number
      if (isPhoneNumberPattern(word, words)) {
        continue;
      }
      
      // Skip if this appears in an address context
      if (isAddressContext(word, words, i)) {
        continue;
      }
      
      // Skip years that look like dates (2024, 2025 unless it's actually a valid vehicle year)
      if (year >= currentYear - 1 && year <= maxVehicleYear) {
        // For current/future years, be extra cautious
        // Look for vehicle context indicators
        const vehicleContextWords = ['car', 'truck', 'suv', 'sedan', 'coupe', 'wagon', 'van', 'vehicle', 'auto'];
        const hasVehicleContext = words.some(w => vehicleContextWords.includes(w.toLowerCase()));
        
        if (hasVehicleContext) {
          const remainingWords = [...words.slice(0, i), ...words.slice(i + 1)];
          return { year, remainingWords };
        }
        continue; // Skip without vehicle context
      } else {
        // Past years are more likely to be vehicles
        const remainingWords = [...words.slice(0, i), ...words.slice(i + 1)];
        return { year, remainingWords };
      }
    }
    
    // Handle 2-digit years (convert to 4-digit)
    if (year >= 80 && year <= 99) {
      year += 1900; // 80-99 → 1980-1999
      const remainingWords = [...words.slice(0, i), ...words.slice(i + 1)];
      return { year, remainingWords };
    }
    if (year >= 0 && year <= 30) {
      year += 2000; // 00-30 → 2000-2030
      // But be cautious about years like 24, 25 which could be dates
      if (year <= maxVehicleYear) {
        const remainingWords = [...words.slice(0, i), ...words.slice(i + 1)];
        return { year, remainingWords };
      }
    }
  }
  return null;
}

// Process a single vehicle string
function processVehicleString(vehicleString: string, vehicleData: VehicleData[]): SmartParseResult[] {
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
  const results: SmartParseResult[] = [];
  
  // Try different combinations of remaining words as make/model
  if (remainingWords.length === 1) {
    // Only one word - could be model only, find matching make/model combinations
    const word = remainingWords[0];
    if (!word) return [];
    
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
  } else if (remainingWords.length >= 2) {
    // Multiple words - try different make/model combinations
    
    // Try each word as make, rest as model
    for (let i = 0; i < remainingWords.length; i++) {
      const potentialMake = remainingWords[i];
      if (!potentialMake) continue;
      const potentialModel = remainingWords.filter((_, idx) => idx !== i).join(' ');
      
      const makeMatch = findBestMake(potentialMake, availableMakes, remainingWords);
      if (makeMatch.score > 0.6) {
        // Get models for this make
        const modelsForMake = vehicleData
          .filter(v => v.make.toLowerCase() === makeMatch.make.toLowerCase())
          .map(v => v.model);
        
        const modelMatch = findBestModel(potentialModel, modelsForMake, remainingWords);
        if (modelMatch.score > 0.6) { // Lowered threshold due to better matching
          // Validate that this make/model combination exists in our data
          const dataMatch = vehicleData.find(v => 
            v.make.toLowerCase() === makeMatch.make.toLowerCase() &&
            v.model.toLowerCase() === modelMatch.model.toLowerCase()
          );
          
          if (dataMatch) {
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
    
    // Try multi-word makes (like "Land Rover", "Mercedes Benz")
    for (let makeWords = 2; makeWords <= Math.min(3, remainingWords.length - 1); makeWords++) {
      for (let i = 0; i <= remainingWords.length - makeWords - 1; i++) {
        const potentialMake = remainingWords.slice(i, i + makeWords).join(' ');
        const potentialModel = [
          ...remainingWords.slice(0, i),
          ...remainingWords.slice(i + makeWords)
        ].join(' ');
        
        if (!potentialModel.trim()) continue;
        
        const makeMatch = findBestMake(potentialMake, availableMakes, remainingWords);
        if (makeMatch.score > 0.6) {
          const modelsForMake = vehicleData
            .filter(v => v.make.toLowerCase() === makeMatch.make.toLowerCase())
            .map(v => v.model);
          
          const modelMatch = findBestModel(potentialModel, modelsForMake, remainingWords);
          if (modelMatch.score > 0.6) {
            const dataMatch = vehicleData.find(v => 
              v.make.toLowerCase() === makeMatch.make.toLowerCase() &&
              v.model.toLowerCase() === modelMatch.model.toLowerCase()
            );
            
            if (dataMatch) {
              results.push({
                make: makeMatch.make,
                model: modelMatch.model,
                year,
                confidence: (makeMatch.score + modelMatch.score) / 2 * 1.05, // Slight boost for multi-word makes
              });
            }
          }
        }
      }
    }
    
    // Also try first N words as make, rest as model
    for (let makeWords = 1; makeWords <= Math.min(3, remainingWords.length - 1); makeWords++) {
      const makeCandidate = remainingWords.slice(0, makeWords).join(' ');
      const modelCandidate = remainingWords.slice(makeWords).join(' ');
      
      if (!makeCandidate || !modelCandidate) continue;
      
      const makeMatch = findBestMake(makeCandidate, availableMakes, remainingWords);
      if (makeMatch.score > 0.6) {
        const modelsForMake = vehicleData
          .filter(v => v.make.toLowerCase() === makeMatch.make.toLowerCase())
          .map(v => v.model);
        
        const modelMatch = findBestModel(modelCandidate, modelsForMake, remainingWords);
        if (modelMatch.score > 0.6) {
          const dataMatch = vehicleData.find(v => 
            v.make.toLowerCase() === makeMatch.make.toLowerCase() &&
            v.model.toLowerCase() === modelMatch.model.toLowerCase()
          );
          
          if (dataMatch) {
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
  }
  
  return results;
}

// Main intelligent parsing function
export function smartParseVehicle(input: string, vehicleData: VehicleData[]): SmartParseResult[] {
  console.log(`🔍 Smart parsing input: "${input}"`);
  
  // First, extract potential vehicle strings from the complex text
  const vehicleStrings = extractVehicleFromText(input);
  console.log(`📝 Extracted vehicle strings:`, vehicleStrings);
  
  const allResults: SmartParseResult[] = [];
  
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
      return !arr.slice(0, index).some(prev => 
        prev.make === result.make && 
        prev.model === result.model && 
        prev.year === result.year
      );
    });
  
  console.log(`🎯 Smart parser final results:`, uniqueResults.slice(0, 3));
  return uniqueResults.slice(0, 3); // Return top 3 matches
}