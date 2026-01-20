import { MongoClient, Db } from "mongodb";

if (!process.env.MONGO_URL) {
  throw new Error("Please add your Mongo URI to .env.local");
}

const uri = process.env.MONGO_URL;
const options = {};

let client: MongoClient;
let clientPromise: Promise<MongoClient>;

if (process.env.NODE_ENV === "development") {
  // In development mode, use a global variable so that the value
  // is preserved across module reloads caused by HMR (Hot Module Replacement).
  let globalWithMongo = global as typeof globalThis & {
    _mongoClientPromise?: Promise<MongoClient>;
  };

  if (!globalWithMongo._mongoClientPromise) {
    client = new MongoClient(uri, options);
    globalWithMongo._mongoClientPromise = client.connect();
  }
  clientPromise = globalWithMongo._mongoClientPromise;
} else {
  // In production mode, it's best to not use a global variable.
  client = new MongoClient(uri, options);
  clientPromise = client.connect();
}

export async function getDatabase(): Promise<Db> {
  const client = await clientPromise;
  return client.db();
}

export interface CampaignDocument {
  id: number; // campaign ID from contract
  merkle_root: string;
  reward_token: string;
  total_funded: string; // BigInt as string
  total_claimed: string; // BigInt as string
  is_funded: boolean;
  is_finalized: boolean;
  finalized_at?: Date;
  claim_deadline?: Date;
  created_at: Date;
}

export interface CampaignRewardEntryDocument {
  id?: number; // internal DB id (auto-generated)
  campaign_id: number;
  index_in_merkle: number;
  kol_address: string;
  reward_amount: string; // BigInt as string
  leaf_hash: string;
  merkle_proof: string[]; // array of hex strings
  claimed: boolean;
  claimed_tx_hash?: string;
  claimed_at?: Date;
  created_at: Date;
}
