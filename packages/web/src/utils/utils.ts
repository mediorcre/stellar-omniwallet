import { AccPublicKey, AccSignature } from "omniwallet-bindings";
import { xdr, Horizon } from "@stellar/stellar-sdk";
import { HORIZON_URL, NETWORK_PASSPHRASE, RPC_URL } from "./constants";
import { SACClient } from "passkey-kit";

const server = new Horizon.Server(HORIZON_URL);

export const sac = new SACClient({
  rpcUrl: RPC_URL,
  networkPassphrase: NETWORK_PASSPHRASE,
});
export const native = sac.getSACClient(
  "CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC"
);

export async function loadAccount(publicKey: string) {
  return await server.loadAccount(publicKey);
}

export function convertAccPublicKeyToXDR(accPublicKey: AccPublicKey) {
  if (!accPublicKey || typeof accPublicKey !== "object") {
    throw new Error("Invalid input: accPublicKey must be an object.");
  }

  if (accPublicKey.tag === "Stellar") {
    const accPublicKeyVal = accPublicKey.values[0];

    // Ensure the Stellar key is a 32-byte Buffer
    if (accPublicKeyVal.length !== 32) {
      throw new Error("Invalid Stellar public key length. Expected 32 bytes.");
    }

    return xdr.ScVal.scvVec([
      xdr.ScVal.scvSymbol("Stellar"), // Use scvSymbol to specify the variant
      xdr.ScVal.scvBytes(accPublicKeyVal),
    ]);
  } else if (accPublicKey.tag === "Ethereum") {
    const accPublicKeyVal = accPublicKey.values[0];

    // Ensure the Ethereum key is a 65-byte Buffer
    if (accPublicKeyVal.length !== 65) {
      throw new Error("Invalid Ethereum public key length. Expected 65 bytes.");
    }

    return xdr.ScVal.scvVec([
      xdr.ScVal.scvSymbol("Ethereum"), // Use scvSymbol to specify the variant
      xdr.ScVal.scvBytes(accPublicKeyVal),
    ]);
  } else if (accPublicKey.tag === "EthereumAddress") {
    const accPublicKeyVal = accPublicKey.values[0];

    // Ensure the Ethereum address is a 20-byte Buffer
    if (accPublicKeyVal.length !== 20) {
      throw new Error("Invalid Ethereum address length. Expected 20 bytes.");
    }

    return xdr.ScVal.scvVec([
      xdr.ScVal.scvSymbol("EthereumAddress"), // Use scvSymbol to specify the variant
      xdr.ScVal.scvBytes(accPublicKeyVal),
    ]);
  } else {
    throw new Error(
      "Invalid accPublicKey: must contain either Stellar or Ethereum key."
    );
  }
}

export function convertAccSignatureToXDR(accSignature: AccSignature) {
  if (!accSignature || typeof accSignature !== "object") {
    throw new Error("Invalid input: accSignature must be an object.");
  }

  if (accSignature.tag === "Stellar") {
    const signatureVal = accSignature.values[0];

    // Ensure the Stellar key is a 32-byte Buffer
    if (signatureVal.public_key.length !== 32) {
      throw new Error("Invalid Stellar public key length. Expected 32 bytes.");
    }

    if (signatureVal.signature.length !== 64) {
      throw new Error("Invalid Stellar signature length. Expected 64 bytes.");
    }

    const stellarSignature = xdr.ScVal.scvMap([
      new xdr.ScMapEntry({
        key: xdr.ScVal.scvSymbol("public_key"),
        val: xdr.ScVal.scvBytes(signatureVal.public_key),
      }),
      new xdr.ScMapEntry({
        key: xdr.ScVal.scvSymbol("signature"),
        val: xdr.ScVal.scvBytes(signatureVal.signature),
      }),
    ]);

    return xdr.ScVal.scvVec([
      xdr.ScVal.scvSymbol("Stellar"), // Use scvSymbol to specify the variant
      stellarSignature,
    ]);
  } else if (accSignature.tag === "Ethereum") {
    const signatureVal = accSignature.values[0];

    // Ensure the Ethereum key is a 65-byte Buffer
    if (signatureVal.public_key.length !== 65) {
      throw new Error("Invalid Ethereum public key length. Expected 65 bytes.");
    }

    if (signatureVal.signature.length !== 65) {
      throw new Error("Invalid Ethereum signature length. Expected 65 bytes.");
    }

    const ethereumSignature = xdr.ScVal.scvMap([
      new xdr.ScMapEntry({
        key: xdr.ScVal.scvSymbol("public_key"),
        val: xdr.ScVal.scvBytes(signatureVal.public_key),
      }),
      new xdr.ScMapEntry({
        key: xdr.ScVal.scvSymbol("signature"),
        val: xdr.ScVal.scvBytes(signatureVal.signature),
      }),
      new xdr.ScMapEntry({
        key: xdr.ScVal.scvSymbol("recovery_id"),
        val: xdr.ScVal.scvU32(signatureVal.recovery_id),
      }),
    ]);

    return xdr.ScVal.scvVec([
      xdr.ScVal.scvSymbol("Ethereum"), // Use scvSymbol to specify the variant
      ethereumSignature,
    ]);
  } else if (accSignature.tag === "EthereumAddress") {
    const signatureVal = accSignature.values[0];

    // Ensure the Ethereum key is a 20-byte Buffer
    if (signatureVal.address.length !== 20) {
      throw new Error("Invalid Ethereum Address length. Expected 20 bytes.");
    }

    if (signatureVal.signature.length !== 65) {
      throw new Error("Invalid Ethereum signature length. Expected 65 bytes.");
    }

    const ethereumSignature = xdr.ScVal.scvMap([
      new xdr.ScMapEntry({
        key: xdr.ScVal.scvSymbol("address"),
        val: xdr.ScVal.scvBytes(signatureVal.address),
      }),
      new xdr.ScMapEntry({
        key: xdr.ScVal.scvSymbol("signature"),
        val: xdr.ScVal.scvBytes(signatureVal.signature),
      }),
      new xdr.ScMapEntry({
        key: xdr.ScVal.scvSymbol("recovery_id"),
        val: xdr.ScVal.scvU32(signatureVal.recovery_id),
      }),
    ]);

    return xdr.ScVal.scvVec([
      xdr.ScVal.scvSymbol("EthereumAddress"), // Use scvSymbol to specify the variant
      ethereumSignature,
    ]);
  } else {
    throw new Error(
      "Invalid accPublicKey: must contain either Stellar or Ethereum key."
    );
  }
}

export async function fetchAccountBalance(accountPublicKey: string) {
  try {
    // Load account information from the Stellar server
    const account: Horizon.AccountResponse = await server.loadAccount(
      accountPublicKey
    );

    return account.balances;
  } catch (error) {
    console.error("Error fetching account balance:", error);
  }
}

export async function fetchSmartWalletBalance(contractId: string) {
  // Fetch account information
  const { result } = await native.balance({ id: contractId });
  return result.toString();
}

// Convert XLM to Stroops
export function xlmToStroops(xlmAmount: number | string): number {
  try {
    // Convert string input to number if needed
    const amount: number =
      typeof xlmAmount === "string" ? parseFloat(xlmAmount) : xlmAmount;

    // Validate the amount
    if (isNaN(amount) || amount < 0) {
      throw new Error("Invalid XLM amount");
    }

    // Convert to Stroops
    const stroopsAmount: number = Math.round(amount * 1e7); // 1 XLM = 10^7 Stroops
    return stroopsAmount;
  } catch (error) {
    console.error("Error converting XLM to Stroops:", error);
    throw error; // Re-throw the error to handle it outside the function
  }
}

// Convert Stroops to XLM
export function stroopsToXlm(stroopsAmount: number | string): number {
  try {
    // Convert string input to number if needed
    const amount: number =
      typeof stroopsAmount === "string"
        ? parseInt(stroopsAmount, 10)
        : stroopsAmount;

    // Validate the amount
    if (isNaN(amount) || amount < 0) {
      throw new Error("Invalid Stroops amount");
    }

    // Convert to XLM
    const xlmAmount: number = amount / 1e7; // 1 XLM = 10^7 Stroops
    return xlmAmount;
  } catch (error) {
    console.error("Error converting Stroops to XLM:", error);
    throw error; // Re-throw the error to handle it outside the function
  }
}

export function convertRecoveryId(recoveryId: number): number {
  if (recoveryId === 27 || recoveryId === 28) {
    return recoveryId - 27;
  } else {
    throw new Error("Invalid recovery ID. Must be 27 or 28.");
  }
}
