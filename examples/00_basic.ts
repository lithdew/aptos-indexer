/**
 * Example: Streaming Aptos Blockchain Transactions
 *
 * This example demonstrates how to stream transactions from the Aptos blockchain in real-time.
 * Aptos is a Layer 1 blockchain that processes transactions containing smart contract interactions,
 * token transfers, and other on-chain activities.
 *
 * Key concepts:
 * - Transactions are streamed sequentially starting from version 0
 * - Each transaction has a unique version number (like a block number in other chains)
 * - The stream provides different event types:
 *   - "data": Contains batches of transactions
 *   - "error": Any errors that occur during streaming
 *   - "metadata": Information about the stream
 *   - "status": Stream status updates
 *
 * Requirements:
 * - An Aptos API key (get one from https://aptoslabs.com/developers)
 * - Set the API key in environment variable APTOS_API_KEY_TESTNET
 */

import { streamTransactions } from "..";

for await (const event of streamTransactions({
  url: "grpc.testnet.aptoslabs.com:443",
  apiKey: process.env.APTOS_API_KEY_TESTNET!,
  startingVersion: 0n,
})) {
  switch (event.type) {
    case "data": {
      if (event.chainId !== 2n) {
        throw new Error(
          `Transaction stream returned a chainId of ${event.chainId}, but expected testnet chainId=2`
        );
      }

      const startVersion = event.transactions[0].version!;
      const endVersion =
        event.transactions[event.transactions.length - 1].version!;

      console.debug(
        `Got ${event.transactions.length} transaction(s) from version ${startVersion} to ${endVersion}.`
      );
      break;
    }
    case "error": {
      console.error(event.error);
      break;
    }
    case "metadata": {
      console.log(event.metadata);
      break;
    }
    case "status": {
      console.log(event.status);
      break;
    }
  }
}
