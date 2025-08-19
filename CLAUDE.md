# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a TypeScript WhatsApp bot that provides vehicle key pricing information. Users send "Make Model Year" messages and receive structured pricing data for keys, remotes, push-to-start systems, and ignition services.

## Architecture

### Clean Modular Design
- **src/data/**: Data access layer with provider interface and implementations
- **src/logic/**: Business logic for matching and formatting
- **src/bot/**: WhatsApp integration using Baileys
- **src/config/**: Configuration and constants
- **tests/**: Comprehensive unit tests

### Key Components
- `VehicleLookup` interface with `SheetsLookup` and `ExcelLookup` implementations
- Provider factory pattern based on `DATA_PROVIDER` env var
- Year range matching with specificity-based tie-breaking
- Make alias normalization (vw→Volkswagen, chevy→Chevrolet, etc.)

## Development Commands

```bash
# Start development server
npm run dev

# Run tests
npm run test

# Run tests in watch mode
npm run test:watch

# Build TypeScript
npm run build

# Lint code
npm run lint

# Format with Prettier
npm run format
```

## Data Sources

### Dual Provider System
The bot supports two data providers via `DATA_PROVIDER` environment variable:

1. **Google Sheets** (primary): Live data with caching
2. **Excel File** (dev fallback): Local .xlsx file

### Data Format (Columns A-N)
- A: Year Range ("2015" or "2012-2016")
- B: Make
- C: Model  
- F: Key
- H: Key Minimum Price
- J: Remote Minimum Price
- L: P2S Minimum Price
- N: Ignition Change/Fix Minimum Price

## Key Business Logic

### Matching Rules (src/logic/match.ts)
1. Normalize make using aliases map
2. Case-insensitive exact match on make/model
3. Year must fall within specified range
4. Multiple matches: prefer most specific year range (smallest span)

### Output Format (EXACT - English only)
```
Make Model Year

Key: <value>
Key Min: $<value>
Remote Min: $<value>
Push-to-Start Min: $<value>
Ignition Change/Fix Min: $<value>
```

Error messages:
- Not found: "No matching record found for that vehicle."
- Invalid input: "Please send: Make Model Year (e.g., \"Toyota Corolla 2015\")"

### Input Parsing (src/logic/format.ts)
- Format: "Make Model Year" (e.g., "Toyota Corolla 2015")
- Supports multi-word models ("Mercedes-Benz C Class 2020")
- Year validation: 1900-2050 range

## Configuration

### Environment Variables (.env)
```env
DATA_PROVIDER=sheets|excel
SHEETS_ID=<google_sheet_id>
SHEETS_RANGE=Sheet1!A:N
GOOGLE_APPLICATION_CREDENTIALS=./secrets/service-account.json
EXCEL_PATH=./data/pricebook.xlsx
CACHE_TTL_MINUTES=5
```

### Make Aliases (src/config/aliases.ts)
Common abbreviations mapped to full names for better matching.

## WhatsApp Integration

### Baileys Library (src/bot/whatsapp.ts)
- QR code authentication on first run
- Session persistence in `./auth/` directory
- Message filtering (ignore own messages, group messages)
- Auto-reconnection on connection loss
- Silent logging to reduce noise

### Message Flow
1. Parse incoming message text
2. Extract make, model, year
3. Query data provider
4. Format response
5. Send reply

## Testing Strategy

### Unit Tests (Vitest)
- **Match logic**: Year ranges, aliases, case sensitivity, specificity
- **Format functions**: Input parsing, output formatting, error messages
- **Snapshot testing**: Ensures exact output format compliance

### Test Commands
```bash
npm run test        # Run once
npm run test:watch  # Watch mode
```

## File Structure Notes
- TypeScript with strict type checking
- ESLint + Prettier for consistent formatting
- Vitest for fast unit testing
- Clean separation: data, logic, presentation, transport

## Authentication & Secrets
- WhatsApp: Session stored in `./auth/` (gitignored)
- Google Sheets: Service account JSON in `./secrets/` (gitignored)
- Sample Excel file should be provided in `./data/` for testing

## Common Development Tasks

### Adding New Make Aliases
Edit `src/config/aliases.ts` and add to the `MAKE_ALIASES` object.

### Changing Data Format
Update the column mappings in both `SheetsLookup` and `ExcelLookup` classes.

### Modifying Output Format
Update `formatVehicleResult()` in `src/logic/format.ts` and corresponding tests.

### Testing Locally
1. Use `DATA_PROVIDER=excel` with sample data file
2. Run tests with `npm run test`
3. Start bot with `npm run dev` and scan QR code