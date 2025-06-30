// Fixed version of deleteDelegatedTransaction function
import Safe from "@safe-global/protocol-kit";
import SafeApiKit from "@safe-global/api-kit";
import * as dotenv from "dotenv";
import { ethers } from "ethers";

dotenv.config();

const SAFE_ADDRESS = process.env.SAFE_ADDRESS as string;
const SAFE_API_KEY = process.env.SAFE_API_KEY as string;
const DELEGATE_PRIVATE_KEY = process.env.DELEGATE_PRIVATE_KEY as string;
const RPC_URL = process.env.RPC_URL as string;

export async function deleteDelegatedTransaction(
  safeTxHash: string,
  delegatePrivateKey: string,
  chainId: bigint
) {
  const delegateWallet = new ethers.Wallet(delegatePrivateKey);
  const delegateAddress = await delegateWallet.getAddress();

  console.log("Attempting to delete transaction:", safeTxHash);
  console.log("Using delegate address:", delegateAddress);

  const getTransactionServiceUrl = (chainId: bigint): string => {
    switch (chainId) {
      case 1n:
        return "https://safe-transaction-mainnet.safe.global";
      case 11155111n:
        return "https://safe-transaction-sepolia.safe.global";
      case 100n:
        return "https://safe-transaction-gnosis-chain.safe.global";
      case 137n:
        return "https://safe-transaction-polygon.safe.global";
      case 42161n:
        return "https://safe-transaction-arbitrum.safe.global";
      case 10n:
        return "https://safe-transaction-optimism.safe.global";
      case 8453n:
        return "https://safe-transaction-base.safe.global";
      default:
        throw new Error(`Unsupported chain ID: ${chainId}`);
    }
  };

  const baseUrl = getTransactionServiceUrl(chainId);
  const url = `${baseUrl}/api/v1/multisig-transactions/${safeTxHash}/`;

  const currentUnixTime = Math.floor(Date.now() / 1000);
  const totpTimestamp = Math.floor(currentUnixTime / 3600);

  // EIP-712 domain and message structure
  const domain = {
    name: "Safe Transaction Service",
    version: "1.0",
    chainId: Number(chainId), // Fixed: use the parameter chainId
    verifyingContract: SAFE_ADDRESS,
  };

  const types = {
    DeleteRequest: [
      { name: "safeTxHash", type: "bytes32" },
      { name: "totp", type: "uint256" },
    ],
  };

  const message = {
    safeTxHash,
    totp: totpTimestamp,
  };

  // Fixed: Use _signTypedData for proper EIP-712 signature
  const signature = await delegateWallet.signTypedData(domain, types, message);

  try {
    const response = await fetch(url, {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        signature: signature,
      }),
    });

    if (response.ok) {
      console.log("✅ Transaction deleted successfully!");
      return true;
    } else {
      const errorText = await response.text();
      console.error("❌ Deletion failed:", response.status, errorText);

      if (response.status === 400) {
        console.log("💡 The transaction might not be deletable because:");
        console.log("  - You're not the original proposer");
        console.log("  - The delegate is no longer valid");
        console.log("  - The transaction has already been signed by owners");
        console.log("  - TOTP timestamp might be incorrect");
      }

      throw new Error(`Delete failed: ${response.status} - ${errorText}`);
    }
  } catch (error) {
    console.error("❌ Error deleting transaction:", error);
    throw error;
  }
}

async function deleteMyWrongTransaction() {
  const CHAIN_ID = 100n; // Gnosis Chain
  const apiKit = new SafeApiKit({
    chainId: CHAIN_ID,
    apiKey: SAFE_API_KEY,
  });

  const safe = await Safe.init({
    provider: RPC_URL,
    signer: DELEGATE_PRIVATE_KEY,
    safeAddress: SAFE_ADDRESS,
  });

  const pendingTransactions = await apiKit.getPendingTransactions(SAFE_ADDRESS);

  try {
    const transactions = pendingTransactions.results.map((tx) => tx.safeTxHash);

    // Delete transactions one by one with a small delay
    for (const tx of transactions) {
      console.log(`Processing transaction: ${tx}`);
      await deleteDelegatedTransaction(tx, DELEGATE_PRIVATE_KEY, CHAIN_ID);

      // Small delay between deletions to avoid rate limiting
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
    console.log("✅ All wrong transactions deleted successfully!");
  } catch (error: any) {
    console.error("❌ Could not delete transaction:", error.message);

    if (error.message?.includes("not an owner or delegate")) {
      console.log("💡 Make sure:");
      console.log(
        "  1. You're using the same delegate key that proposed the transaction"
      );
      console.log("  2. The delegate is still registered for the Safe");
      console.log("  3. You are the original proposer of this transaction");
      console.log(
        "  4. The transaction hasn't been signed by other owners yet"
      );
    }
  }
}

// Additional helper function to check if delegate is still valid
async function checkDelegateStatus() {
  const CHAIN_ID = 100n;
  const apiKit = new SafeApiKit({
    chainId: CHAIN_ID,
    apiKey: SAFE_API_KEY,
  });

  const delegateWallet = new ethers.Wallet(DELEGATE_PRIVATE_KEY);
  const delegateAddress = await delegateWallet.getAddress();

  try {
    const delegates = await apiKit.getSafeDelegates({
      safeAddress: SAFE_ADDRESS,
    });

    const isValidDelegate = delegates.results.some(
      (delegate) =>
        delegate.delegate.toLowerCase() === delegateAddress.toLowerCase()
    );

    console.log("Delegate address:", delegateAddress);
    console.log("Is valid delegate:", isValidDelegate);

    return isValidDelegate;
  } catch (error) {
    console.error("Error checking delegate status:", error);
    return false;
  }
}

// Call the function
deleteMyWrongTransaction();
