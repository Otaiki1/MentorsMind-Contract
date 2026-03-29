# Multi-Currency Support Design Document

## 1. High-Level Architecture

### System Overview

```
┌─────────────────────────────────────────────────────────────┐
│                     PaymentModal Component                   │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ AssetSelector (XLM, USDC, PYUSD)                     │   │
│  │ ↓                                                     │   │
│  │ Asset Selection State → Transaction Builder          │   │
│  │ ↓                                                     │   │
│  │ Exchange Rate Service → Live Rate Display            │   │
│  │ ↓                                                     │   │
│  │ Trustline Validator → Trustline Status Check         │   │
│  │ ↓                                                     │   │
│  │ Fee Calculator → Asset-Specific Fees                 │   │
│  │ ↓                                                     │   │
│  │ Payment Breakdown Display                            │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
         ↓                    ↓                    ↓
    ┌─────────────┐   ┌──────────────┐   ┌──────────────┐
    │ Asset       │   │ Exchange     │   │ Trustline    │
    │ Service     │   │ Rate Service │   │ Service      │
    └─────────────┘   └──────────────┘   └──────────────┘
         ↓                    ↓                    ↓
    ┌─────────────────────────────────────────────────────┐
    │         Stellar Horizon API                         │
    │  - Account balances & trustlines                    │
    │  - Exchange rates (DEX)                             │
    │  - Path payments                                    │
    └─────────────────────────────────────────────────────┘
```

### Data Flow

1. **Asset Selection**: User selects asset → PaymentModal updates state
2. **Exchange Rate Fetch**: Selected asset → ExchangeRateService queries Horizon → Cache result
3. **Trustline Check**: Selected asset → TrustlineValidator queries account balances → Cache result
4. **Fee Calculation**: Asset + amount → FeeCalculator computes fees using exchange rate
5. **Payment Build**: Asset + recipient + amount → TransactionBuilder creates Payment or PathPaymentStrictReceive
6. **Transaction Submit**: Signed transaction → Stellar network

## 2. Component Design

### PaymentModal Component (Modified)

**Current State**: Displays transaction simulation results

**New Responsibilities**:
- Manage selected asset state
- Fetch and display exchange rates
- Validate trustlines
- Calculate asset-specific fees
- Display payment breakdown in selected asset

**Props**:
```typescript
type PaymentModalProps = {
  isOpen: boolean;
  operationXdr: string;
  account: string;
  rpcEndpoint: string;
  onCancel: () => void;
  onConfirm: () => void;
};
```

**State**:
```typescript
const [selectedAsset, setSelectedAsset] = useState<AssetCode>('XLM');
const [exchangeRate, setExchangeRate] = useState<number | null>(null);
const [trustlineStatus, setTrustlineStatus] = useState<Trustline | null>(null);
const [fees, setFees] = useState<AssetFees | null>(null);
const [loading, setLoading] = useState(false);
const [error, setError] = useState<string | null>(null);
```

**Effects**:
1. When `selectedAsset` changes → Fetch exchange rate, validate trustline, recalculate fees
2. When `operationXdr` changes → Simulate transaction, extract amount, recalculate fees

### AssetSelector Component (New)

**Purpose**: Allow user to select between XLM, USDC, PYUSD

**Props**:
```typescript
type AssetSelectorProps = {
  selectedAsset: AssetCode;
  onAssetChange: (asset: AssetCode) => void;
  availableAssets?: AssetCode[];
};
```

**Behavior**:
- Display three buttons for XLM, USDC, PYUSD
- Highlight selected asset
- Disable assets without trustlines (optional)
- Show asset icons and names

## 3. Service Design

### AssetService

**Purpose**: Centralized asset metadata and operations

**Methods**:
```typescript
class AssetService {
  // Get metadata for an asset
  getAssetMetadata(assetCode: AssetCode): Asset;
  
  // Check if asset is native (XLM)
  isNativeAsset(assetCode: AssetCode): boolean;
  
  // Format amount to asset precision
  formatAssetAmount(amount: number, assetCode: AssetCode): string;
  
  // Parse string amount to number
  parseAssetAmount(amountString: string, assetCode: AssetCode): number;
  
  // Get all supported assets
  getAssetList(): Asset[];
  
  // Validate asset code
  isValidAssetCode(code: string): boolean;
}
```

**Asset Metadata**:
```typescript
const ASSETS: Record<AssetCode, Asset> = {
  XLM: {
    code: 'XLM',
    issuer: null, // Native asset
    decimals: 7,
    name: 'Stellar Lumens',
  },
  USDC: {
    code: 'USDC',
    issuer: 'GBBD47UZQ2BNSE7E2CMML7BNPI5BEFF2KE5FIXEDISSUERADDRESS',
    decimals: 6,
    name: 'USD Coin',
  },
  PYUSD: {
    code: 'PYUSD',
    issuer: 'GDZ55LVXECRTW4G36ICJVWCIHL7BQUM2FixedIssuerAddress',
    decimals: 6,
    name: 'PayPal USD',
  },
};
```

### ExchangeRateService

**Purpose**: Fetch and cache exchange rates from Stellar DEX

**Methods**:
```typescript
class ExchangeRateService {
  // Fetch exchange rate with caching
  async fetchExchangeRate(
    fromAsset: AssetCode,
    toAsset: AssetCode
  ): Promise<number>;
  
  // Invalidate cache for a pair
  invalidateCache(fromAsset: AssetCode, toAsset: AssetCode): void;
  
  // Get cache status
  getCacheStatus(): CacheStatus;
  
  // Batch fetch multiple rates
  async fetchMultipleRates(
    pairs: Array<[AssetCode, AssetCode]>
  ): Promise<Map<string, number>>;
}
```

**Cache Implementation**:
```typescript
interface CacheEntry {
  rate: number;
  timestamp: number;
  ttl: number; // 60 seconds
}

private cache: Map<string, CacheEntry> = new Map();

private getCacheKey(from: AssetCode, to: AssetCode): string {
  return `${from}/${to}`;
}

private isCacheValid(entry: CacheEntry): boolean {
  return Date.now() - entry.timestamp < entry.ttl;
}
```

**Horizon API Integration**:
- Query order book for trading pairs
- Calculate effective rate from best ask/bid
- Handle no-path scenarios

### TrustlineValidator

**Purpose**: Check if account has trustline for an asset

**Methods**:
```typescript
class TrustlineValidator {
  // Check if account has trustline
  async hasTrustline(
    account: string,
    assetCode: AssetCode
  ): Promise<boolean>;
  
  // Get trustline details
  async getTrustlineDetails(
    account: string,
    assetCode: AssetCode
  ): Promise<Trustline | null>;
  
  // Invalidate cache
  invalidateCache(account: string, assetCode: AssetCode): void;
}
```

**Cache Strategy**:
- Cache trustline status for 30 seconds
- Invalidate on trustline creation
- Share cache across components

### FeeCalculator

**Purpose**: Calculate asset-specific fees

**Methods**:
```typescript
class FeeCalculator {
  // Calculate fees in selected asset
  async calculateFees(
    amount: number,
    asset: AssetCode,
    isPathPayment: boolean
  ): Promise<AssetFees>;
}
```

**Fee Calculation Logic**:
1. Base fee: 100 stroops (0.00001 XLM)
2. For XLM: Convert stroops to XLM
3. For USDC/PYUSD: Convert stroops to XLM, then to selected asset using exchange rate
4. Path payment fee: +10% for each intermediate asset
5. Round to asset precision

## 4. Data Models

### Asset Types

```typescript
type AssetCode = 'XLM' | 'USDC' | 'PYUSD';

interface Asset {
  code: AssetCode;
  issuer: string | null; // null for native asset
  decimals: number;
  name: string;
}

interface ExchangeRate {
  fromAsset: AssetCode;
  toAsset: AssetCode;
  rate: number;
  timestamp: number;
}

interface Trustline {
  asset: AssetCode;
  balance: string;
  limit: string;
  authorized: boolean;
}

interface AssetBalance {
  asset: AssetCode;
  amount: string;
  formattedAmount: string;
}

interface PathPayment {
  sendAsset: AssetCode;
  sendAmount: string;
  path: AssetCode[];
  receiveAsset: AssetCode;
  receiveAmount: string;
}

interface AssetFees {
  baseFee: string;
  pathFee: string;
  totalFee: string;
  feeAsset: AssetCode;
}

interface CacheStatus {
  entries: number;
  rates: Array<{
    pair: string;
    rate: number;
    expiresIn: number; // seconds
  }>;
}
```

## 5. API Integration

### Stellar Horizon API Endpoints

**1. Get Account Balances & Trustlines**
```
GET /accounts/{account_id}
Response includes:
- balances: Array of { asset_type, asset_code, asset_issuer, balance }
```

**2. Get Order Book (Exchange Rates)**
```
GET /order_book?selling_asset_type=native&buying_asset_code=USDC&buying_asset_issuer=...
Response includes:
- bids: Array of { price, amount }
- asks: Array of { price, amount }
```

**3. Find Payment Path**
```
GET /paths?source_account={account}&destination_account={account}&destination_asset_code=USDC&destination_asset_issuer=...&destination_amount=100
Response includes:
- _embedded.records: Array of paths with assets and amounts
```

## 6. Caching Strategy

### Exchange Rate Cache

**TTL**: 60 seconds
**Key**: `{fromAsset}/{toAsset}`
**Invalidation**: Manual or automatic on expiry

**Implementation**:
```typescript
private cache: Map<string, CacheEntry> = new Map();

async fetchExchangeRate(from: AssetCode, to: AssetCode): Promise<number> {
  const key = this.getCacheKey(from, to);
  const cached = this.cache.get(key);
  
  if (cached && this.isCacheValid(cached)) {
    return cached.rate;
  }
  
  const rate = await this.queryHorizonAPI(from, to);
  this.cache.set(key, {
    rate,
    timestamp: Date.now(),
    ttl: 60000,
  });
  
  return rate;
}
```

### Trustline Cache

**TTL**: 30 seconds
**Key**: `{account}/{assetCode}`
**Invalidation**: Manual on trustline creation

## 7. Error Handling

### Error Scenarios

1. **Exchange Rate Unavailable**
   - Cause: No trading path on DEX
   - Action: Display error, disable confirm button
   - Message: "No trading path available for [Asset]"

2. **Trustline Missing**
   - Cause: Account doesn't have trustline
   - Action: Display warning, show create trustline button
   - Message: "You don't have a trustline for [Asset]. Create one to proceed."

3. **API Failure**
   - Cause: Horizon API unreachable
   - Action: Display error, allow retry
   - Message: "Unable to fetch data. Please try again."

4. **Account Not Found**
   - Cause: Account doesn't exist on network
   - Action: Display error
   - Message: "Account not found on the Stellar network."

### Recovery Strategies

- Retry with exponential backoff
- Fall back to cached data if available
- Provide manual retry button
- Log errors for debugging

## 8. Performance Considerations

### Optimization Strategies

1. **Parallel API Calls**: Fetch exchange rates and trustlines in parallel
2. **Caching**: 60-second TTL for rates, 30-second for trustlines
3. **Batch Requests**: Fetch multiple rates in single request when possible
4. **Background Updates**: Refresh cache in background without blocking UI
5. **Lazy Loading**: Load asset metadata on demand
6. **Debouncing**: Debounce asset selection changes to avoid excessive API calls

### Performance Targets

- Asset selection update: < 100ms
- Exchange rate fetch: < 500ms (cached: < 10ms)
- Trustline check: < 500ms (cached: < 10ms)
- Fee calculation: < 50ms
- Payment modal render: < 200ms

## 9. Implementation Phases

### Phase 1: Foundation (Atomic Commits)
1. Create asset types (asset.types.ts)
2. Create asset service (asset.service.ts)
3. Create asset utilities (asset.utils.ts)

### Phase 2: Exchange Rates
1. Create exchange rate service (exchange-rate.service.ts)
2. Implement caching logic
3. Integrate with PaymentModal

### Phase 3: Trustlines
1. Create trustline validator
2. Implement trustline creation flow
3. Integrate with PaymentModal

### Phase 4: Path Payments
1. Implement path payment logic in TransactionBuilder
2. Integrate with PaymentModal
3. Display path information

### Phase 5: Integration & Testing
1. Wire AssetSelector to PaymentModal
2. Implement fee calculations
3. Add comprehensive tests
4. Performance optimization

## 10. Testing Strategy

### Unit Tests
- Asset service methods
- Exchange rate caching
- Fee calculations
- Utility functions

### Integration Tests
- PaymentModal with asset selection
- Exchange rate fetching and display
- Trustline validation
- Path payment building

### E2E Tests
- Complete payment flow with asset selection
- Trustline creation flow
- Error scenarios

### Property-Based Tests
- Exchange rate consistency
- Fee calculation correctness
- Cache invalidation timing
