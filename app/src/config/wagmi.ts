import { getDefaultConfig } from '@rainbow-me/rainbowkit';
import { sepolia } from 'wagmi/chains';

export const config = getDefaultConfig({
  appName: 'ShadowMint',
  projectId: '5a2f7a4b4b1c4d2f96a88c707c0c7b9c',
  chains: [sepolia],
  ssr: false,
});
