import { useMemo, useState } from 'react';
import { useReadContract } from 'wagmi';
import { Header } from './Header';
import { MintForm } from './MintForm';
import { TokenVault } from './TokenVault';
import { CONTRACT_ADDRESS, CONTRACT_ABI } from '../config/contracts';
import '../styles/AppLayout.css';

export function ShadowMintApp() {
  const [activeTab, setActiveTab] = useState<'mint' | 'vault'>('mint');
  const isConfigured = true

  const { data: totalSupply } = useReadContract({
    address: CONTRACT_ADDRESS,
    abi: CONTRACT_ABI,
    functionName: 'totalSupply',
    query: {
      enabled: isConfigured,
    },
  });

  const mintedCount = useMemo(() => {
    if (!totalSupply) return '0';
    return totalSupply.toString();
  }, [totalSupply]);

  return (
    <div className="shadowmint-app">
      <Header />
      <main className="app-content">
        <section className="hero">
          <div>
            <p className="eyebrow">Encrypted ownership</p>
            <h1>Mint NFTs with hidden real owners</h1>
            <p className="lede">
              ShadowMint keeps the real owner field fully encrypted with Zama FHE. Only addresses you authorize can
              decrypt the secret owner behind each token.
            </p>
            <div className="hero-stats">
              <div className="stat-card">
                <span className="stat-label">Minted</span>
                <span className="stat-value">{mintedCount}</span>
              </div>
              <div className="stat-card">
                <span className="stat-label">Network</span>
                <span className="stat-value">Sepolia</span>
              </div>
            </div>
            {!isConfigured && (
              <p className="form-error" style={{ marginTop: '10px' }}>
                Set your Sepolia contract address in app/src/config/contracts.ts before minting.
              </p>
            )}
          </div>
          <div className="callout">
            <p className="callout-title">How it works</p>
            <ul>
              <li>Encrypt the real owner address client-side with the relayer</li>
              <li>Mint the NFT; contract stores encrypted handle and ACL for you</li>
              <li>Decrypt on demand or share access without exposing the plaintext</li>
            </ul>
          </div>
        </section>

        <div className="tab-bar">
          <button
            className={`tab-button ${activeTab === 'mint' ? 'active' : ''}`}
            onClick={() => setActiveTab('mint')}
          >
            Mint token
          </button>
          <button
            className={`tab-button ${activeTab === 'vault' ? 'active' : ''}`}
            onClick={() => setActiveTab('vault')}
          >
            My tokens
          </button>
        </div>

        {activeTab === 'mint' ? <MintForm /> : <TokenVault />}
      </main>
    </div>
  );
}
