# Multi-Currency Support Requirements Document

## Introduction

The MentorsMind-Contract platform currently supports only XLM (Stellar Lumens) for payments. This feature extends payment capabilities to include USDC (USD Coin) and PYUSD (PayPal USD), enabling mentors and users to transact in multiple stablecoins on the Stellar network. The PaymentModal component has UI elements for asset selection, but they are non-functional. This feature wires asset selection to the transaction builder, implements live exchange rate fetching, validates trustlines, and enables cross-asset settlement through path payments.

## Glossary

- **Asset**: A digital token on the Stellar network (XLM, USDC, or PYUSD)
- **Trustline**: A ledger entry that allows an account to hold a non-native asset
- **Exchange Rate**: The conversion ratio between two assets (e.g., XLM/USDC)
- **Path Payment**: A Stellar transaction that converts one asset to another through a path of trades
- **Stellar DEX**: Decentralized exchange built into the Stellar network for trading assets
- **Horizon API**: Stellar's REST API for querying ledger data and submitting transactions
- **Asset Selector**: UI component allowing users to choose between XLM, USDC, and PYUSD
- **Payment Breakdown**: Display showing payment amount, fees, and total in the selected asset
- **TTL**: Time-to-live; cache expiration period (60 seconds for exchange rates)
- **Fee Calculation**: Computation of transaction fees based on the selected asset
- **Asset Code**: Three-letter identifier for an asset (XLM, USDC, PYUSD)
- **Issuer**: The account that created and manages an asset on Stellar
- **Native Asset**: XLM, the default asset on Stellar (no trustline required)

## Requirements

### Requirement 1: Asset Selection Integration

**User Story:** As a user, I want to select between XLM, USDC, and PYUSD in the payment modal, so that I can pay in my preferred currency.

#### Acceptance Criteria

1. WHEN the PaymentModal component renders, THE AssetSelector SHALL display three buttons for XLM, USDC, and PYUSD
2. WHEN a user clicks an asset button, THE PaymentModal SHALL update the selected asset state
3. WHEN an asset is selected, THE PaymentModal SHALL wire the selection to the transaction builder
4. WHEN the transaction builder receives an asset selection, THE TransactionBuilder SHALL use that asset for the payment operation
5. THE AssetSelector SHALL visually indicate the currently selected asset (e.g., highlighted button)
6. WHEN the PaymentModal mounts, THE AssetSelector SHALL default to XLM as the selected asset

### Requirement 2: Exchange Rate Fetching Service

**User Story:** As a developer, I want a service that fetches live exchange rates from the Stellar DEX, so that I can display accurate conversion rates to users.

#### Acceptance Criteria

1. WHEN the ExchangeRateService is initialized, THE Service SHALL establish a connection to the Stellar Horizon API
2. WHEN fetchExchangeRate(fromAsset, toAsset) is called, THE Service SHALL query the Stellar DEX for the current exchange rate
3. WHEN the Stellar DEX returns a rate, THE Service SHALL return the rate as a decimal number (e.g., 0.0875 for XLM/USDC)
4. IF the Stellar DEX has no trading path between assets, THEN THE Service SHALL return an error indicating no path exists
5. IF the Horizon API request fails, THEN THE Service SHALL return an error with the HTTP status code and message
6. WHEN fetchExchangeRate is called multiple times within 60 seconds for the same asset pair, THE Service SHALL return the cached rate without querying the API
7. WHEN 60 seconds have elapsed since a rate was cached, THE Service SHALL invalidate the cache entry for that pair
8. THE Service SHALL support fetching rates for all combinations of XLM, USDC, and PYUSD

### Requirement 3: Live Exchange Rate Display

**User Story:** As a user, I want to see live exchange rates and converted amounts in the payment breakdown, so that I know exactly how much I'm paying in my selected currency.

#### Acceptance Criteria

1. WHEN a user selects an asset in the PaymentModal, THE PaymentModal SHALL fetch the exchange rate for that asset
2. WHEN the exchange rate is fetched, THE PaymentModal SHALL display the rate (e.g., "1 XLM = 0.0875 USDC")
3. WHEN a payment amount is entered, THE PaymentModal SHALL calculate and display the equivalent amount in the selected asset
4. WHEN the exchange rate is updated (cache expires), THE PaymentModal SHALL refresh the displayed converted amount
5. THE PaymentModal SHALL display the payment breakdown including: original amount, exchange rate, converted amount, and total fees in the selected asset
6. IF the exchange rate fetch fails, THEN THE PaymentModal SHALL display an error message and disable the confirm button
7. WHEN the user changes the selected asset, THE PaymentModal SHALL immediately fetch the new exchange rate and update all displayed amounts

### Requirement 4: Trustline Validation

**User Story:** As a user, I want the system to check if I have a trustline for the selected asset before payment, so that I don't attempt to receive an asset I can't hold.

#### Acceptance Criteria

1. WHEN a user selects a non-native asset (USDC or PYUSD), THE PaymentModal SHALL check if the user's account has a trustline for that asset
2. WHEN the trustline check is performed, THE TrustlineValidator SHALL query the Horizon API for the user's account balances
3. IF a trustline exists for the selected asset, THEN THE PaymentModal SHALL proceed normally
4. IF no trustline exists for the selected asset, THEN THE PaymentModal SHALL display a warning message
5. IF no trustline exists, THEN THE PaymentModal SHALL display a button to create a trustline
6. WHEN a user clicks the create trustline button, THE PaymentModal SHALL initiate the trustline creation flow
7. IF the user's account is not found on the Horizon API, THEN THE PaymentModal SHALL display an error message
8. THE TrustlineValidator SHALL cache trustline status for 30 seconds to avoid excessive API calls

### Requirement 5: Trustline Creation Flow

**User Story:** As a user, I want to create a trustline for USDC or PYUSD in the wallet UI, so that I can receive and hold these assets.

#### Acceptance Criteria

1. WHEN the trustline creation flow is initiated, THE WalletUI SHALL display a confirmation dialog
2. THE confirmation dialog SHALL show the asset code (USDC or PYUSD) and the issuer address
3. WHEN the user confirms trustline creation, THE TrustlineService SHALL build a ChangeTrust operation
4. WHEN the ChangeTrust operation is built, THE TrustlineService SHALL set the limit to the maximum allowed value (922337203685.4775807 XLM equivalent)
5. WHEN the user signs the transaction, THE TrustlineService SHALL submit the transaction to the Stellar network
6. WHEN the transaction is submitted, THE WalletUI SHALL display a loading indicator
7. WHEN the transaction is confirmed on the ledger, THE WalletUI SHALL display a success message
8. IF the transaction fails, THEN THE WalletUI SHALL display an error message with the failure reason
9. AFTER trustline creation succeeds, THE PaymentModal SHALL automatically refresh the trustline status

### Requirement 6: Path Payment Implementation

**User Story:** As a developer, I want to implement path payments for cross-asset settlement, so that users can pay in one asset and have the recipient receive another asset.

#### Acceptance Criteria

1. WHEN a user selects a non-native asset for payment, THE TransactionBuilder SHALL determine if a path payment is required
2. IF the recipient has a trustline for the selected asset, THEN THE TransactionBuilder SHALL use a standard Payment operation
3. IF the recipient does not have a trustline for the selected asset, THEN THE TransactionBuilder SHALL use a PathPaymentStrictReceive operation
4. WHEN building a PathPaymentStrictReceive operation, THE TransactionBuilder SHALL calculate the path through the Stellar DEX
5. WHEN the path is calculated, THE TransactionBuilder SHALL set the send asset, send max, destination asset, and destination min
6. THE TransactionBuilder SHALL include at least one intermediate asset in the path (e.g., XLM) to ensure liquidity
7. IF no path exists between the send and destination assets, THEN THE TransactionBuilder SHALL return an error
8. WHEN a path payment is built, THE PaymentModal SHALL display the path (e.g., "USDC → XLM → PYUSD")

### Requirement 7: Exchange Rate Caching

**User Story:** As a developer, I want exchange rates to be cached with a 60-second TTL, so that the application performs efficiently and reduces API load.

#### Acceptance Criteria

1. WHEN an exchange rate is fetched from the Stellar DEX, THE ExchangeRateService SHALL store it in memory with a timestamp
2. WHEN fetchExchangeRate is called for a cached pair, THE Service SHALL check if the cache entry is still valid (within 60 seconds)
3. IF the cache entry is valid, THE Service SHALL return the cached rate without querying the API
4. IF the cache entry has expired, THE Service SHALL remove it from the cache and fetch a fresh rate
5. THE ExchangeRateService SHALL support manual cache invalidation via an invalidateCache(assetPair) method
6. WHEN the application receives a manual cache invalidation request, THE Service SHALL immediately remove the entry
7. THE ExchangeRateService SHALL provide a getCacheStatus() method that returns the current cache contents and expiration times
8. THE cache SHALL be stored in memory and cleared when the application restarts

### Requirement 8: Asset-Specific Fee Calculations

**User Story:** As a user, I want fees to be calculated based on the selected asset, so that I understand the true cost of my payment.

#### Acceptance Criteria

1. WHEN a payment is built in the TransactionBuilder, THE FeeCalculator SHALL determine the base fee in stroops (1 XLM = 10,000,000 stroops)
2. WHEN the selected asset is XLM, THE FeeCalculator SHALL calculate fees in stroops and convert to XLM
3. WHEN the selected asset is USDC or PYUSD, THE FeeCalculator SHALL calculate fees in stroops, convert to XLM, then convert to the selected asset using the current exchange rate
4. WHEN a path payment is used, THE FeeCalculator SHALL add an additional fee for the path complexity (e.g., +10% for each intermediate asset)
5. WHEN fees are calculated, THE PaymentModal SHALL display the fee breakdown: base fee, path fee (if applicable), and total fee
6. THE FeeCalculator SHALL round fees to the asset's precision (7 decimal places for XLM, USDC, PYUSD)
7. IF the exchange rate is unavailable, THEN THE FeeCalculator SHALL display an error and prevent payment submission
8. WHEN the user changes the selected asset, THE PaymentModal SHALL recalculate and display the updated fees

### Requirement 9: Asset Service Core Functionality

**User Story:** As a developer, I want a centralized asset service that manages asset metadata and operations, so that asset handling is consistent across the application.

#### Acceptance Criteria

1. WHEN the AssetService is initialized, THE Service SHALL load metadata for XLM, USDC, and PYUSD (asset code, issuer, decimals)
2. WHEN getAssetMetadata(assetCode) is called, THE Service SHALL return the asset's code, issuer address, and decimal places
3. WHEN isNativeAsset(assetCode) is called, THE Service SHALL return true for XLM and false for USDC and PYUSD
4. WHEN formatAssetAmount(amount, assetCode) is called, THE Service SHALL format the amount to the asset's decimal precision
5. WHEN parseAssetAmount(amountString, assetCode) is called, THE Service SHALL parse the string to a number with proper decimal handling
6. THE AssetService SHALL provide a getAssetList() method that returns all supported assets
7. WHEN an unsupported asset code is requested, THE Service SHALL return an error indicating the asset is not supported
8. THE AssetService SHALL validate asset codes and issuer addresses against Stellar's format requirements

### Requirement 10: Asset Utilities and Helpers

**User Story:** As a developer, I want utility functions for asset operations, so that I can perform common asset tasks without duplicating code.

#### Acceptance Criteria

1. WHEN formatAssetDisplay(assetCode) is called, THE Utility SHALL return a human-readable asset name (e.g., "USD Coin" for USDC)
2. WHEN getAssetIcon(assetCode) is called, THE Utility SHALL return the path to the asset's icon image
3. WHEN isValidAssetCode(code) is called, THE Utility SHALL return true if the code is XLM, USDC, or PYUSD
4. WHEN convertAmount(amount, fromAsset, toAsset, exchangeRate) is called, THE Utility SHALL calculate the converted amount
5. WHEN roundToAssetPrecision(amount, assetCode) is called, THE Utility SHALL round the amount to the asset's decimal places
6. WHEN compareAssets(asset1, asset2) is called, THE Utility SHALL return true if both assets are the same
7. THE Utility functions SHALL handle edge cases: zero amounts, very large amounts, and precision loss
8. WHEN an invalid asset code is passed to any utility function, THE Function SHALL return an error or default value

### Requirement 11: Asset Type Definitions

**User Story:** As a developer, I want TypeScript type definitions for assets, so that I have type safety and IDE support for asset operations.

#### Acceptance Criteria

1. THE AssetTypes file SHALL define an Asset interface with properties: code, issuer, decimals, name
2. THE AssetTypes file SHALL define an ExchangeRate interface with properties: fromAsset, toAsset, rate, timestamp
3. THE AssetTypes file SHALL define an AssetBalance interface with properties: asset, amount, formattedAmount
4. THE AssetTypes file SHALL define a Trustline interface with properties: asset, balance, limit, authorized
5. THE AssetTypes file SHALL define an AssetCode type as a union of 'XLM' | 'USDC' | 'PYUSD'
6. THE AssetTypes file SHALL define a PathPayment interface with properties: sendAsset, sendAmount, path, receiveAsset, receiveAmount
7. THE AssetTypes file SHALL export all types for use in other modules
8. ALL type definitions SHALL include JSDoc comments explaining their purpose and usage

### Requirement 12: Integration with Transaction Builder

**User Story:** As a developer, I want the asset selection to integrate seamlessly with the existing transaction builder, so that payments can be built with the selected asset.

#### Acceptance Criteria

1. WHEN the TransactionBuilder receives an asset selection, THE Builder SHALL store the selected asset in its state
2. WHEN buildPayment(recipient, amount, asset) is called, THE Builder SHALL use the provided asset for the operation
3. IF the asset is XLM, THE Builder SHALL use a standard Payment operation
4. IF the asset is USDC or PYUSD, THE Builder SHALL check the recipient's trustline and use Payment or PathPaymentStrictReceive accordingly
5. WHEN the transaction is built, THE Builder SHALL include the asset code and issuer in the operation
6. WHEN the transaction is signed and submitted, THE Builder SHALL return the transaction hash
7. IF the transaction submission fails, THE Builder SHALL return an error with details
8. THE TransactionBuilder SHALL maintain backward compatibility with existing XLM-only payment flows

### Requirement 13: Error Handling and User Feedback

**User Story:** As a user, I want clear error messages when something goes wrong, so that I understand what happened and how to fix it.

#### Acceptance Criteria

1. WHEN an exchange rate fetch fails, THE PaymentModal SHALL display an error message: "Unable to fetch exchange rates. Please try again."
2. WHEN a trustline check fails, THE PaymentModal SHALL display an error message: "Unable to verify trustline status. Please try again."
3. WHEN a trustline is missing, THE PaymentModal SHALL display a warning: "You don't have a trustline for [Asset]. Create one to proceed."
4. WHEN a path payment path cannot be found, THE PaymentModal SHALL display an error: "No trading path available for [Asset]. Please select a different asset."
5. WHEN a transaction submission fails, THE PaymentModal SHALL display the error from the Stellar network
6. WHEN the user's account is not found, THE PaymentModal SHALL display an error: "Account not found on the Stellar network."
7. ALL error messages SHALL be user-friendly and actionable
8. WHEN an error occurs, THE PaymentModal SHALL disable the confirm button and provide a way to retry

### Requirement 14: Performance and Optimization

**User Story:** As a user, I want the payment modal to load quickly and respond smoothly, so that the payment experience is seamless.

#### Acceptance Criteria

1. WHEN the PaymentModal mounts, THE Component SHALL fetch exchange rates in parallel (not sequentially)
2. WHEN exchange rates are cached, THE PaymentModal SHALL display them immediately without waiting for API calls
3. WHEN the user changes the selected asset, THE PaymentModal SHALL update the display within 100ms
4. WHEN the exchange rate cache expires, THE Service SHALL fetch a fresh rate in the background without blocking the UI
5. THE ExchangeRateService SHALL batch API requests when multiple rates are needed simultaneously
6. WHEN the application has multiple PaymentModal instances, THE ExchangeRateService cache SHALL be shared across all instances
7. THE TrustlineValidator cache SHALL be shared across all components to avoid duplicate API calls
8. WHEN the user navigates away from the PaymentModal, THE Component SHALL cancel pending API requests

### Requirement 15: Testing and Validation

**User Story:** As a developer, I want comprehensive test coverage for asset operations, so that I can be confident the feature works correctly.

#### Acceptance Criteria

1. WHEN exchange rates are fetched and cached, THE Tests SHALL verify that subsequent calls return the cached value
2. WHEN the cache expires, THE Tests SHALL verify that a fresh rate is fetched
3. WHEN a trustline is missing, THE Tests SHALL verify that the user is prompted to create one
4. WHEN a trustline is created, THE Tests SHALL verify that the transaction is built and submitted correctly
5. WHEN a path payment is built, THE Tests SHALL verify that the path includes the correct assets
6. WHEN fees are calculated, THE Tests SHALL verify that they are correct for each asset
7. WHEN the user selects an asset, THE Tests SHALL verify that the PaymentModal updates correctly
8. WHEN an error occurs, THE Tests SHALL verify that the error message is displayed to the user

