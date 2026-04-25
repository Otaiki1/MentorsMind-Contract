import { 
  Keypair, 
  rpc, 
  TransactionBuilder, 
  Networks, 
  Contract, 
  nativeToScVal 
} from '@stellar/stellar-sdk';
import { randomUUID } from 'crypto';

export class AdminEscrowService {
  private contract: Contract;
  private server: rpc.Server;
  private adminKeypair: Keypair;

  constructor(contractId: string, rpcUrl: string, adminSecret: string) {
    this.contract = new Contract(contractId);
    this.server = new rpc.Server(rpcUrl);
    this.adminKeypair = Keypair.fromSecret(adminSecret);
  }

  async resolveDispute(escrowId: number, releaseToMentor: boolean): Promise<string> {
    const account = await this.server.getLatestLedger();
    const sourceAccount = await this.server.getAccount(this.adminKeypair.publicKey());

    const operation = this.contract.call(
      'resolve_dispute',
      nativeToScVal(escrowId, { type: 'u64' }),
      nativeToScVal(releaseToMentor, { type: 'bool' })
    );

    const transaction = new TransactionBuilder(sourceAccount, {
      fee: '1000',
      networkPassphrase: Networks.TESTNET, // Or configured network
    })
    .addOperation(operation)
    .build();

    transaction.sign(this.adminKeypair);
    
    const sendResponse = await this.server.sendTransaction(transaction);
    if (sendResponse.status !== 'PENDING') {
      throw new Error(`Failed to send transaction: ${sendResponse.status}`);
    }

    return sendResponse.hash;
  }

  async refund(escrowId: number): Promise<string> {
    // Similar implementation for refund
    const sourceAccount = await this.server.getAccount(this.adminKeypair.publicKey());
    const operation = this.contract.call('refund', nativeToScVal(escrowId, { type: 'u64' }));
    const transaction = new TransactionBuilder(sourceAccount, { fee: '1000', networkPassphrase: Networks.TESTNET })
      .addOperation(operation)
      .build();
    transaction.sign(this.adminKeypair);
    const res = await this.server.sendTransaction(transaction);
    return res.hash;
  }
}

export interface CreateEscrowInput {
  bookingId: string;
  learnerId: string;
  mentorId: string;
  amount: string;
  currency: string;
  escrowId?: string; // Optional: allow custom escrow ID for retry scenarios
}

export interface EscrowResult {
  escrowId: string;
  transactionHash: string;
  status: 'PENDING' | 'SUCCESS' | 'FAILED';
}

/**
 * SorobanEscrowService handles escrow contract interactions
 * Generates unique escrow IDs to prevent duplication issues on re-escrow
 */
export class SorobanEscrowService {
  private contract: Contract;
  private server: rpc.Server;
  private adminKeypair: Keypair;
  private networkPassphrase: string;

  constructor(contractId: string, rpcUrl: string, adminSecret: string, networkPassphrase?: string) {
    this.contract = new Contract(contractId);
    this.server = new rpc.Server(rpcUrl);
    this.adminKeypair = Keypair.fromSecret(adminSecret);
    this.networkPassphrase = networkPassphrase || Networks.TESTNET;
  }

  /**
   * Generates a unique escrow ID
   * Uses UUID by default, or combines bookingId with timestamp for traceability
   * @param bookingId The original booking reference
   * @param customId Optional custom ID for retry scenarios
   * @returns Unique escrow identifier
   */
  private generateEscrowId(bookingId: string, customId?: string): string {
    if (customId) {
      return customId;
    }
    // Format: {bookingId}-{uuid} to maintain traceability while ensuring uniqueness
    return `${bookingId}-${randomUUID()}`;
  }

  /**
   * Creates a new escrow with a unique identifier
   * @param input Escrow creation parameters
   * @returns Escrow result with unique ID and transaction hash
   */
  async createEscrow(input: CreateEscrowInput): Promise<EscrowResult> {
    // Generate unique escrow ID to prevent duplicate ID errors on re-escrow
    const escrowId = this.generateEscrowId(input.bookingId, input.escrowId);

    const sourceAccount = await this.server.getAccount(this.adminKeypair.publicKey());

    // Call Soroban contract with proper escrow ID as first argument
    const operation = this.contract.call(
      'create_escrow',
      nativeToScVal(escrowId, { type: 'string' }),
      nativeToScVal(input.learnerId, { type: 'string' }),
      nativeToScVal(input.mentorId, { type: 'string' }),
      nativeToScVal(input.amount, { type: 'i128' }),
      nativeToScVal(input.currency, { type: 'string' })
    );

    const transaction = new TransactionBuilder(sourceAccount, {
      fee: '10000',
      networkPassphrase: this.networkPassphrase,
    })
      .addOperation(operation)
      .setTimeout(300)
      .build();

    transaction.sign(this.adminKeypair);

    const sendResponse = await this.server.sendTransaction(transaction);
    
    if (sendResponse.status !== 'PENDING') {
      throw new Error(`Failed to create escrow: ${sendResponse.status}`);
    }

    // Wait for transaction completion
    const txResponse = await this.server.getTransaction(sendResponse.hash);
    
    // Check transaction status based on response type
    const status = 'status' in txResponse && txResponse.status === 'SUCCESS' 
      ? 'SUCCESS' 
      : 'FAILED';
    
    return {
      escrowId,
      transactionHash: sendResponse.hash,
      status,
    };
  }

  /**
   * Retrieves escrow details from the contract
   * @param escrowId Unique escrow identifier
   * @returns Escrow details
   */
  async getEscrowDetails(escrowId: string): Promise<any> {
    const sourceAccount = await this.server.getAccount(this.adminKeypair.publicKey());

    const operation = this.contract.call(
      'get_escrow',
      nativeToScVal(escrowId, { type: 'string' })
    );

    const transaction = new TransactionBuilder(sourceAccount, {
      fee: '100',
      networkPassphrase: this.networkPassphrase,
    })
      .addOperation(operation)
      .setTimeout(30)
      .build();

    // Simulate to get the result without submitting
    const simulation = await this.server.simulateTransaction(transaction);
    
    return simulation;
  }

  /**
   * Releases escrow funds to mentor
   * @param escrowId Unique escrow identifier
   * @returns Transaction hash
   */
  async releaseEscrow(escrowId: string): Promise<string> {
    const sourceAccount = await this.server.getAccount(this.adminKeypair.publicKey());

    const operation = this.contract.call(
      'release_escrow',
      nativeToScVal(escrowId, { type: 'string' })
    );

    const transaction = new TransactionBuilder(sourceAccount, {
      fee: '10000',
      networkPassphrase: this.networkPassphrase,
    })
      .addOperation(operation)
      .setTimeout(300)
      .build();

    transaction.sign(this.adminKeypair);

    const sendResponse = await this.server.sendTransaction(transaction);
    
    if (sendResponse.status !== 'PENDING') {
      throw new Error(`Failed to release escrow: ${sendResponse.status}`);
    }

    return sendResponse.hash;
  }

  /**
   * Cancels escrow and refunds to learner
   * @param escrowId Unique escrow identifier
   * @returns Transaction hash
   */
  async cancelEscrow(escrowId: string): Promise<string> {
    const sourceAccount = await this.server.getAccount(this.adminKeypair.publicKey());

    const operation = this.contract.call(
      'cancel_escrow',
      nativeToScVal(escrowId, { type: 'string' })
    );

    const transaction = new TransactionBuilder(sourceAccount, {
      fee: '10000',
      networkPassphrase: this.networkPassphrase,
    })
      .addOperation(operation)
      .setTimeout(300)
      .build();

    transaction.sign(this.adminKeypair);

    const sendResponse = await this.server.sendTransaction(transaction);
    
    if (sendResponse.status !== 'PENDING') {
      throw new Error(`Failed to cancel escrow: ${sendResponse.status}`);
    }

    return sendResponse.hash;
  }
}
