import { Networks } from '@stellar/stellar-sdk';

export interface StellarConfig {
  network: string;
  horizonUrl: string;
  sorobanRpcUrl: string;
  networkPassphrase: string;
}

const network = import.meta.env.VITE_STELLAR_NETWORK || 'testnet';

export const stellarConfig: StellarConfig = {
  network,
  horizonUrl: import.meta.env.VITE_HORIZON_URL || 'https://horizon-testnet.stellar.org',
  sorobanRpcUrl: import.meta.env.VITE_SOROBAN_RPC_URL || 'https://soroban-testnet.stellar.org:443',
  networkPassphrase: network === 'mainnet' ? Networks.PUBLIC : Networks.TESTNET,
};
