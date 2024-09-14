import { Buffer } from "buffer";
import { Address } from '@stellar/stellar-sdk';
import {
  AssembledTransaction,
  Client as ContractClient,
  ClientOptions as ContractClientOptions,
  Result,
  Spec as ContractSpec,
} from '@stellar/stellar-sdk/contract';
import type {
  u32,
  i32,
  u64,
  i64,
  u128,
  i128,
  u256,
  i256,
  Option,
  Typepoint,
  Duration,
} from '@stellar/stellar-sdk/contract';
export * from '@stellar/stellar-sdk'
export * as contract from '@stellar/stellar-sdk/contract'
export * as rpc from '@stellar/stellar-sdk/rpc'

if (typeof window !== 'undefined') {
  //@ts-ignore Buffer exists
  window.Buffer = window.Buffer || Buffer;
}


export const networks = {
  testnet: {
    networkPassphrase: "Test SDF Network ; September 2015",
    contractId: "CAE432Y727GMA7NSINQHFTENA22N7S3F4XUQZFQCZNDP74OFX4DZET24",
  }
} as const


export interface StellarSignature {
  public_key: Buffer;
  signature: Buffer;
}


export interface EthereumSignature {
  public_key: Buffer;
  signature: Buffer;
}


export interface EthereumAddressSignature {
  address: Buffer;
  signature: Buffer;
}

export type AccSignature = {tag: "Stellar", values: readonly [StellarSignature]} | {tag: "Ethereum", values: readonly [EthereumSignature]} | {tag: "EthereumAddress", values: readonly [EthereumAddressSignature]};

export type AccPublicKey = {tag: "Stellar", values: readonly [Buffer]} | {tag: "Ethereum", values: readonly [Buffer]} | {tag: "EthereumAddress", values: readonly [Buffer]};

export type DataKey = {tag: "SignerCnt", values: void} | {tag: "Signer", values: readonly [AccPublicKey]} | {tag: "SpendLimit", values: readonly [string]};

export const Errors = {
  1: {message:"NotEnoughSigners"},

  2: {message:"NegativeAmount"},

  3: {message:"BadSignatureOrder"},

  4: {message:"UnknownSigner"},

  5: {message:"InvalidContext"},

  6: {message:"SignerMismatch"},

  7: {message:"AuthenticationFailed"}
}

export interface Client {
  /**
   * Construct and simulate a init transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  init: ({signer}: {signer: Buffer}, options?: {
    /**
     * The fee to pay for the transaction. Default: BASE_FEE
     */
    fee?: number;

    /**
     * The maximum amount of time to wait for the transaction to complete. Default: DEFAULT_TIMEOUT
     */
    timeoutInSeconds?: number;

    /**
     * Whether to automatically simulate the transaction when constructing the AssembledTransaction. Default: true
     */
    simulate?: boolean;
  }) => Promise<AssembledTransaction<Result<void>>>

}
export class Client extends ContractClient {
  constructor(public readonly options: ContractClientOptions) {
    super(
      new ContractSpec([ "AAAAAQAAAAAAAAAAAAAAEFN0ZWxsYXJTaWduYXR1cmUAAAACAAAAAAAAAApwdWJsaWNfa2V5AAAAAAPuAAAAIAAAAAAAAAAJc2lnbmF0dXJlAAAAAAAD7gAAAEA=",
        "AAAAAQAAAAAAAAAAAAAAEUV0aGVyZXVtU2lnbmF0dXJlAAAAAAAAAgAAAAAAAAAKcHVibGljX2tleQAAAAAD7gAAAEEAAAAAAAAACXNpZ25hdHVyZQAAAAAAA+4AAABB",
        "AAAAAQAAAAAAAAAAAAAAGEV0aGVyZXVtQWRkcmVzc1NpZ25hdHVyZQAAAAIAAAAAAAAAB2FkZHJlc3MAAAAD7gAAABQAAAAAAAAACXNpZ25hdHVyZQAAAAAAA+4AAABB",
        "AAAAAgAAAAAAAAAAAAAADEFjY1NpZ25hdHVyZQAAAAMAAAABAAAAAAAAAAdTdGVsbGFyAAAAAAEAAAfQAAAAEFN0ZWxsYXJTaWduYXR1cmUAAAABAAAAAAAAAAhFdGhlcmV1bQAAAAEAAAfQAAAAEUV0aGVyZXVtU2lnbmF0dXJlAAAAAAAAAQAAAAAAAAAPRXRoZXJldW1BZGRyZXNzAAAAAAEAAAfQAAAAGEV0aGVyZXVtQWRkcmVzc1NpZ25hdHVyZQ==",
        "AAAAAgAAAAAAAAAAAAAADEFjY1B1YmxpY0tleQAAAAMAAAABAAAAAAAAAAdTdGVsbGFyAAAAAAEAAAPuAAAAIAAAAAEAAAAAAAAACEV0aGVyZXVtAAAAAQAAA+4AAABBAAAAAQAAAAAAAAAPRXRoZXJldW1BZGRyZXNzAAAAAAEAAAPuAAAAFA==",
        "AAAAAgAAAAAAAAAAAAAAB0RhdGFLZXkAAAAAAwAAAAAAAAAAAAAACVNpZ25lckNudAAAAAAAAAEAAAAAAAAABlNpZ25lcgAAAAAAAQAAB9AAAAAMQWNjUHVibGljS2V5AAAAAQAAAAAAAAAKU3BlbmRMaW1pdAAAAAAAAQAAABM=",
        "AAAABAAAAAAAAAAAAAAABUVycm9yAAAAAAAABwAAAAAAAAAQTm90RW5vdWdoU2lnbmVycwAAAAEAAAAAAAAADk5lZ2F0aXZlQW1vdW50AAAAAAACAAAAAAAAABFCYWRTaWduYXR1cmVPcmRlcgAAAAAAAAMAAAAAAAAADVVua25vd25TaWduZXIAAAAAAAAEAAAAAAAAAA5JbnZhbGlkQ29udGV4dAAAAAAABQAAAAAAAAAOU2lnbmVyTWlzbWF0Y2gAAAAAAAYAAAAAAAAAFEF1dGhlbnRpY2F0aW9uRmFpbGVkAAAABw==",
        "AAAAAAAAAAAAAAAEaW5pdAAAAAEAAAAAAAAABnNpZ25lcgAAAAAD7gAAABQAAAABAAAD6QAAA+0AAAAAAAAAAw==",
        "AAAAAAAAAAAAAAAMX19jaGVja19hdXRoAAAAAwAAAAAAAAARc2lnbmF0dXJlX3BheWxvYWQAAAAAAAPuAAAAIAAAAAAAAAAJc2lnbmF0dXJlAAAAAAAH0AAAABhFdGhlcmV1bUFkZHJlc3NTaWduYXR1cmUAAAAAAAAADl9hdXRoX2NvbnRleHRzAAAAAAPqAAAH0AAAAAdDb250ZXh0AAAAAAEAAAPpAAAD7QAAAAAAAAAD" ]),
      options
    )
  }
  public readonly fromJSON = {
    init: this.txFromJSON<Result<void>>
  }
}