import { task } from "hardhat/config";
import type { TaskArguments } from "hardhat/types";

task("task:address", "Prints the ShadowMint address").setAction(async function (_taskArguments: TaskArguments, hre) {
  const { deployments } = hre;

  const contract = await deployments.get("ShadowMint");

  console.log("ShadowMint address is " + contract.address);
});

task("task:mint", "Mint a ShadowMint NFT with an encrypted real owner")
  .addParam("realowner", "The real owner address to encrypt")
  .addOptionalParam("uri", "Metadata URI to store with the token", "")
  .addOptionalParam("address", "Optionally specify the ShadowMint contract address")
  .setAction(async function (taskArguments: TaskArguments, hre) {
    const { ethers, deployments, fhevm } = hre;
    await fhevm.initializeCLIApi();

    const shadowMintDeployment = taskArguments.address
      ? { address: taskArguments.address }
      : await deployments.get("ShadowMint");
    console.log(`ShadowMint: ${shadowMintDeployment.address}`);

    const signers = await ethers.getSigners();
    const minter = signers[0];

    const encryptedOwner = await fhevm
      .createEncryptedInput(shadowMintDeployment.address, minter.address)
      .addAddress(taskArguments.realowner)
      .encrypt();

    const contract = await ethers.getContractAt("ShadowMint", shadowMintDeployment.address);
    const tx = await contract.connect(minter).mint(taskArguments.uri, encryptedOwner.handles[0], encryptedOwner.inputProof);
    console.log(`Wait for tx:${tx.hash}...`);
    const receipt = await tx.wait();
    console.log(`tx:${tx.hash} status=${receipt?.status}`);

    const mintedId = await contract.totalSupply();
    console.log(`Minted tokenId: ${mintedId}`);
  });

task("task:decrypt-realowner", "Decrypt stored real owner for a token")
  .addParam("tokenid", "Token id to decrypt")
  .addOptionalParam("address", "Optionally specify the ShadowMint contract address")
  .setAction(async function (taskArguments: TaskArguments, hre) {
    const { ethers, deployments, fhevm } = hre;
    await fhevm.initializeCLIApi();

    const shadowMintDeployment = taskArguments.address
      ? { address: taskArguments.address }
      : await deployments.get("ShadowMint");
    console.log(`ShadowMint: ${shadowMintDeployment.address}`);

    const tokenId = parseInt(taskArguments.tokenid);
    if (!Number.isInteger(tokenId)) {
      throw new Error("tokenid must be an integer");
    }

    const signers = await ethers.getSigners();
    const contract = await ethers.getContractAt("ShadowMint", shadowMintDeployment.address);

    const encryptedRealOwner = await contract.getEncryptedRealOwner(tokenId);
    const handle =
      typeof encryptedRealOwner === "string" ? encryptedRealOwner : ethers.toBeHex(encryptedRealOwner);
    const clearOwner = await fhevm.userDecryptEaddress(handle, shadowMintDeployment.address, signers[0]);

    console.log(`Encrypted handle: ${encryptedRealOwner}`);
    console.log(`Decrypted real owner: ${clearOwner}`);
  });

task("task:grant-access", "Allow another account to decrypt the real owner for a token")
  .addParam("tokenid", "Token id to share")
  .addParam("account", "Address to grant permission to")
  .addOptionalParam("address", "Optionally specify the ShadowMint contract address")
  .setAction(async function (taskArguments: TaskArguments, hre) {
    const { ethers, deployments } = hre;

    const shadowMintDeployment = taskArguments.address
      ? { address: taskArguments.address }
      : await deployments.get("ShadowMint");
    console.log(`ShadowMint: ${shadowMintDeployment.address}`);

    const tokenId = parseInt(taskArguments.tokenid);
    if (!Number.isInteger(tokenId)) {
      throw new Error("tokenid must be an integer");
    }

    const signers = await ethers.getSigners();
    const contract = await ethers.getContractAt("ShadowMint", shadowMintDeployment.address);
    const tx = await contract
      .connect(signers[0])
      .grantDecryptPermission(tokenId, taskArguments.account as string);

    console.log(`Wait for tx:${tx.hash}...`);
    const receipt = await tx.wait();
    console.log(`tx:${tx.hash} status=${receipt?.status}`);
  });
