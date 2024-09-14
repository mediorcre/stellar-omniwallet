import { useQuery } from "@tanstack/react-query";
import { fetchSmartWalletBalance, stroopsToXlm } from "../utils/utils";

function Balances({ scAddress }: { scAddress: string }) {
  const { data: nativeBalance } = useQuery({
    queryKey: [scAddress, "balances"],
    queryFn: () => fetchSmartWalletBalance(scAddress),
  });

  return (
    <div className="flex flex-col w-full pt-2">
      <div className="flex flex-row items-center justify-center">
        <img
          className="w-12 h-12 p-1"
          src="https://s2.coinmarketcap.com/static/img/coins/200x200/512.png"
        />
        <span className="text-2xl p-4 font-bold">
          {nativeBalance ? stroopsToXlm(nativeBalance) : 0}
        </span>
      </div>
    </div>
  );
}

export default Balances;
