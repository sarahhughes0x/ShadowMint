import { ConnectButton } from '@rainbow-me/rainbowkit';
import '../styles/Header.css';

export function Header() {
  return (
    <header className="header">
      <div className="brand">
        <div className="logo">SM</div>
        <div>
          <p className="brand-title">ShadowMint</p>
          <p className="brand-subtitle">Encrypted NFTs with private real owners</p>
        </div>
      </div>
      <ConnectButton />
    </header>
  );
}
