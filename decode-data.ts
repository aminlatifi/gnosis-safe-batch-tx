import { ethers } from 'ethers';

// Example data to decode
const data =
  '0x397f612100000000000000000000000030e384a67b5ede03c203071d8858f3611a232ef5000000000000000000000000c0dbdca66a0636236fabe1b3c16b1bd4c84bb1e1';

// Contract ABI (you need the correct ABI here)
const abi = [
  'function transferAllocation(address prevRecipient, address newRecipient)',
];

async function decodeTransaction() {
  // Create an ethers Interface
  const iface = new ethers.Interface(abi);

  // Decode the function data
  const decodedData = iface.parseTransaction({ data });

  console.log('Decoded function and arguments:', decodedData);
}

decodeTransaction();
