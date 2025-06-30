import Safe from "@safe-global/protocol-kit";
import SafeApiKit from "@safe-global/api-kit";
import { MetaTransactionData, OperationType } from "@safe-global/types-kit";
import { ethers } from "ethers";
import { DuneClient, ParameterType } from "@duneanalytics/client-sdk";
import * as dotenv from "dotenv";
import { fetchDuneData } from "./helper/dune";
import { createAndProposeSafeTransaction } from "./helper/safe";

dotenv.config();

/**
 * Environment variables read from the .env file
 */
const SAFE_ADDRESS = process.env.SAFE_ADDRESS as string;
const SAFE_API_KEY = process.env.SAFE_API_KEY as string;
const DELEGATE_PRIVATE_KEY = process.env.DELEGATE_PRIVATE_KEY as string;
const RPC_URL = process.env.RPC_URL as string;
const DUNE_API_KEY = process.env.DUNE_API_KEY as string;
const RECIPIENT_ADDRESS = process.env.RECIPIENT_ADDRESS as string;

// The Gnosis chain (xDAI) has a chain ID of 100
const CHAIN_ID = BigInt(100);

// Contract address
const TOKEN_DISTRO_CONTRACT = "0xc0dbDcA66a0636236fAbe1B3C16B1bD4C84bB1E1";

// Query ID from Dune Analytics
async function main() {
  // Initialize a provider and signer using ethers
  // const provider = new ethers.JsonRpcProvider(RPC_URL);
  // const owner1Signer = new ethers.Wallet(OWNER_1_PRIVATE_KEY, provider);

  // Initialize SafeApiKit with proper configuration
  const apiKit = new SafeApiKit({
    chainId: CHAIN_ID,
    apiKey: SAFE_API_KEY,
  });

  // Initialize the Protocol Kit
  const safe = await Safe.init({
    provider: RPC_URL,
    signer: DELEGATE_PRIVATE_KEY,
    safeAddress: SAFE_ADDRESS,
  });

  // The contract ABI for "transferAllocation(address prevRecipient, address newRecipient)"
  const abi = [
    "function transferAllocation(address prevRecipient, address newRecipient)",
  ];
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
        RECIPIENT_ADDRESS,
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
    await createAndProposeSafeTransaction(safe, apiKit, transactions);

    // Increment offset for the next batch
    offset += rows.length;

    if (rows.length < limit) {
      break;
    }
  }

  console.log("All chunks processed and proposed as separate transactions.");
}

main().catch((err) => {
  console.error("Error:", err);
  process.exit(1);
});
