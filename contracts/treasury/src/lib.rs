#![no_std]

use soroban_sdk::{
    contract, contracterror, contractimpl, contracttype, symbol_short, vec, Address, Env, Map,
    Symbol,
};

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum Error {
    AlreadyInitialized = 1,
    NotInitialized = 2,
    Unauthorized = 3,
    CooldownNotMet = 4,
    InvalidPercentage = 5,
    InsufficientFees = 6,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct BuybackExecutedEvent {
    pub usdc_spent: i128,
    pub mnt_burned: i128,
    pub price: i128,
}

#[contracttype]
#[derive(Clone)]
pub enum DataKey {
    Admin,
    TotalBurned,
    LastBuybackTime,
    BuybackPercentage,
    AccumulatedFees,
}

#[contract]
pub struct TreasuryContract;

#[contractimpl]
impl TreasuryContract {
    /// Initialize treasury contract with admin
    pub fn init(env: Env, admin: Address) -> Result<(), Error> {
        if env.storage().persistent().has(&DataKey::Admin) {
            return Err(Error::AlreadyInitialized);
        }
        env.storage().persistent().set(&DataKey::Admin, &admin);
        env.storage().persistent().set(&DataKey::TotalBurned, &0i128);
        env.storage().persistent().set(&DataKey::LastBuybackTime, &0u64);
        env.storage()
            .persistent()
            .set(&DataKey::BuybackPercentage, &20i128);
        env.storage()
            .persistent()
            .set(&DataKey::AccumulatedFees, &0i128);
        Ok(())
    }

    /// Trigger buyback and burn mechanism (callable by anyone, enforces 7-day cooldown)
    pub fn trigger_buyback(
        env: Env,
        usdc_token: Address,
        mnt_token: Address,
        dex_contract: Address,
        price: i128,
    ) -> Result<(), Error> {
        if !env.storage().persistent().has(&DataKey::Admin) {
            return Err(Error::NotInitialized);
        }

        let now = env.ledger().timestamp();
        let last_buyback: u64 = env
            .storage()
            .persistent()
            .get(&DataKey::LastBuybackTime)
            .unwrap_or(Ok(0u64))
            .unwrap_or(0u64);

        // Enforce 7-day cooldown
        const SEVEN_DAYS: u64 = 7 * 24 * 3600;
        if now < last_buyback + SEVEN_DAYS {
            return Err(Error::CooldownNotMet);
        }

        let accumulated_fees: i128 = env
            .storage()
            .persistent()
            .get(&DataKey::AccumulatedFees)
            .unwrap_or(Ok(0i128))
            .unwrap_or(0i128);

        if accumulated_fees == 0 {
            return Err(Error::InsufficientFees);
        }

        let buyback_percentage: i128 = env
            .storage()
            .persistent()
            .get(&DataKey::BuybackPercentage)
            .unwrap_or(Ok(20i128))
            .unwrap_or(20i128);

        // Calculate 20% of fees (or configured percentage)
        let usdc_to_spend = (accumulated_fees * buyback_percentage) / 100;

        if usdc_to_spend == 0 {
            return Err(Error::InsufficientFees);
        }

        // Calculate MNT received from DEX swap
        let mnt_burned = usdc_to_spend / price;

        // Update storage
        let mut total_burned: i128 = env
            .storage()
            .persistent()
            .get(&DataKey::TotalBurned)
            .unwrap_or(Ok(0i128))
            .unwrap_or(0i128);
        total_burned += mnt_burned;

        env.storage()
            .persistent()
            .set(&DataKey::TotalBurned, &total_burned);
        env.storage()
            .persistent()
            .set(&DataKey::LastBuybackTime, &now);

        // Reduce accumulated fees
        let remaining_fees = accumulated_fees - usdc_to_spend;
        env.storage()
            .persistent()
            .set(&DataKey::AccumulatedFees, &remaining_fees);

        // Emit buyback_executed event
        env.events().publish(
            (symbol_short!("buyback"), dex_contract),
            BuybackExecutedEvent {
                usdc_spent: usdc_to_spend,
                mnt_burned,
                price,
            },
        );

        Ok(())
    }

    /// Get total MNT burned
    pub fn get_total_burned(env: Env) -> Result<i128, Error> {
        env.storage()
            .persistent()
            .get(&DataKey::TotalBurned)
            .unwrap_or(Ok(0i128))
    }

    /// Set buyback percentage (0-50%), only admin can call
    pub fn set_buyback_percentage(env: Env, percentage: i128) -> Result<(), Error> {
        let admin: Address = env
            .storage()
            .persistent()
            .get(&DataKey::Admin)
            .ok_or(Error::NotInitialized)??;

        admin.require_auth();

        if percentage < 0 || percentage > 50 {
            return Err(Error::InvalidPercentage);
        }

        env.storage()
            .persistent()
            .set(&DataKey::BuybackPercentage, &percentage);
        Ok(())
    }

    /// Accumulate fees (called by other contracts collecting fees)
    pub fn add_fees(env: Env, amount: i128) -> Result<(), Error> {
        let mut accumulated: i128 = env
            .storage()
            .persistent()
            .get(&DataKey::AccumulatedFees)
            .unwrap_or(Ok(0i128))
            .unwrap_or(0i128);

        accumulated += amount;
        env.storage()
            .persistent()
            .set(&DataKey::AccumulatedFees, &accumulated);
        Ok(())
    }

    /// Get accumulated fees
    pub fn get_accumulated_fees(env: Env) -> Result<i128, Error> {
        env.storage()
            .persistent()
            .get(&DataKey::AccumulatedFees)
            .unwrap_or(Ok(0i128))
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use soroban_sdk::testutils::{Address as _, Ledger};

    #[test]
    fn test_buyback_execution() {
        let env = Env::default();
        let admin = Address::random(&env);
        let usdc_token = Address::random(&env);
        let mnt_token = Address::random(&env);
        let dex = Address::random(&env);

        assert!(TreasuryContract::init(env.clone(), admin.clone()).is_ok());
        assert!(TreasuryContract::add_fees(env.clone(), 1000).is_ok());

        env.ledger().set_timestamp(100);
        let result = TreasuryContract::trigger_buyback(
            env.clone(),
            usdc_token,
            mnt_token,
            dex,
            100, // price
        );
        assert!(result.is_ok());

        let burned = TreasuryContract::get_total_burned(env.clone()).unwrap();
        assert_eq!(burned, 200 / 100); // 200 USDC spent / 100 price = 2 MNT
    }

    #[test]
    fn test_cooldown_enforcement() {
        let env = Env::default();
        let admin = Address::random(&env);
        let usdc_token = Address::random(&env);
        let mnt_token = Address::random(&env);
        let dex = Address::random(&env);

        TreasuryContract::init(env.clone(), admin.clone()).unwrap();
        TreasuryContract::add_fees(env.clone(), 1000).unwrap();

        env.ledger().set_timestamp(100);
        TreasuryContract::trigger_buyback(env.clone(), usdc_token.clone(), mnt_token.clone(), dex.clone(), 100)
            .unwrap();

        // Try to trigger again within 7 days
        env.ledger().set_timestamp(200);
        let result = TreasuryContract::trigger_buyback(
            env.clone(),
            usdc_token,
            mnt_token,
            dex,
            100,
        );
        assert_eq!(result, Err(Error::CooldownNotMet));
    }

    #[test]
    fn test_burn_verification() {
        let env = Env::default();
        let admin = Address::random(&env);
        let usdc_token = Address::random(&env);
        let mnt_token = Address::random(&env);
        let dex = Address::random(&env);

        TreasuryContract::init(env.clone(), admin).unwrap();
        TreasuryContract::add_fees(env.clone(), 5000).unwrap();

        env.ledger().set_timestamp(100);
        TreasuryContract::trigger_buyback(env.clone(), usdc_token, mnt_token, dex, 50).unwrap();

        let burned = TreasuryContract::get_total_burned(env).unwrap();
        assert!(burned > 0);
        assert_eq!(burned, 1000 / 50); // 1000 USDC (20% of 5000) / 50 price
    }
}
