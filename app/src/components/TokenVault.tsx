import { useEffect, useState } from 'react';
import { Contract } from 'ethers';
import { useAccount, usePublicClient, useReadContract } from 'wagmi';
import { useEthersSigner } from '../hooks/useEthersSigner';
import { useZamaInstance } from '../hooks/useZamaInstance';
import { CONTRACT_ABI, CONTRACT_ADDRESS } from '../config/contracts';
import '../styles/TokenVault.css';

type VaultToken = {
  tokenId: number;
  metadataURI: string;
  encryptedRealOwner: `0x${string}`;
};

export function TokenVault() {
  const { address, isConnected } = useAccount();
  const publicClient = usePublicClient();
  const signer = useEthersSigner();
  const { instance, isLoading: zamaLoading, error: zamaError } = useZamaInstance();
  const isConfigured = true

  const { data: tokenIdsData, isFetching } = useReadContract({
    address: CONTRACT_ADDRESS,
    abi: CONTRACT_ABI,
    functionName: 'tokensOfOwner',
    args: address ? [address] : undefined,
    query: {
      enabled: Boolean(address) && isConfigured,
    },
  });

  const [tokens, setTokens] = useState<VaultToken[]>([]);
  const [loadingTokens, setLoadingTokens] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [decryptingId, setDecryptingId] = useState<number | null>(null);
  const [decryptions, setDecryptions] = useState<Record<number, string>>({});
  const [shareTargets, setShareTargets] = useState<Record<number, string>>({});
  const [grantingId, setGrantingId] = useState<number | null>(null);

  useEffect(() => {
    const loadTokens = async () => {
      if (!address || !publicClient || !tokenIdsData || tokenIdsData.length === 0) {
        setTokens([]);
        return;
      }

      setLoadingTokens(true);
      setError(null);

      try {
        const details = await Promise.all(
          (tokenIdsData as readonly bigint[]).map(async (idBigint) => {
            const [metadataURI, encrypted] = await Promise.all([
              publicClient.readContract({
                address: CONTRACT_ADDRESS,
                abi: CONTRACT_ABI,
                functionName: 'tokenURI',
                args: [idBigint],
              }),
              publicClient.readContract({
                address: CONTRACT_ADDRESS,
                abi: CONTRACT_ABI,
                functionName: 'getEncryptedRealOwner',
                args: [idBigint],
              }),
            ]);

            const encryptedHandle =
              typeof encrypted === 'string'
                ? encrypted
                : (`0x${BigInt(encrypted as unknown as bigint).toString(16).padStart(64, '0')}` as const);

            return {
              tokenId: Number(idBigint),
              metadataURI: (metadataURI as string) ?? '',
              encryptedRealOwner: encryptedHandle,
            };
          }),
        );

        setTokens(details);
      } catch (err) {
        console.error(err);
        setError(err instanceof Error ? err.message : 'Unable to fetch your tokens.');
        setTokens([]);
      } finally {
        setLoadingTokens(false);
      }
    };

    loadTokens();
  }, [address, publicClient, tokenIdsData]);

  const decryptRealOwner = async (token: VaultToken) => {
    if (!instance || zamaLoading) {
      setError('Encryption service is not ready yet.');
      return;
    }
    if (!isConnected || !address) {
      setError('Connect your wallet to decrypt.');
      return;
    }

    const resolvedSigner = await signer;
    if (!resolvedSigner) {
      setError('Unable to access wallet signer.');
      return;
    }

    try {
      setDecryptingId(token.tokenId);
      setError(null);

      const keypair = instance.generateKeypair();
      const startTimeStamp = Math.floor(Date.now() / 1000).toString();
      const durationDays = '5';
      const contractAddresses = [CONTRACT_ADDRESS];
      const eip712 = instance.createEIP712(keypair.publicKey, contractAddresses, startTimeStamp, durationDays);

      const signature = await resolvedSigner.signTypedData(
        eip712.domain,
        {
          UserDecryptRequestVerification: eip712.types.UserDecryptRequestVerification,
        },
        eip712.message,
      );

      const result = await instance.userDecrypt(
        [
          {
            handle: token.encryptedRealOwner,
            contractAddress: CONTRACT_ADDRESS,
          },
        ],
        keypair.privateKey,
        keypair.publicKey,
        signature.replace('0x', ''),
        contractAddresses,
        address,
        startTimeStamp,
        durationDays,
      );

      const clear = result[token.encryptedRealOwner];
      setDecryptions((prev) => ({ ...prev, [token.tokenId]: clear }));
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : 'Failed to decrypt encrypted owner.');
    } finally {
      setDecryptingId(null);
    }
  };

  const grantAccess = async (tokenId: number) => {
    const target = shareTargets[tokenId]?.trim() ?? '';
    if (!/^0x[a-fA-F0-9]{40}$/.test(target)) {
      setError('Enter a valid address to share access.');
      return;
    }

    const resolvedSigner = await signer;
    if (!resolvedSigner) {
      setError('Unable to access wallet signer.');
      return;
    }

    try {
      setGrantingId(tokenId);
      setError(null);
      const contract = new Contract(CONTRACT_ADDRESS, CONTRACT_ABI, resolvedSigner);
      const tx = await contract.grantDecryptPermission(tokenId, target);
      await tx.wait();
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : 'Failed to grant decrypt permission.');
    } finally {
      setGrantingId(null);
    }
  };

  if (!isConfigured) {
    return (
      <section className="vault">
        <div className="empty">
          <p>Please set the Sepolia contract address in app/src/config/contracts.ts to load your tokens.</p>
        </div>
      </section>
    );
  }

  if (!isConnected) {
    return (
      <section className="vault">
        <div className="empty">
          <p>Connect your wallet to view your encrypted tokens.</p>
        </div>
      </section>
    );
  }

  return (
    <section className="vault">
      <div className="vault-header">
        <div>
          <p className="eyebrow">Step 2</p>
          <h2>Your encrypted tokens</h2>
          <p className="lede">
            Decrypt the stored real owner address or grant another address permission to read it.
          </p>
        </div>
      </div>

      {zamaError && <p className="form-error">{zamaError}</p>}
      {error && <p className="form-error">{error}</p>}

      {loadingTokens || isFetching ? (
        <div className="empty">
          <p>Loading your tokens...</p>
        </div>
      ) : tokens.length === 0 ? (
        <div className="empty">
          <p>No tokens found for this wallet.</p>
        </div>
      ) : (
        <div className="token-grid">
          {tokens.map((token) => (
            <div className="token-card" key={token.tokenId}>
              <div className="token-heading">
                <span className="token-id">#{token.tokenId}</span>
                <span className="badge">Encrypted</span>
              </div>
              <p className="token-meta" title={token.metadataURI}>
                {token.metadataURI || 'No metadata URI set'}
              </p>
              <p className="token-handle">
                Handle: <code>{`${token.encryptedRealOwner.slice(0, 12)}...${token.encryptedRealOwner.slice(-6)}`}</code>
              </p>

              {decryptions[token.tokenId] ? (
                <div className="decrypted">
                  <p className="label">Real owner</p>
                  <p className="value">{decryptions[token.tokenId]}</p>
                </div>
              ) : (
                <button
                  className="secondary"
                  onClick={() => decryptRealOwner(token)}
                  disabled={decryptingId === token.tokenId || zamaLoading}
                >
                  {decryptingId === token.tokenId ? 'Decrypting…' : 'Decrypt real owner'}
                </button>
              )}

              <div className="share">
                <label>
                  Share decrypt access
                  <input
                    value={shareTargets[token.tokenId] ?? ''}
                    onChange={(e) =>
                      setShareTargets((prev) => ({
                        ...prev,
                        [token.tokenId]: e.target.value,
                      }))
                    }
                    placeholder="0x... address"
                  />
                </label>
                <button
                  onClick={() => grantAccess(token.tokenId)}
                  disabled={grantingId === token.tokenId}
                  className="ghost"
                  type="button"
                >
                  {grantingId === token.tokenId ? 'Granting...' : 'Grant access'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
