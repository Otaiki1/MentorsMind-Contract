#![no_std]

use soroban_sdk::{
    contract, contracterror, contractimpl, contracttype, symbol_short, Address, Env, Map,
};

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum Error {
    NotInitialized = 1,
    Unauthorized = 2,
    InsufficientBalance = 3,
    NoRewards = 4,
    InvalidAmount = 5,
    ZeroTotalStaked = 6,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct RewardsDistributedEvent {
    pub token: Address,
    pub total_amount: i128,
    pub total_staked: i128,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct RewardsClaimedEvent {
    pub staker: Address,
    pub token: Address,
    pub amount: i128,
}

#[contracttype]
#[derive(Clone)]
pub enum DataKey {
    Admin,
    Stakes,
    TotalStaked,
    PendingRewards,
}

#[contract]
pub struct StakingContract;

#[contractimpl]
impl StakingContract {
    /// Initialize staking contract with admin
    pub fn init(env: Env, admin: Address) -> Result<(), Error> {
        if env.storage().persistent().has(&DataKey::Admin) {
            return Err(Error::Unauthorized);
        }
        env.storage().persistent().set(&DataKey::Admin, &admin);
        env.storage().persistent().set(&DataKey::TotalStaked, &0i128);

        // Initialize empty maps
        let empty_stakes: Map<Address, i128> = Map::new(&env);
        let empty_rewards: Map<(Address, Address), i128> = Map::new(&env);

        env.storage().persistent().set(&DataKey::Stakes, &empty_stakes);
        env.storage()
            .persistent()
            .set(&DataKey::PendingRewards, &empty_rewards);

        Ok(())
    }

    /// Stake MNT tokens
    pub fn stake(env: Env, staker: Address, amount: i128) -> Result<(), Error> {
        if !env.storage().persistent().has(&DataKey::Admin) {
            return Err(Error::NotInitialized);
        }

        if amount <= 0 {
            return Err(Error::InvalidAmount);
        }

        let mut stakes: Map<Address, i128> = env
            .storage()
            .persistent()
            .get(&DataKey::Stakes)
            .unwrap_or(Ok(Map::new(&env)))
            .unwrap_or_else(|_| Map::new(&env));

        let current_stake = stakes.get(staker.clone()).unwrap_or(Ok(0i128)).unwrap_or(0i128);
        stakes.set(staker.clone(), current_stake + amount);

        let mut total_staked: i128 = env
            .storage()
            .persistent()
            .get(&DataKey::TotalStaked)
            .unwrap_or(Ok(0i128))
            .unwrap_or(0i128);
        total_staked += amount;

        env.storage().persistent().set(&DataKey::Stakes, &stakes);
        env.storage()
            .persistent()
            .set(&DataKey::TotalStaked, &total_staked);

        Ok(())
    }

    /// Unstake MNT tokens
    pub fn unstake(env: Env, staker: Address, amount: i128) -> Result<(), Error> {
        if !env.storage().persistent().has(&DataKey::Admin) {
            return Err(Error::NotInitialized);
        }

        if amount <= 0 {
            return Err(Error::InvalidAmount);
        }

        let mut stakes: Map<Address, i128> = env
            .storage()
            .persistent()
            .get(&DataKey::Stakes)
            .unwrap_or(Ok(Map::new(&env)))
            .unwrap_or_else(|_| Map::new(&env));

        let current_stake = stakes.get(staker.clone()).unwrap_or(Ok(0i128)).unwrap_or(0i128);

        if current_stake < amount {
            return Err(Error::InsufficientBalance);
        }

        stakes.set(staker.clone(), current_stake - amount);

        let mut total_staked: i128 = env
            .storage()
            .persistent()
            .get(&DataKey::TotalStaked)
            .unwrap_or(Ok(0i128))
            .unwrap_or(0i128);
        total_staked -= amount;

        env.storage().persistent().set(&DataKey::Stakes, &stakes);
        env.storage()
            .persistent()
            .set(&DataKey::TotalStaked, &total_staked);

        Ok(())
    }

    /// Distribute revenue to stakers (30% of fee revenue)
    pub fn distribute_revenue(
        env: Env,
        token: Address,
        amount: i128,
    ) -> Result<(), Error> {
        if !env.storage().persistent().has(&DataKey::Admin) {
            return Err(Error::NotInitialized);
        }

        if amount <= 0 {
            return Err(Error::InvalidAmount);
        }

        let total_staked: i128 = env
            .storage()
            .persistent()
            .get(&DataKey::TotalStaked)
            .unwrap_or(Ok(0i128))
            .unwrap_or(0i128);

        if total_staked == 0 {
            return Err(Error::ZeroTotalStaked);
        }

        let stakes: Map<Address, i128> = env
            .storage()
            .persistent()
            .get(&DataKey::Stakes)
            .unwrap_or(Ok(Map::new(&env)))
            .unwrap_or_else(|_| Map::new(&env));

        let mut pending_rewards: Map<(Address, Address), i128> = env
            .storage()
            .persistent()
            .get(&DataKey::PendingRewards)
            .unwrap_or(Ok(Map::new(&env)))
            .unwrap_or_else(|_| Map::new(&env));

        // Iterate through all stakers and distribute rewards pro-rata
        for entry in stakes.iter() {
            let staker = entry.0;
            let staker_stake = entry.1;

            // Calculate staker's share: amount * staker_stake / total_staked
            let reward = if staker_stake > 0 {
                (amount * staker_stake) / total_staked
            } else {
                0
            };

            if reward > 0 {
                let key = (staker.clone(), token.clone());
                let current_pending = pending_rewards
                    .get(key.clone())
                    .unwrap_or(Ok(0i128))
                    .unwrap_or(0i128);
                pending_rewards.set(key, current_pending + reward);
            }
        }

        env.storage()
            .persistent()
            .set(&DataKey::PendingRewards, &pending_rewards);

        // Emit rewards_distributed event
        env.events().publish(
            (symbol_short!("reward"), token.clone()),
            RewardsDistributedEvent {
                token,
                total_amount: amount,
                total_staked,
            },
        );

        Ok(())
    }

    /// Get pending rewards for a staker
    pub fn get_pending_rewards(env: Env, staker: Address, token: Address) -> Result<i128, Error> {
        let pending_rewards: Map<(Address, Address), i128> = env
            .storage()
            .persistent()
            .get(&DataKey::PendingRewards)
            .unwrap_or(Ok(Map::new(&env)))
            .unwrap_or_else(|_| Map::new(&env));

        let key = (staker, token);
        Ok(pending_rewards
            .get(key)
            .unwrap_or(Ok(0i128))
            .unwrap_or(0i128))
    }

    /// Claim rewards (transfers pending rewards to staker)
    pub fn claim_rewards(env: Env, staker: Address, token: Address) -> Result<i128, Error> {
        if !env.storage().persistent().has(&DataKey::Admin) {
            return Err(Error::NotInitialized);
        }

        let mut pending_rewards: Map<(Address, Address), i128> = env
            .storage()
            .persistent()
            .get(&DataKey::PendingRewards)
            .unwrap_or(Ok(Map::new(&env)))
            .unwrap_or_else(|_| Map::new(&env));

        let key = (staker.clone(), token.clone());
        let amount = pending_rewards
            .get(key.clone())
            .unwrap_or(Ok(0i128))
            .unwrap_or(0i128);

        if amount == 0 {
            return Err(Error::NoRewards);
        }

        // Clear pending reward
        pending_rewards.set(key, 0i128);

        env.storage()
            .persistent()
            .set(&DataKey::PendingRewards, &pending_rewards);

        // Emit rewards_claimed event
        env.events().publish(
            (symbol_short!("claimed"), token.clone()),
            RewardsClaimedEvent {
                staker,
                token,
                amount,
            },
        );

        Ok(amount)
    }

    /// Get staker's current stake
    pub fn get_stake(env: Env, staker: Address) -> Result<i128, Error> {
        let stakes: Map<Address, i128> = env
            .storage()
            .persistent()
            .get(&DataKey::Stakes)
            .unwrap_or(Ok(Map::new(&env)))
            .unwrap_or_else(|_| Map::new(&env));

        Ok(stakes
            .get(staker)
            .unwrap_or(Ok(0i128))
            .unwrap_or(0i128))
    }

    /// Get total staked amount
    pub fn get_total_staked(env: Env) -> Result<i128, Error> {
        env.storage()
            .persistent()
            .get(&DataKey::TotalStaked)
            .unwrap_or(Ok(0i128))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_pro_rata_distribution() {
        let env = Env::default();
        let admin = Address::random(&env);
        let staker1 = Address::random(&env);
        let staker2 = Address::random(&env);
        let staker3 = Address::random(&env);
        let token = Address::random(&env);

        // Initialize
        assert!(StakingContract::init(env.clone(), admin.clone()).is_ok());

        // Three stakers with different amounts
        assert!(StakingContract::stake(env.clone(), staker1.clone(), 1000).is_ok());
        assert!(StakingContract::stake(env.clone(), staker2.clone(), 2000).is_ok());
        assert!(StakingContract::stake(env.clone(), staker3.clone(), 3000).is_ok());

        // Distribute 600 tokens (30% of 2000 fees simulated)
        assert!(StakingContract::distribute_revenue(env.clone(), token.clone(), 600).is_ok());

        // Check pro-rata distribution
        let rewards1 = StakingContract::get_pending_rewards(env.clone(), staker1.clone(), token.clone())
            .unwrap();
        let rewards2 = StakingContract::get_pending_rewards(env.clone(), staker2.clone(), token.clone())
            .unwrap();
        let rewards3 = StakingContract::get_pending_rewards(env.clone(), staker3, token.clone())
            .unwrap();

        // Total is 6000, so:
        // Staker1: 600 * 1000 / 6000 = 100
        // Staker2: 600 * 2000 / 6000 = 200
        // Staker3: 600 * 3000 / 6000 = 300
        assert_eq!(rewards1, 100);
        assert_eq!(rewards2, 200);
        assert_eq!(rewards3, 300);
    }

    #[test]
    fn test_claim_rewards() {
        let env = Env::default();
        let admin = Address::random(&env);
        let staker = Address::random(&env);
        let token = Address::random(&env);

        StakingContract::init(env.clone(), admin).unwrap();
        StakingContract::stake(env.clone(), staker.clone(), 1000).unwrap();
        StakingContract::distribute_revenue(env.clone(), token.clone(), 100).unwrap();

        let pending = StakingContract::get_pending_rewards(env.clone(), staker.clone(), token.clone())
            .unwrap();
        assert_eq!(pending, 100);

        let claimed = StakingContract::claim_rewards(env.clone(), staker.clone(), token.clone()).unwrap();
        assert_eq!(claimed, 100);

        let remaining = StakingContract::get_pending_rewards(env, staker, token).unwrap();
        assert_eq!(remaining, 0);
    }

    #[test]
    fn test_correct_distribution() {
        let env = Env::default();
        let admin = Address::random(&env);
        let staker1 = Address::random(&env);
        let staker2 = Address::random(&env);
        let usdc_token = Address::random(&env);
        let xlm_token = Address::random(&env);

        StakingContract::init(env.clone(), admin).unwrap();
        StakingContract::stake(env.clone(), staker1.clone(), 500).unwrap();
        StakingContract::stake(env.clone(), staker2.clone(), 500).unwrap();

        // Distribute USDC
        StakingContract::distribute_revenue(env.clone(), usdc_token.clone(), 1000).unwrap();

        // Distribute XLM
        StakingContract::distribute_revenue(env.clone(), xlm_token.clone(), 2000).unwrap();

        let usdc_rewards1 = StakingContract::get_pending_rewards(env.clone(), staker1.clone(), usdc_token)
            .unwrap();
        let xlm_rewards1 = StakingContract::get_pending_rewards(env.clone(), staker1.clone(), xlm_token)
            .unwrap();
        let usdc_rewards2 = StakingContract::get_pending_rewards(env.clone(), staker2.clone(), usdc_token)
            .unwrap();
        let xlm_rewards2 = StakingContract::get_pending_rewards(env, staker2, xlm_token).unwrap();

        // Each staker gets 50% of rewards
        assert_eq!(usdc_rewards1, 500);
        assert_eq!(usdc_rewards2, 500);
        assert_eq!(xlm_rewards1, 1000);
        assert_eq!(xlm_rewards2, 1000);
    }
}
