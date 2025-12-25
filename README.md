# ShadowMint

ShadowMint is a privacy-first NFT system that stores an encrypted `realOwner` for each token using Fully Homomorphic
Encryption (FHE). The encrypted value is written on-chain, while decryption is only possible for the token owner or
addresses explicitly granted access via on-chain ACL. This enables ownership privacy without breaking NFT composability.

## Overview

ShadowMint provides two parallel ownership views:

- **Public owner**: Standard ERC-721 owner visible on-chain.
- **Private real owner**: Encrypted and only decryptable by authorized addresses via the Zama relayer.

This design enables private ownership attribution and selective disclosure while keeping NFTs compatible with standard
marketplaces and tooling.

## Key Advantages

- **On-chain privacy**: Real owner data is stored as ciphertext on-chain.
- **Selective disclosure**: Token owners can grant or revoke decrypt access to specific addresses.
- **Compatible with NFT tooling**: Public ownership follows ERC-721 patterns.
- **No frontend secrets**: The UI avoids environment variables and does not read local storage.
- **Auditable access rules**: ACL events and permissions remain transparent while data stays private.

## Problems Solved

- **Privacy leaks**: Public NFTs can reveal sensitive ownership relationships. ShadowMint keeps real ownership private.
- **Selective sharing**: Projects often need to share ownership proofs with a third party. ShadowMint allows explicit,
  revocable access.
- **On-chain permanence without exposure**: Sensitive fields can be persisted on-chain without exposing raw data.
- **User experience vs. privacy tradeoff**: FHE allows privacy without replacing common NFT workflows.

## Tech Stack

- **Smart contracts**: Hardhat + TypeScript
- **Privacy layer**: Zama FHEVM contracts and relayer
- **Frontend**: React + Vite + viem (reads) + ethers (writes) + RainbowKit
- **Package manager**: npm

## Repository Structure

- `contracts/` – Solidity contracts (ShadowMint ERC-721 + encrypted storage)
- `deploy/` – Deployment scripts for local and Sepolia
- `tasks/` – Hardhat tasks (mint, decrypt, grant access)
- `test/` – Test suite using mock FHEVM
- `app/` – Frontend (no Tailwind, no env vars)
- `deployments/` – Network deployment artifacts and ABI sources

## Contract Behavior (High Level)

- Mint takes a `realOwner` value that is encrypted and stored on-chain.
- The encrypted value can only be decrypted by the token owner or accounts granted access.
- Access control is explicit and on-chain; the encrypted value itself never leaves the chain unencrypted.
- Read methods are pure/view and do not depend on `msg.sender` inside view functions.

## Encryption and Access Model

1. **Mint**: The caller submits a `realOwner` and token metadata. The `realOwner` is encrypted and stored.
2. **Ownership**: The standard ERC-721 owner is visible on-chain and transferable.
3. **Access**: The owner can grant decryption access to other addresses.
4. **Decryption**: Authorized addresses can request decryption via the relayer.

## Frontend Behavior

- **Reads** use viem to query public state.
- **Writes** use ethers to submit transactions.
- **No local storage** usage.
- **No environment variables** in the frontend.
- **No Tailwind**; styling is custom.
- **No localhost network** is used in the UI; the app targets Sepolia.

## Setup and Usage

### Prerequisites

- Node.js 20+
- npm

### Install

```bash
npm install --no-package-lock
```

### Compile

```bash
npm run compile
```

### Test

```bash
npm test
```

### Environment Variables

Backend commands rely on `.env` in the project root:

- `INFURA_API_KEY` – Sepolia RPC key
- `PRIVATE_KEY` – funded deployer key (private key only; no mnemonic)
- `ETHERSCAN_API_KEY` – optional for verification

### Local Deployment (Hardhat)

```bash
npx hardhat deploy --network hardhat
```

### Sepolia Deployment

```bash
npx hardhat deploy --network sepolia
```

Deployment artifacts are written to `deployments/sepolia/ShadowMint.json`. The frontend ABI must be copied from that
file into `app/src/config/contracts.ts` after deployment.

### Hardhat Tasks

- Mint with encrypted real owner:
  ```bash
  npx hardhat task:mint --realowner <addr> --uri <metadata>
  ```
- Decrypt stored real owner:
  ```bash
  npx hardhat task:decrypt-realowner --tokenid <id>
  ```
- Grant decryption access:
  ```bash
  npx hardhat task:grant-access --tokenid <id> --account <addr>
  ```

### Frontend Build

```bash
cd app
npm install --no-package-lock
npm run build
```

## Development Notes

- The ABI used by the frontend must match `deployments/sepolia/ShadowMint.json`.
- Do not use a mnemonic for deployment; only `PRIVATE_KEY` is supported.
- Do not modify any `package.json` files.
- Do not modify any frontend hooks.

## Security and Privacy Considerations

- Encrypted data is still on-chain; privacy depends on FHE and correct access controls.
- Only authorized accounts can decrypt `realOwner` through the relayer.
- Access control is enforced on-chain; revocations are effective immediately for future decrypts.

## Future Roadmap

- **Batch mints and bulk access updates** to reduce transaction overhead.
- **On-chain metadata privacy** options for sensitive NFT traits.
- **Role-based access groups** for enterprise use cases.
- **Cross-chain deployment** with consistent encrypted ownership semantics.
- **Indexer integration** for faster encrypted ownership analytics.
- **Enhanced UI flows** for permissions management and audit logs.

## License

See `LICENSE`.
