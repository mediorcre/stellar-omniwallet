import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useCallback, useEffect, useState } from "react";
import { useAccount, useSignMessage } from "wagmi";
import { handleInit } from "../utils/handleInit";
import { fund } from "../utils/handleSend";
import {
  CONTRACT_ID,
  NETWORK_PASSPHRASE,
  RPC_URL,
  bundlerAccount,
  native,
} from "../utils/constants";
import { ScaleLoader } from "react-spinners";
import Balances from "./Balances";
import { queryClient } from "../main";
import { EthereumKit } from "../utils/EthereumKit";
import ConfettiExplosion from "react-confetti-explosion";

const ethereumKit = new EthereumKit({
  rpcUrl: RPC_URL,
  networkPassphrase: NETWORK_PASSPHRASE,
});

function Onboarding() {
  const [isLoading, setIsLoading] = useState(false);
  const [isExploding, setIsExploding] = useState(false);
  const { isConnected, address } = useAccount();
  const { signMessageAsync } = useSignMessage();

  useEffect(() => {
    if (!address || ethereumKit.isInitialized()) return;

    ethereumKit.setEthereumSignFunction(async (data: Buffer) => {
      const signature = await signMessageAsync({
        message: {
          raw: data,
        },
      });

      return {
        address: Buffer.from(address.slice(2), "hex"),
        signature: Buffer.from(signature.slice(2), "hex"),
      };
    });
  }, [address, signMessageAsync]);

  const handleInitClick = useCallback(async () => {
    if (!address || !isConnected) return;

    try {
      setIsLoading(true);
      await handleInit(bundlerAccount, Buffer.from(address.slice(2), "hex"));
      setIsLoading(false);
    } catch (e) {
      console.log("error", e);
    }
  }, [address, isConnected]);

  const handleFundClick = useCallback(async () => {
    setIsLoading(true);
    await fund(bundlerAccount);
    queryClient.refetchQueries({ queryKey: [CONTRACT_ID, "balances"] });
    setIsLoading(false);
  }, []);

  const handleContractTransfer = useCallback(async () => {
    if (!address) return;
    setIsLoading(true);

    const { built } = await native.transfer({
      from: CONTRACT_ID,
      to: bundlerAccount.publicKey(),
      amount: BigInt(1 * 1_000_000),
    });

    if (!built) throw new Error("Failed to build transaction");

    const transaction = await ethereumKit.sign(built);

    await ethereumKit.send(transaction);
    setIsExploding(true);
    setTimeout(() => {
      // Swal.fire("Transaction sent!", "1 XLM sent out", "success");
      setIsExploding(false);
    }, 1000);
    queryClient.refetchQueries({ queryKey: [CONTRACT_ID, "balances"] });
    setIsLoading(false);
  }, [address]);

  return (
    <div className="">
      {!isConnected && (
        <div>Connect your Ethereum wallet to start using Omniwallet</div>
      )}
      <div className="flex flex-col items-center">
        <div className="p-4">
          <ConnectButton />
        </div>

        {isExploding && <ConfettiExplosion />}

        {isConnected && (
          <div className="flex flex-col">
            <span>Your contract ID is</span>
            <span>{CONTRACT_ID.slice(0, 28)}</span>
            <span>{CONTRACT_ID.slice(28)}</span>
          </div>
        )}

        {isConnected && <Balances scAddress={CONTRACT_ID} />}

        {isLoading ? (
          <ScaleLoader color="#fff" />
        ) : (
          isConnected && (
            <div className="flex flex-col w-full">
              <button className="mt-2" onClick={handleInitClick}>
                Link your wallet 🔗
              </button>
              <button className="mt-2" onClick={handleFundClick}>
                Fund account 💸
              </button>
              <button className="mt-2" onClick={handleContractTransfer}>
                Send 0.1 XLM Out 🔥
              </button>
            </div>
          )
        )}
      </div>
    </div>
  );
}

export default Onboarding;
