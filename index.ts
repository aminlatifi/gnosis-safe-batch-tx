import SafeApiKit from "@safe-global/api-kit";
import Safe from "@safe-global/protocol-kit";
import { MetaTransactionData, OperationType } from "@safe-global/types-kit";
import { ethers } from "ethers";
import { DuneClient } from "@duneanalytics/client-sdk";
import * as dotenv from "dotenv";

dotenv.config();

/**
 * Environment variables read from the .env file
 */
const OWNER_1_PRIVATE_KEY = process.env.OWNER_1_PRIVATE_KEY as string;
const OWNER_1_ADDRESS = process.env.OWNER_1_ADDRESS as string;
const SAFE_ADDRESS = process.env.SAFE_ADDRESS as string;
const RPC_URL = process.env.RPC_URL as string;
const DUNE_API_KEY = process.env.DUNE_API_KEY as string;

// The Gnosis chain (xDAI) has a chain ID of 100
const CHAIN_ID = BigInt(100);

// Contract address
const TOKEN_DISTRO_CONTRACT = "0xc0dbDcA66a0636236fAbe1B3C16B1bD4C84bB1E1";

// Query ID from Dune Analytics
const DUNE_QUERY_ID = 3799716;

async function fetchDuneData(duneClient: DuneClient, limit: number, offset: number) {
  const queryResult = await duneClient.getLatestResult({ queryId: DUNE_QUERY_ID });
  if (!queryResult.result || !queryResult.result.rows) {
    throw new Error("No data returned from Dune query.");
  }

  // Get rows in the specified range
  const rows = queryResult.result.rows.slice(offset, offset + limit);
  return rows;
}

async function createAndProposeSafeTransaction(
  protocolKitOwner1: Safe,
  apiKit: SafeApiKit,
  transactions: MetaTransactionData[]
) {
  // Create a transaction batch for the chunk
  const safeTransaction = await protocolKitOwner1.createTransaction({
    transactions,
  });

  // Calculate the Safe transaction hash
  const safeTxHash = await protocolKitOwner1.getTransactionHash(safeTransaction);

  // Sign the transaction hash
  const signature = await protocolKitOwner1.signHash(safeTxHash);

  // Propose the transaction to the Safe Transaction Service
  await apiKit.proposeTransaction({
    safeAddress: SAFE_ADDRESS,
    safeTransactionData: safeTransaction.data,
    safeTxHash,
    senderAddress: OWNER_1_ADDRESS,
    senderSignature: signature.data,
  });

  console.log(`\nProposed Safe transaction for chunk. SafeTxHash: ${safeTxHash}`);
}

async function main() {
  // Initialize a provider and signer using ethers
  const provider = new ethers.JsonRpcProvider(RPC_URL);
  const owner1Signer = new ethers.Wallet(OWNER_1_PRIVATE_KEY, provider);

  // Initialize SafeApiKit with proper configuration
  const apiKit = new SafeApiKit({
    chainId: CHAIN_ID,
  });

  // Initialize the Protocol Kit
  const protocolKitOwner1 = await Safe.init({
    provider: RPC_URL,
    signer: OWNER_1_PRIVATE_KEY,
    safeAddress: SAFE_ADDRESS,
  });

  // The contract ABI for "transferAllocation(address prevRecipient, address newRecipient)"
  const abi = ["function transferAllocation(address prevRecipient, address newRecipient)"];
  const iface = new ethers.Interface(abi);

  // Initialize the Dune client
  const duneClient = new DuneClient(DUNE_API_KEY);

  let offset = 0;
  const limit = 1000;

  while (true) {
    console.log(`Fetching rows from offset ${offset} with limit ${limit}...`);
    const rows = await fetchDuneData(duneClient, limit, offset);
    if (rows.length === 0) break; // Exit when no more rows are available

    console.log(`Fetched ${rows.length} rows from Dune.`);

    // Map rows into transactions for this chunk
    const transactions: MetaTransactionData[] = rows.map((row: any) => {
      const prevRecipient = row.grantee;

      // Encode the call data
      const data = iface.encodeFunctionData("transferAllocation", [
        prevRecipient,
        TOKEN_DISTRO_CONTRACT,
      ]);

      // Construct the Safe transaction
      return {
        to: TOKEN_DISTRO_CONTRACT,
        value: "0",
        data,
        operation: OperationType.Call,
      };
    });

    // Create and propose a Safe transaction for the current chunk
    await createAndProposeSafeTransaction(protocolKitOwner1, apiKit, transactions);

    // Increment offset for the next batch
    offset += limit;
  }

  console.log("All chunks processed and proposed as separate transactions.");
}

main().catch((err) => {
  console.error("Error:", err);
  process.exit(1);
});
