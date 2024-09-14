import {
  Address,
  hash,
  Operation,
  SorobanRpc,
  Transaction,
  TransactionBuilder,
  xdr,
  Horizon,
  BASE_FEE,
} from "@stellar/stellar-sdk";
import { DEFAULT_TIMEOUT } from "@stellar/stellar-sdk/contract";
import { keccak256 } from "viem";
import {
  CONTRACT_ID,
  HORIZON_URL,
  LAUNCHTUBE_JWT,
  LAUNCHTUBE_URL,
} from "./constants";
import { EthereumAddressSignature } from "omniwallet-bindings";

export class EthereumKit {
  public declare rpc: SorobanRpc.Server;
  public declare rpcUrl: string;
  public declare server: Horizon.Server;
  public keyId: string | undefined;
  public networkPassphrase: string;
  private ethereumSign?: (data: Buffer) => Promise<EthereumAddressSignature>;
  public contractId: string = CONTRACT_ID;

  constructor(options: {
    rpcUrl: string;
    networkPassphrase: string;
    ethereumSign?: (data: Buffer) => Promise<EthereumAddressSignature>;
  }) {
    this.rpcUrl = options.rpcUrl;
    this.networkPassphrase = options.networkPassphrase;
    this.rpc = new SorobanRpc.Server(this.rpcUrl);
    this.server = new Horizon.Server(HORIZON_URL);

    this.ethereumSign = options.ethereumSign;
  }

  public async setEthereumSignFunction(
    ethereumSign: (data: Buffer) => Promise<EthereumAddressSignature>
  ) {
    this.ethereumSign = ethereumSign;
  }

  public async signAuthEntry(
    entry: xdr.SorobanAuthorizationEntry,
    options?: {
      ledgersToLive?: number;
    }
  ) {
    if (!this.ethereumSign) throw new Error("Ethereum sign function not set");

    const { ledgersToLive = DEFAULT_TIMEOUT } = options || {};

    const lastLedger = await this.rpc
      .getLatestLedger()
      .then(({ sequence }) => sequence);

    const credentials = entry.credentials().address();
    const preimage = xdr.HashIdPreimage.envelopeTypeSorobanAuthorization(
      new xdr.HashIdPreimageSorobanAuthorization({
        networkId: hash(Buffer.from(this.networkPassphrase)),
        nonce: credentials.nonce(),
        signatureExpirationLedger: lastLedger + ledgersToLive,
        invocation: entry.rootInvocation(),
      })
    );

    const payload = hash(preimage.toXDR());

    const authHash = Buffer.from(keccak256(payload).slice(2), "hex");

    console.log("sha256(preimage)", payload.toString("hex"));

    console.log("keccak256(sha256(preimage))", authHash.toString("hex"));

    const ethereumSignature = await this.ethereumSign(authHash);

    console.log(
      "sign(keccack256(prefix_with_ethereum(keccack256(sha256(message)))))",
      ethereumSignature.signature.toString("hex")
    );

    credentials.signatureExpirationLedger(lastLedger + ledgersToLive);
    credentials.signature(
      xdr.ScVal.scvMap([
        new xdr.ScMapEntry({
          key: xdr.ScVal.scvSymbol("address"),
          val: xdr.ScVal.scvBytes(ethereumSignature.address),
        }),
        new xdr.ScMapEntry({
          key: xdr.ScVal.scvSymbol("signature"),
          val: xdr.ScVal.scvBytes(ethereumSignature.signature),
        }),
      ])
    );

    return entry;
  }

  public async signAuthEntries(
    entries: xdr.SorobanAuthorizationEntry[],
    options?: {
      keyId?: "any" | string | Uint8Array;
      ledgersToLive?: number;
    }
  ) {
    if (!this.ethereumSign) throw new Error("Ethereum sign function not set");

    for (const auth of entries) {
      if (
        auth.credentials().switch().name === "sorobanCredentialsAddress" &&
        auth.credentials().address().address().switch().name ===
          "scAddressTypeContract"
      ) {
        // If auth entry matches our Smart Wallet move forward with the signature request
        if (
          Address.contract(
            auth.credentials().address().address().contractId()
          ).toString() === this.contractId
        )
          await this.signAuthEntry(auth, options);
      }
    }

    return entries;
  }

  public async sign(
    txn: Transaction | string,
    options?: {
      ledgersToLive?: number;
    }
  ) {
    if (!this.ethereumSign) throw new Error("Ethereum sign function not set");
    /*
        - Hack to ensure we don't stack fees when simulating and assembling multiple times
            AssembleTransaction always adds the resource fee onto the transaction fee. 
            This is bad in cases where you need to simulate multiple times
    */
    txn = TransactionBuilder.cloneFrom(
      new Transaction(
        typeof txn === "string" ? txn : txn.toXDR(),
        this.networkPassphrase
      ),
      { fee: BASE_FEE }
    ).build();

    if (txn.operations.length !== 1)
      throw new Error("Must include only one Soroban operation");

    for (const op of txn.operations) {
      if (
        op.type !== "invokeHostFunction" &&
        op.type !== "extendFootprintTtl" &&
        op.type !== "restoreFootprint"
      )
        throw new Error(
          "Must include only one operation of type `invokeHostFunction` or `extendFootprintTtl` or `restoreFootprint`"
        );
    }

    // Only need to sign auth for `invokeHostFunction` operations
    if (txn.operations[0].type === "invokeHostFunction") {
      const entries = (txn.operations[0] as Operation.InvokeHostFunction).auth;

      if (entries) await this.signAuthEntries(entries, options);
    }

    console.log("here", txn.toXDR());

    const sim = await this.rpc.simulateTransaction(txn);

    if (
      SorobanRpc.Api.isSimulationError(sim) ||
      SorobanRpc.Api.isSimulationRestore(sim) // TODO handle state archival
    ) {
      console.log("error", sim);
      throw sim;
    }

    return SorobanRpc.assembleTransaction(txn, sim).build().toXDR();
  }

  public isInitialized() {
    return !!this.ethereumSign;
  }

  public async send(xdr: string, fee: number = 10_000) {
    if (!LAUNCHTUBE_URL || !LAUNCHTUBE_JWT)
      throw new Error("Launchtube service not configured");

    const data = new FormData();

    data.set("xdr", xdr);
    data.set("fee", fee.toString());

    return fetch(LAUNCHTUBE_URL, {
      method: "POST",
      headers: {
        authorization: `Bearer ${LAUNCHTUBE_JWT}`,
      },
      body: data,
    }).then(async (res) => {
      if (res.ok) return res.json();
      else throw await res.json();
    });
  }
}
