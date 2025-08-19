# WhatsApp Vehicle Pricing Bot

A Node.js TypeScript WhatsApp bot that provides vehicle key pricing information. Users send vehicle details (Make Model Year) and receive pricing for keys, remotes, push-to-start, and ignition services.

## Features

- **Dual Data Sources**: Google Sheets (primary) or local Excel file (development)
- **Smart Matching**: Year ranges, make aliases, case-insensitive search
- **Clean Architecture**: Modular design with clear separation of concerns
- **Type Safety**: Full TypeScript implementation
- **Comprehensive Testing**: Unit tests with Vitest
- **Fixed Output Format**: Consistent English-only responses

## Quick Start

### 1. Installation

```bash
npm install
```

### 2. Environment Setup

Copy the example environment file:

```bash
cp .env.example .env
```

Edit `.env` with your configuration:

```env
# Data provider: 'sheets' or 'excel'
DATA_PROVIDER=sheets

# For Google Sheets (when DATA_PROVIDER=sheets)
SHEETS_ID=your_google_sheet_id
SHEETS_RANGE=Sheet1!A:N
GOOGLE_APPLICATION_CREDENTIALS=./secrets/service-account.json
CACHE_TTL_MINUTES=5

# For Excel file (when DATA_PROVIDER=excel)
EXCEL_PATH=./data/pricebook.xlsx
```

### 3. Data Source Setup

#### Option A: Google Sheets (Recommended)
1. Create a Google Sheet with columns A-N containing your vehicle data
2. Set up a Google Cloud project with Sheets API enabled
3. Create a service account and download the JSON key file
4. Place the key file at `./secrets/service-account.json`
5. Share your sheet with the service account email (viewer access)

#### Option B: Excel File (Development)
1. Place your Excel file at `./data/pricebook.xlsx`
2. Set `DATA_PROVIDER=excel` in your `.env` file

### 4. Data Format

Your spreadsheet should have these columns:

| Column | Content |
|--------|---------|
| A | Year Range (e.g., "2015" or "2012-2016") |
| B | Make (e.g., "Toyota") |
| C | Model (e.g., "Corolla") |
| F | Key (e.g., "TOY43") |
| H | Key Minimum Price (e.g., "120") |
| J | Remote Minimum Price (e.g., "80") |
| L | P2S Minimum Price (e.g., "200") |
| N | Ignition Change/Fix Minimum Price (e.g., "150") |

### 5. Running the Bot

```bash
npm run dev
```

On first run:
1. A QR code will appear in your terminal
2. Scan it with your WhatsApp mobile app
3. Once connected, the bot will respond to vehicle queries

## Usage

Send messages to your bot in the format:
```
Make Model Year
```

Examples:
- `Toyota Corolla 2015`
- `Ford F150 2020`  
- `chevy camaro 2018` (aliases supported)

### Bot Response Format

**Found vehicle:**
```
Toyota Corolla 2015

Key: TOY43
Key Min: $120
Remote Min: $80
Push-to-Start Min: $200
Ignition Change/Fix Min: $150
```

**Not found:**
```
No matching record found for that vehicle.
```

**Invalid format:**
```
Please send: Make Model Year (e.g., "Toyota Corolla 2015")
```

## Development Commands

```bash
# Run in development mode
npm run dev

# Run tests
npm run test

# Run tests in watch mode  
npm run test:watch

# Build for production
npm run build

# Lint code
npm run lint

# Format code
npm run format
```

## Switching Data Providers

You can switch between Google Sheets and Excel without code changes:

1. Update `DATA_PROVIDER` in your `.env` file
2. Restart the bot with `npm run dev`

## Make Aliases

The bot supports common make aliases:
- `vw` → `Volkswagen`
- `chevy` → `Chevrolet`  
- `merc`, `benz` → `Mercedes-Benz`
- And more... (see `src/config/aliases.ts`)

## Architecture

```
/src
  /bot           # WhatsApp integration
  /data          # Data providers (sheets/excel)
  /logic         # Business logic (matching, formatting)
  /config        # Configuration (aliases, constants)
  index.ts       # Application bootstrap
/tests           # Unit tests
/data            # Excel files (if using excel provider)
/auth            # WhatsApp session data (auto-generated)
/secrets         # Google service account keys
```

## Troubleshooting

### WhatsApp Connection Issues
- Ensure your phone has internet connection
- Try deleting the `./auth` folder and re-scanning the QR code
- Check that no other WhatsApp Web sessions are active

### Google Sheets Access
- Verify the service account has access to your sheet
- Check that the `SHEETS_ID` is correct (found in the sheet URL)
- Ensure the `SHEETS_RANGE` covers your data

### Excel File Issues  
- Verify the file path in `EXCEL_PATH` is correct
- Ensure the Excel file has data in the expected columns (A, B, C, F, H, J, L, N)

## License

ISC