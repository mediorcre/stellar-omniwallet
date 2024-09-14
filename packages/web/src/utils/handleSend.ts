import {
  NETWORK_PASSPHRASE,
  HORIZON_URL,
  CONTRACT_ID,
  RPC_URL,
} from "./constants";
import {
  BASE_FEE,
  Horizon,
  Keypair,
  Operation,
  SorobanRpc,
  TransactionBuilder,
  xdr,
  Address,
  XdrLargeInt,
  Contract,
  TimeoutInfinite,
  Memo,
  hash,
  Transaction,
  MemoType,
} from "@stellar/stellar-sdk";
import { bundlerAccount } from "./constants";
import { xlmToStroops } from "./utils";
import { EthereumAddressSignature } from "omniwallet-bindings";
import { keccak256 } from "viem";

export const transfer = (
  contractId: string,
  params: xdr.ScVal[],
  memo: string | undefined,
  builder: TransactionBuilder
) => {
  const contract = new Contract(contractId);

  const transferOperation = contract.call("transfer", ...params);

  const tx = builder
    .addOperation(transferOperation)
    .setTimeout(TimeoutInfinite);

  if (memo) {
    tx.addMemo(Memo.text(memo));
  }

  return tx.build();
};

export const transferFrom = (
  contractId: string,
  params: xdr.ScVal[],
  memo: string | undefined,
  builder: TransactionBuilder
) => {
  const contract = new Contract(contractId);

  const transferOperation = contract.call("transfer_from", ...params);

  const tx = builder
    .addOperation(transferOperation)
    .setTimeout(TimeoutInfinite);

  if (memo) {
    tx.addMemo(Memo.text(memo));
  }

  return tx.build();
};

const server = new Horizon.Server(HORIZON_URL);
const rpc = new SorobanRpc.Server(RPC_URL);

export async function fund(bundlerKey: Keypair) {
  const account = await server.loadAccount(bundlerKey.publicKey());

  // This is the amount you want to send (1 XLM in stroops)
  const amount = BigInt(1 * 10_000_000);

  const params = [
    new Address(bundlerKey.publicKey()).toScVal(),
    new Address(CONTRACT_ID).toScVal(),
    new XdrLargeInt("i128", amount).toI128(),
  ];

  try {
    // Create the transaction with the correct sequence number
    const txBuilder = new TransactionBuilder(account, {
      fee: (parseInt(BASE_FEE) * 5).toString(),
      networkPassphrase: NETWORK_PASSPHRASE,
    });

    const transaction = transfer(
      "CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC",
      params,
      undefined,
      txBuilder
    );

    transaction.sign(bundlerKey);

    const simulationResponse = await rpc.simulateTransaction(transaction);

    const preparedTransaction = SorobanRpc.assembleTransaction(
      transaction,
      simulationResponse
    ).build();

    preparedTransaction.sign(bundlerKey);

    const result = await server.submitTransaction(preparedTransaction);
    console.log("Transaction successful!", result);
  } catch (e: unknown) {
    const err = e as Error;
    alert(err.message);
  }
}

export async function buildContractTransfer(to: string, amount: string) {
  const account = await server.loadAccount(bundlerAccount.publicKey());

  const params = [
    new Address(CONTRACT_ID).toScVal(),
    new Address(to).toScVal(),
    new XdrLargeInt("i128", xlmToStroops(amount)).toI128(),
  ];

  // Create the transaction with the correct sequence number
  const txBuilder = new TransactionBuilder(account, {
    fee: (parseInt(BASE_FEE) * 10).toString(),
    networkPassphrase: NETWORK_PASSPHRASE,
  });

  const transaction = transfer(
    "CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC",
    params,
    undefined,
    txBuilder
  );

  transaction.sign(bundlerAccount);

  const simulationResponse = await rpc.simulateTransaction(transaction);

  if (
    SorobanRpc.Api.isSimulationError(simulationResponse) ||
    SorobanRpc.Api.isSimulationRestore(simulationResponse)
  )
    throw simulationResponse;

  const lastLedger = await rpc.getLatestLedger();

  const preparedTransaction = SorobanRpc.assembleTransaction(
    transaction,
    simulationResponse
  ).build();

  const auth = simulationResponse.result?.auth[0];

  if (!auth) throw new Error("Missing auth field");

  const data = xdr.HashIdPreimage.envelopeTypeSorobanAuthorization(
    new xdr.HashIdPreimageSorobanAuthorization({
      networkId: hash(Buffer.from(NETWORK_PASSPHRASE, "utf-8")),
      nonce: auth.credentials().address().nonce(),
      signatureExpirationLedger: lastLedger.sequence + 100,
      invocation: auth.rootInvocation(),
    })
  );

  const preimage = hash(data.toXDR());

  const authHash = keccak256(preimage);

  return {
    preparedTransaction,
    authHash,
    lastLedger,
  };
}

export async function contractTransfer(
  transaction: Transaction<Memo<MemoType>, Operation[]>,
  signature: EthereumAddressSignature,
  lastLedger: SorobanRpc.Api.GetLatestLedgerResponse
) {
  const op = transaction.operations[0] as Operation.InvokeHostFunction;

  const creds = op.auth?.[0].credentials().address();

  if (!creds) throw new Error("Invalid creds");

  // const scvSignature = convertAccSignatureToXDR({
  //   tag: "EthereumAddress",
  //   values: [signature],
  // });

  const scvSignature = xdr.ScVal.scvMap([
    new xdr.ScMapEntry({
      key: xdr.ScVal.scvSymbol("address"),
      val: xdr.ScVal.scvBytes(signature.address),
    }),
    new xdr.ScMapEntry({
      key: xdr.ScVal.scvSymbol("signature"),
      val: xdr.ScVal.scvBytes(signature.signature),
    }),
    // new xdr.ScMapEntry({
    //   key: xdr.ScVal.scvSymbol("recovery_id"),
    //   val: xdr.ScVal.scvU32(signature.recovery_id),
    // }),
  ]);

  creds.signatureExpirationLedger(lastLedger.sequence + 100);
  creds.signature(scvSignature);

  transaction.sign(bundlerAccount);

  const result = await server.submitTransaction(transaction);
  console.log("Transaction successful!", result);
}
