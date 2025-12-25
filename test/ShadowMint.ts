import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { expect } from "chai";
import { ethers, fhevm } from "hardhat";
import { ShadowMint, ShadowMint__factory } from "../types";

type Signers = {
  deployer: HardhatEthersSigner;
  alice: HardhatEthersSigner;
  bob: HardhatEthersSigner;
  carol: HardhatEthersSigner;
};

async function deployFixture() {
  const factory = (await ethers.getContractFactory("ShadowMint")) as ShadowMint__factory;
  const contract = (await factory.deploy()) as ShadowMint;
  const contractAddress = await contract.getAddress();

  return { contract, contractAddress };
}

describe("ShadowMint", function () {
  let signers: Signers;
  let contract: ShadowMint;
  let contractAddress: string;

  before(async function () {
    const ethSigners: HardhatEthersSigner[] = await ethers.getSigners();
    signers = { deployer: ethSigners[0], alice: ethSigners[1], bob: ethSigners[2], carol: ethSigners[3] };
  });

  beforeEach(async function () {
    if (!fhevm.isMock) {
      console.warn(`This hardhat test suite cannot run on Sepolia Testnet`);
      this.skip();
    }

    ({ contract, contractAddress } = await deployFixture());
  });

  it("mints and allows the owner to decrypt the stored real owner", async function () {
    const metadataURI = "ipfs://shadowmint/1";
    const realOwner = signers.bob.address;

    const encryptedOwner = await fhevm
      .createEncryptedInput(contractAddress, signers.alice.address)
      .addAddress(realOwner)
      .encrypt();

    const tx = await contract
      .connect(signers.alice)
      .mint(metadataURI, encryptedOwner.handles[0], encryptedOwner.inputProof);
    await tx.wait();

    const tokenId = await contract.totalSupply();
    expect(tokenId).to.equal(1n);
    expect(await contract.ownerOf(tokenId)).to.equal(signers.alice.address);
    expect(await contract.balanceOf(signers.alice.address)).to.equal(1n);
    expect(await contract.tokenURI(tokenId)).to.equal(metadataURI);

    const ownedTokens = await contract.tokensOfOwner(signers.alice.address);
    expect(ownedTokens).to.deep.equal([tokenId]);

    const encryptedRealOwner = await contract.getEncryptedRealOwner(tokenId);
    const handle =
      typeof encryptedRealOwner === "string" ? encryptedRealOwner : ethers.toBeHex(encryptedRealOwner);
    const clearOwner = await fhevm.userDecryptEaddress(handle, contractAddress, signers.alice);

    expect(clearOwner.toLowerCase()).to.equal(realOwner.toLowerCase());
  });

  it("grants decrypt permission to a third party", async function () {
    const encryptedOwner = await fhevm
      .createEncryptedInput(contractAddress, signers.alice.address)
      .addAddress(signers.bob.address)
      .encrypt();

    const tx = await contract
      .connect(signers.alice)
      .mint("ipfs://shadowmint/2", encryptedOwner.handles[0], encryptedOwner.inputProof);
    await tx.wait();

    const tokenId = await contract.totalSupply();

    await contract.connect(signers.alice).grantDecryptPermission(tokenId, signers.carol.address);

    const encryptedRealOwner = await contract.getEncryptedRealOwner(tokenId);
    const handle =
      typeof encryptedRealOwner === "string" ? encryptedRealOwner : ethers.toBeHex(encryptedRealOwner);
    const clearOwner = await fhevm.userDecryptEaddress(handle, contractAddress, signers.carol);

    expect(clearOwner.toLowerCase()).to.equal(signers.bob.address.toLowerCase());
  });

  it("transfers token and shares decrypt rights with the receiver", async function () {
    const encryptedOwner = await fhevm
      .createEncryptedInput(contractAddress, signers.alice.address)
      .addAddress(signers.alice.address)
      .encrypt();

    const tx = await contract
      .connect(signers.alice)
      .mint("ipfs://shadowmint/3", encryptedOwner.handles[0], encryptedOwner.inputProof);
    await tx.wait();

    const tokenId = await contract.totalSupply();

    await contract.connect(signers.alice).transferFrom(signers.alice.address, signers.bob.address, tokenId);

    expect(await contract.ownerOf(tokenId)).to.equal(signers.bob.address);
    expect(await contract.balanceOf(signers.alice.address)).to.equal(0n);
    expect(await contract.balanceOf(signers.bob.address)).to.equal(1n);
    expect(await contract.tokensOfOwner(signers.alice.address)).to.deep.equal([]);
    expect(await contract.tokensOfOwner(signers.bob.address)).to.deep.equal([tokenId]);

    const encryptedRealOwner = await contract.getEncryptedRealOwner(tokenId);
    const handle =
      typeof encryptedRealOwner === "string" ? encryptedRealOwner : ethers.toBeHex(encryptedRealOwner);
    const clearOwner = await fhevm.userDecryptEaddress(handle, contractAddress, signers.bob);

    expect(clearOwner.toLowerCase()).to.equal(signers.alice.address.toLowerCase());
  });

  it("prevents non-owners from transferring", async function () {
    const encryptedOwner = await fhevm
      .createEncryptedInput(contractAddress, signers.alice.address)
      .addAddress(signers.alice.address)
      .encrypt();

    const tx = await contract
      .connect(signers.alice)
      .mint("ipfs://shadowmint/4", encryptedOwner.handles[0], encryptedOwner.inputProof);
    await tx.wait();

    const tokenId = await contract.totalSupply();

    await expect(
      contract.connect(signers.carol).transferFrom(signers.alice.address, signers.carol.address, tokenId),
    ).to.be.revertedWith("Caller is not owner");
  });
});
