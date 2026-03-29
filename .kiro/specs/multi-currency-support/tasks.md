# Multi-Currency Support Implementation Tasks

## Phase 1: Foundation - Asset Types and Service

- [x] 1. Create asset types file (asset.types.ts)
  - [x] 1.1 Define AssetCode type union
  - [x] 1.2 Define Asset interface with code, issuer, decimals, name
  - [x] 1.3 Define ExchangeRate interface
  - [x] 1.4 Define Trustline interface
  - [x] 1.5 Define AssetBalance interface
  - [x] 1.6 Define PathPayment interface
  - [x] 1.7 Define AssetFees interface
  - [x] 1.8 Add JSDoc comments to all types

- [x] 2. Create asset service (asset.service.ts)
  - [x] 2.1 Define ASSETS metadata constant for XLM, USDC, PYUSD
  - [x] 2.2 Implement getAssetMetadata() method
  - [x] 2.3 Implement isNativeAsset() method
  - [x] 2.4 Implement formatAssetAmount() method
  - [x] 2.5 Implement parseAssetAmount() method
  - [x] 2.6 Implement getAssetList() method
  - [x] 2.7 Implement isValidAssetCode() method
  - [x] 2.8 Export singleton instance

- [x] 3. Create asset utilities (asset.utils.ts)
  - [x] 3.1 Implement formatAssetDisplay() function
  - [x] 3.2 Implement getAssetIcon() function
  - [x] 3.3 Implement isValidAssetCode() function
  - [x] 3.4 Implement convertAmount() function
  - [x] 3.5 Implement roundToAssetPrecision() function
  - [x] 3.6 Implement compareAssets() function
  - [x] 3.7 Add error handling for edge cases

## Phase 2: Exchange Rate Service

- [x] 4. Create exchange rate service (exchange-rate.service.ts)
  - [x] 4.1 Define CacheEntry interface
  - [x] 4.2 Implement cache Map and cache key generation
  - [x] 4.3 Implement isCacheValid() method
  - [x] 4.4 Implement fetchExchangeRate() with caching logic
  - [x] 4.5 Implement invalidateCache() method
  - [x] 4.6 Implement getCacheStatus() method
  - [x] 4.7 Implement fetchMultipleRates() for batch requests
  - [x] 4.8 Implement Horizon API integration for order book queries
  - [x] 4.9 Add error handling for no-path scenarios
  - [x] 4.10 Export singleton instance

- [x] 5. Integrate exchange rates with PaymentModal
  - [x] 5.1 Add selectedAsset state to PaymentModal
  - [x] 5.2 Add exchangeRate state to PaymentModal
  - [x] 5.3 Add useEffect to fetch exchange rate on asset change
  - [x] 5.4 Display exchange rate in payment breakdown
  - [x] 5.5 Calculate and display converted amounts
  - [x] 5.6 Handle exchange rate fetch errors

## Phase 3: Trustline Validation

- [x] 6. Create trustline validator service
  - [x] 6.1 Define trustline cache Map
  - [x] 6.2 Implement hasTrustline() method
  - [x] 6.3 Implement getTrustlineDetails() method
  - [x] 6.4 Implement invalidateCache() method
  - [x] 6.5 Implement Horizon API integration for account balances
  - [x] 6.6 Add caching with 30-second TTL
  - [x] 6.7 Add error handling for account not found
  - [x] 6.8 Export singleton instance

- [x] 7. Integrate trustline validation with PaymentModal
  - [x] 7.1 Add trustlineStatus state to PaymentModal
  - [x] 7.2 Add useEffect to check trustline on asset change
  - [x] 7.3 Display trustline warning if missing
  - [x] 7.4 Add create trustline button
  - [x] 7.5 Implement trustline creation flow
  - [x] 7.6 Handle trustline check errors

## Phase 4: Fee Calculations

- [x] 8. Create fee calculator service
  - [x] 8.1 Define AssetFees interface
  - [x] 8.2 Implement calculateFees() method
  - [x] 8.3 Implement base fee calculation (100 stroops)
  - [x] 8.4 Implement XLM fee conversion
  - [x] 8.5 Implement USDC/PYUSD fee conversion using exchange rates
  - [x] 8.6 Implement path payment fee calculation (+10% per intermediate)
  - [x] 8.7 Implement rounding to asset precision
  - [x] 8.8 Add error handling for missing exchange rates
  - [x] 8.9 Export singleton instance

- [x] 9. Integrate fee calculations with PaymentModal
  - [x] 9.1 Add fees state to PaymentModal
  - [x] 9.2 Add useEffect to recalculate fees on asset/amount change
  - [x] 9.3 Display fee breakdown in payment modal
  - [x] 9.4 Show base fee, path fee, and total fee
  - [x] 9.5 Update fees when exchange rate changes

## Phase 5: Asset Selector Component

- [ ] 10. Create AssetSelector component
  - [x] 10.1 Define AssetSelectorProps interface
  - [x] 10.2 Render three asset buttons (XLM, USDC, PYUSD)
  - [x] 10.3 Implement asset selection state management
  - [x] 10.4 Highlight selected asset visually
  - [x] 10.5 Display asset icons
  - [x] 10.6 Display asset names
  - [x] 10.7 Add onClick handlers for asset selection
  - [x] 10.8 Add accessibility attributes (aria-label, role)

- [x] 11. Integrate AssetSelector with PaymentModal
  - [x] 11.1 Import AssetSelector component
  - [x] 11.2 Render AssetSelector in PaymentModal
  - [x] 11.3 Pass selectedAsset and onAssetChange props
  - [x] 11.4 Update PaymentModal state on asset change
  - [x] 11.5 Trigger exchange rate fetch on asset change
  - [x] 11.6 Trigger trustline check on asset change

## Phase 6: Transaction Builder Integration

- [x] 12. Modify TransactionBuilder for multi-asset support
  - [x] 12.1 Add selectedAsset parameter to buildPayment()
  - [x] 12.2 Implement asset validation
  - [x] 12.3 For XLM: Use standard Payment operation
  - [x] 12.4 For USDC/PYUSD: Check recipient trustline
  - [x] 12.5 If trustline exists: Use Payment operation
  - [x] 12.6 If trustline missing: Use PathPaymentStrictReceive
  - [x] 12.7 Implement path calculation logic
  - [x] 12.8 Include asset code and issuer in operation
  - [x] 12.9 Add error handling for no-path scenarios
  - [x] 12.10 Maintain backward compatibility with XLM-only flows

## Phase 7: Path Payment Support

- [x] 13. Implement path payment logic
  - [x] 13.1 Create PathPaymentBuilder class
  - [x] 13.2 Implement path finding using Horizon API
  - [x] 13.3 Implement path validation
  - [x] 13.4 Calculate send max and receive min amounts
  - [x] 13.5 Build PathPaymentStrictReceive operation
  - [x] 13.6 Display path information in PaymentModal
  - [x] 13.7 Add error handling for no-path scenarios

- [x] 14. Integrate path payments with PaymentModal
  - [x] 14.1 Add pathPayment state to PaymentModal
  - [x] 14.2 Display path (e.g., "USDC → XLM → PYUSD")
  - [x] 14.3 Show intermediate assets
  - [x] 14.4 Display send and receive amounts
  - [x] 14.5 Update path when asset changes

## Phase 8: Error Handling and User Feedback

- [x] 15. Implement comprehensive error handling
  - [x] 15.1 Add error state to PaymentModal
  - [x] 15.2 Display error messages for exchange rate failures
  - [x] 15.3 Display error messages for trustline check failures
  - [x] 15.4 Display error messages for path payment failures
  - [x] 15.5 Display error messages for account not found
  - [x] 15.6 Implement retry logic with exponential backoff
  - [x] 15.7 Disable confirm button on errors
  - [x] 15.8 Add user-friendly error messages

- [x] 16. Implement loading states
  - [x] 16.1 Add loading state to PaymentModal
  - [x] 16.2 Show loading indicator during exchange rate fetch
  - [x] 16.3 Show loading indicator during trustline check
  - [x] 16.4 Show loading indicator during path calculation
  - [x] 16.5 Disable user interactions during loading
  - [x] 16.6 Show loading spinner or skeleton

## Phase 9: Testing

- [x] 17. Write unit tests for asset service
  - [x] 17.1 Test getAssetMetadata() for all assets
  - [x] 17.2 Test isNativeAsset() for XLM and non-native
  - [x] 17.3 Test formatAssetAmount() with various amounts
  - [x] 17.4 Test parseAssetAmount() with valid strings
  - [x] 17.5 Test isValidAssetCode() with valid and invalid codes

- [x] 18. Write unit tests for exchange rate service
  - [x] 18.1 Test fetchExchangeRate() returns correct rate
  - [x] 18.2 Test cache returns cached rate within TTL
  - [x] 18.3 Test cache invalidation after TTL expires
  - [x] 18.4 Test invalidateCache() removes entry
  - [x] 18.5 Test getCacheStatus() returns correct info
  - [x] 18.6 Test error handling for no-path scenarios

- [x] 19. Write unit tests for trustline validator
  - [x] 19.1 Test hasTrustline() returns true for existing trustline
  - [x] 19.2 Test hasTrustline() returns false for missing trustline
  - [x] 19.3 Test getTrustlineDetails() returns correct details
  - [x] 19.4 Test cache returns cached status within TTL
  - [x] 19.5 Test error handling for account not found

- [x] 20. Write unit tests for fee calculator
  - [x] 20.1 Test calculateFees() for XLM
  - [x] 20.2 Test calculateFees() for USDC
  - [x] 20.3 Test calculateFees() for PYUSD
  - [x] 20.4 Test path payment fee calculation
  - [x] 20.5 Test rounding to asset precision
  - [x] 20.6 Test error handling for missing exchange rates

- [x] 21. Write integration tests for PaymentModal
  - [x] 21.1 Test asset selection updates state
  - [x] 21.2 Test exchange rate display updates on asset change
  - [x] 21.3 Test trustline warning displays when missing
  - [x] 21.4 Test fee display updates on asset change
  - [x] 21.5 Test payment breakdown displays correctly
  - [x] 21.6 Test error messages display on failures

- [x] 22. Write E2E tests for complete flow
  - [x] 22.1 Test complete payment flow with XLM
  - [x] 22.2 Test complete payment flow with USDC
  - [x] 22.3 Test complete payment flow with PYUSD
  - [x] 22.4 Test trustline creation flow
  - [x] 22.5 Test error recovery flows

## Phase 10: Performance Optimization

- [x] 23. Optimize API calls
  - [x] 23.1 Implement request batching for multiple rates
  - [x] 23.2 Implement request debouncing for asset selection
  - [x] 23.3 Implement parallel API calls for rate and trustline
  - [x] 23.4 Add request cancellation on component unmount
  - [x] 23.5 Implement background cache refresh

- [x] 24. Optimize component rendering
  - [x] 24.1 Memoize AssetSelector component
  - [x] 24.2 Memoize PaymentModal sub-components
  - [x] 24.3 Implement useCallback for event handlers
  - [x] 24.4 Implement useMemo for expensive calculations
  - [x] 24.5 Profile and optimize render performance

## Phase 11: Documentation and Cleanup

- [x] 25. Add comprehensive documentation
  - [x] 25.1 Add JSDoc comments to all services
  - [x] 25.2 Add JSDoc comments to all components
  - [x] 25.3 Add JSDoc comments to all utilities
  - [x] 25.4 Create README for multi-currency feature
  - [x] 25.5 Document API integration patterns
  - [x] 25.6 Document caching strategy

- [x] 26. Code cleanup and review
  - [x] 26.1 Remove console.log statements
  - [x] 26.2 Fix linting issues
  - [x] 26.3 Ensure consistent code style
  - [x] 26.4 Review error handling
  - [x] 26.5 Review performance optimizations
  - [x] 26.6 Final code review before PR

## Correctness Properties (Property-Based Testing)

### Property 1: Exchange Rate Consistency
**Property**: For any asset pair (A, B), if we fetch the rate multiple times within the cache TTL, the rate should be identical.
**Test**: Fetch rate 3 times within 60 seconds, verify all are equal.

### Property 2: Cache Invalidation
**Property**: After cache TTL expires, the next fetch should query the API and return a potentially different rate.
**Test**: Fetch rate, wait 61 seconds, fetch again, verify API was called.

### Property 3: Fee Calculation Correctness
**Property**: For any amount and asset, the calculated fee should be >= base fee and <= amount.
**Test**: Generate random amounts, verify fees are within bounds.

### Property 4: Trustline Status Accuracy
**Property**: If an account has a trustline for an asset, hasTrustline() should return true; if not, should return false.
**Test**: Check trustline status against actual account balances from Horizon.

### Property 5: Asset Amount Precision
**Property**: For any asset, formatting and parsing an amount should preserve precision to the asset's decimal places.
**Test**: Format amount, parse it back, verify it equals original (within precision).

### Property 6: Path Payment Validity
**Property**: A path payment should only be used when the recipient doesn't have a trustline for the send asset.
**Test**: Verify path payment is used only when necessary.

### Property 7: Exchange Rate Bounds
**Property**: Exchange rates should always be positive and within reasonable bounds (not 0 or infinity).
**Test**: Verify all fetched rates are > 0 and < 1000000.

### Property 8: Atomic Asset Selection
**Property**: When asset is selected, all dependent state (exchange rate, trustline, fees) should be updated atomically.
**Test**: Select asset, verify all state updates complete before next render.
