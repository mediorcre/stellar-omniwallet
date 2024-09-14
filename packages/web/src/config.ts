import { polygon } from "wagmi/chains";

import { getDefaultConfig } from "@rainbow-me/rainbowkit";

export const config = getDefaultConfig({
  appName: "Omniwallet",
  projectId: "560e06040279a88d753583a7cc541744",
  chains: [polygon],
  ssr: false, // If your dApp uses server side rendering (SSR)
});
