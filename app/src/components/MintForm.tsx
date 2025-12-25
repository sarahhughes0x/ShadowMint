import type { FormEvent } from 'react';
import { useMemo, useState } from 'react';
import { Contract, Interface } from 'ethers';
import { useAccount, useReadContract } from 'wagmi';
import { useEthersSigner } from '../hooks/useEthersSigner';
import { useZamaInstance } from '../hooks/useZamaInstance';
import { CONTRACT_ADDRESS, CONTRACT_ABI } from '../config/contracts';
import '../styles/MintForm.css';

export function MintForm() {
  const { address, isConnected } = useAccount();
  const signer = useEthersSigner();
  const { instance, isLoading: zamaLoading, error: zamaError } = useZamaInstance();
  const isConfigured = true

  const { data: totalSupply } = useReadContract({
    address: CONTRACT_ADDRESS,
    abi: CONTRACT_ABI,
    functionName: 'totalSupply',
    query: {
      enabled: isConfigured,
    },
  });

  const [realOwner, setRealOwner] = useState('');
  const [metadataURI, setMetadataURI] = useState('https://');
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [txHash, setTxHash] = useState<string | null>(null);
  const [mintedTokenId, setMintedTokenId] = useState<number | null>(null);

  const nextTokenId = useMemo(() => {
    if (!totalSupply) return '1';
    return (totalSupply + 1n).toString();
  }, [totalSupply]);

  const isValidAddress = /^0x[a-fA-F0-9]{40}$/.test(realOwner.trim());

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    setStatus(null);
    setTxHash(null);
    setMintedTokenId(null);

    if (!isConfigured) {
      setError('Update CONTRACT_ADDRESS with your deployed Sepolia address before minting.');
      return;
    }

    if (!instance || zamaLoading) {
      setError('Encryption service is still loading. Please wait a moment.');
      return;
    }

    if (!isConnected || !address) {
      setError('Connect your wallet before minting.');
      return;
    }

    if (!isValidAddress) {
      setError('Enter a valid 0x address for the real owner.');
      return;
    }

    if (!metadataURI.trim()) {
      setError('Metadata URI cannot be empty.');
      return;
    }

    const resolvedSigner = await signer;
    if (!resolvedSigner) {
      setError('Unable to access the signer from your wallet.');
      return;
    }

    try {
      setIsSubmitting(true);
      setStatus('Encrypting the real owner with Zama relayer...');

      const encryptedInput = await instance
        .createEncryptedInput(CONTRACT_ADDRESS, address)
        .addAddress(realOwner.trim())
        .encrypt();

      setStatus('Sending mint transaction...');
      const contract = new Contract(CONTRACT_ADDRESS, CONTRACT_ABI, resolvedSigner);

      const tx = await contract.mint(metadataURI.trim(), encryptedInput.handles[0], encryptedInput.inputProof);
      setTxHash(tx.hash);

      setStatus('Waiting for confirmation...');
      const receipt = await tx.wait();

      const iface = new Interface(CONTRACT_ABI);
      let tokenId: number | null = null;
      for (const log of receipt?.logs ?? []) {
        try {
          const parsed = iface.parseLog(log);
          if (parsed && parsed.name === 'Minted') {
            tokenId = Number(parsed.args.tokenId);
            break;
          }
        } catch {
          // Ignore unrelated logs
        }
      }

      if (!tokenId) {
        const updatedSupply = await contract.totalSupply();
        tokenId = Number(updatedSupply);
      }

      setMintedTokenId(tokenId);
      setStatus('Minted successfully');
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : 'Failed to mint token.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const disableActions = isSubmitting || zamaLoading;

  return (
    <section className="mint-card">
      <div className="mint-header">
        <div>
          <p className="eyebrow">Step 1</p>
          <h2>Mint a ShadowMint token</h2>
          <p className="lede">
            Provide the secret real owner address. It stays encrypted on-chain and can only be decrypted by addresses
            you authorize.
          </p>
        </div>
        <div className="next-id">
          <span className="label">Next token</span>
          <span className="value">#{nextTokenId}</span>
        </div>
      </div>

      <form className="mint-form" onSubmit={handleSubmit}>
        <label className="form-label">
          Real owner address (encrypted)
          <input
            value={realOwner}
            onChange={(e) => setRealOwner(e.target.value)}
            placeholder="0x... secret owner"
            className={!isValidAddress && realOwner ? 'error' : ''}
          />
        </label>

        <label className="form-label">
          Metadata URI
          <input
            value={metadataURI}
            onChange={(e) => setMetadataURI(e.target.value)}
            placeholder="https://your-metadata.json"
          />
        </label>

      {zamaError && <p className="form-error">{zamaError}</p>}
      {error && <p className="form-error">{error}</p>}
      {status && <p className="form-status">{status}</p>}

        <div className="actions">
          <button type="submit" disabled={disableActions}>
            {zamaLoading && 'Loading encryption...'}
            {isSubmitting && !zamaLoading && 'Minting...'}
            {!disableActions && 'Encrypt & mint'}
          </button>
          {!isConnected && <p className="hint">Connect your wallet to continue.</p>}
        </div>
      </form>

      {mintedTokenId !== null && (
        <div className="success-panel">
          <div>
            <p className="success-label">Mint complete</p>
            <p className="success-title">Token #{mintedTokenId}</p>
            <p className="success-copy">
              The encrypted real owner handle is stored on-chain. Only addresses with ACL can decrypt it.
            </p>
            {txHash && (
              <a
                className="link"
                href={`https://sepolia.etherscan.io/tx/${txHash}`}
                target="_blank"
                rel="noreferrer"
              >
                View transaction
              </a>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
