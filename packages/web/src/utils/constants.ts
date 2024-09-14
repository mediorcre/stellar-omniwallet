import { Keypair } from "@stellar/stellar-sdk";
import invariant from "invariant";
import { SACClient } from "passkey-kit";

invariant(import.meta.env.VITE_APP_RPC_URL, "RPC_URL is required");
invariant(
  import.meta.env.VITE_APP_NETWORK_PASSPHRASE,
  "NETWORK_PASSPHRASE is required"
);
invariant(import.meta.env.VITE_APP_CONTRACT_ID, "CONTRACT_ID is required");
invariant(import.meta.env.VITE_APP_HORIZON_URL, "HORIZON_URL is required");

export const RPC_URL = import.meta.env.VITE_APP_RPC_URL as string;
export const NETWORK_PASSPHRASE = import.meta.env
  .VITE_APP_NETWORK_PASSPHRASE as string;
export const CONTRACT_ID = import.meta.env.VITE_APP_CONTRACT_ID as string;
export const HORIZON_URL = import.meta.env.VITE_APP_HORIZON_URL as string;
export const BUNDLER_PRIVATE_KEY = import.meta.env
  .VITE_APP_BUNDLER_PRIVATE_KEY as string;
export const LAUNCHTUBE_URL = import.meta.env.VITE_APP_LAUNCHTUBE_URL as string;
export const LAUNCHTUBE_JWT = import.meta.env.VITE_APP_LAUNCHTUBE_JWT as string;

export const bundlerAccount = Keypair.fromSecret(BUNDLER_PRIVATE_KEY);

console.log("Bundler", bundlerAccount.publicKey());

export const sac = new SACClient({
  rpcUrl: RPC_URL,
  networkPassphrase: NETWORK_PASSPHRASE,
});

export const native = sac.getSACClient(
  "CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC"
);
