/**
 * Example: Streaming and Persisting Aptos Transactions with SQLite
 *
 * This example shows how to stream Aptos blockchain transactions while maintaining
 * persistence using SQLite. This is useful for indexers, analytics tools, or any
 * application that needs to process transactions and resume from where it left off.
 *
 * Key features:
 * - Uses SQLite to store the last processed transaction version
 * - Automatically resumes from the last processed version after restarts
 * - Handles transaction data in batches for efficiency
 * - Uses WAL (Write-Ahead Logging) for better concurrent performance
 *
 * How it works:
 * 1. Creates a SQLite table to store the last processed version
 * 2. Retrieves the last version or starts from 0 if first run
 * 3. Streams transactions from that version
 * 4. Updates the stored version after processing each batch
 *
 * Requirements:
 * - An Aptos API key (get one from https://aptoslabs.com/developers)
 * - Set the API key in environment variable APTOS_API_KEY_TESTNET
 * - Bun runtime (for bun:sqlite)
 */

import { Database } from "bun:sqlite";
import { streamTransactions } from "..";

async function* streamAndPersistTransactions({
  db,
  ...opts
}: Omit<Parameters<typeof streamTransactions>[number], "startingVersion"> & {
  db: Database;
}) {
  db.exec(`create table if not exists kv(k primary key, v)`);

  const { v: startingVersion } = db
    .query<{ v: string | number | bigint }, []>(
      `select v from kv where k = 'startingVersion'`
    )
    .get() ?? { v: 0n };

  for await (const event of streamTransactions({
    ...opts,
    startingVersion: BigInt(startingVersion),
  })) {
    yield event;

    if (event.type === "data") {
      const nextStartingVersion =
        event.transactions[event.transactions.length - 1].version! + 1n;

      db.query(
        `insert into kv(k, v) values('startingVersion', ?) on conflict(k) do update set v = excluded.v`
      ).run(nextStartingVersion);
    }
  }
}

const db = new Database("indexer.db", {
  create: true,
  readwrite: true,
  safeIntegers: true,
  strict: true,
});

db.exec(`pragma journal_mode = WAL`);

for await (const event of streamAndPersistTransactions({
  db,
  url: "grpc.testnet.aptoslabs.com:443",
  apiKey: process.env.APTOS_API_KEY_TESTNET!,
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
