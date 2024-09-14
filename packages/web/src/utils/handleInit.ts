import {
  RPC_URL,
  NETWORK_PASSPHRASE,
  CONTRACT_ID,
  HORIZON_URL,
} from "./constants";
import {
  Keypair,
  Account,
  TransactionBuilder,
  Operation,
  SorobanRpc,
  xdr,
} from "@stellar/stellar-sdk";
// import { convertAccPublicKeyToXDR } from "./utils";

export async function handleInit(bundlerKey: Keypair, publicKey: Buffer) {
  const rpc = new SorobanRpc.Server(RPC_URL);

  const bundlerKeyAccount = await rpc
    .getAccount(bundlerKey.publicKey())
    .then((res) => new Account(res.accountId(), res.sequenceNumber()));

  // const pkeys = publicKeys.map((pk) =>
  //   convertAccPublicKeyToXDR({ tag: "EthereumAddress", values: [pk] })
  // );

  const simTxn = new TransactionBuilder(bundlerKeyAccount, {
    fee: "100",
    networkPassphrase: NETWORK_PASSPHRASE,
  })
    .addOperation(
      Operation.invokeContractFunction({
        contract: CONTRACT_ID,
        function: "init",
        args: [xdr.ScVal.scvBytes(publicKey)],
      })
    )
    .setTimeout(0)
    .build();

  const sim = await rpc.simulateTransaction(simTxn);

  if (
    SorobanRpc.Api.isSimulationError(sim) ||
    SorobanRpc.Api.isSimulationRestore(sim)
  )
    throw sim;

  const transaction = SorobanRpc.assembleTransaction(simTxn, sim)
    .setTimeout(0)
    .build();

  transaction.sign(bundlerKey);

  const txResp = await fetch(`${HORIZON_URL}/transactions`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ tx: transaction.toXDR() }),
  });

  return txResp.json();
}
