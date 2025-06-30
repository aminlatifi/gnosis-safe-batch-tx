import SafeApiKit from "@safe-global/api-kit/dist/src";
import Safe from "@safe-global/protocol-kit";
import { MetaTransactionData } from "@safe-global/types-kit";
import { ethers } from "ethers";
import * as dotenv from "dotenv";

dotenv.config();

const RPC_URL = process.env.RPC_URL as string;
const DELEGATE_PRIVATE_KEY = process.env.DELEGATE_PRIVATE_KEY as string;
const SAFE_ADDRESS = process.env.SAFE_ADDRESS as string;

export async function createAndProposeSafeTransaction(
  safe: Safe,
  apiKit: SafeApiKit,
  transactions: MetaTransactionData[]
) {
  const provider = new ethers.JsonRpcProvider(RPC_URL);
  const delegateWallet = new ethers.Wallet(DELEGATE_PRIVATE_KEY, provider);
  const delegateAddress = await delegateWallet.getAddress();
  console.log("delegateAddress: ", delegateAddress);

  // Create a transaction batch for the chunk
  const nonce = await apiKit.getNextNonce(SAFE_ADDRESS);
  const safeTransaction = await safe.createTransaction({
    transactions,
    options: {
      nonce: +nonce,
    },
  });

  // Calculate the Safe transaction hash
  const safeTxHash = await safe.getTransactionHash(safeTransaction);

  // Instead of signing with Safe owner, sign with delegate
  // const messageArray = ethers.getBytes(safeTxHash);
  const delegateSignature = await safe.signHash(safeTxHash);

  // Propose transaction through API Kit (this is the key difference)
  await apiKit.proposeTransaction({
    safeAddress: SAFE_ADDRESS,
    safeTransactionData: safeTransaction.data,
    safeTxHash: safeTxHash,
    senderAddress: delegateSignature.signer, // Delegate address
    senderSignature: delegateSignature.data, // Delegate signature
    origin: "GIVback claim",
  });

  console.log(`Proposed Safe transaction for chunk. SafeTxHash: ${safeTxHash}`);
}
