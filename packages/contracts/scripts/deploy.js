const { ethers } = require("hardhat");

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying with:", deployer.address);

  const NFT = await ethers.getContractFactory("GemGroovesNFT");
  const nft = await NFT.deploy();
  await nft.waitForDeployment();
  console.log("GemGroovesNFT deployed to:", await nft.getAddress());

  // Defaults are Base Sepolia testnet addresses — re-verify against current
  // Base docs before deploying, and override via env for other networks.
  const USDC_ADDRESS    = process.env.USDC_ADDRESS || "0x036CbD53842c5426634e7929541eC2318f3dCF7e";
  const DAI_ADDRESS     = process.env.DAI_ADDRESS  || "0x7683022d84F726a96c4A6611cd31DBf5409c0Ac9";
  const PLATFORM_FEE_BPS = process.env.PLATFORM_FEE_BPS || 250;
  const FEE_RECIPIENT    = process.env.FEE_RECIPIENT || deployer.address;

  const Marketplace = await ethers.getContractFactory("GemGroovesMarketplace");
  const marketplace = await Marketplace.deploy(
    await nft.getAddress(),
    PLATFORM_FEE_BPS,
    FEE_RECIPIENT,
    USDC_ADDRESS,
    DAI_ADDRESS
  );
  await marketplace.waitForDeployment();
  console.log("GemGroovesMarketplace deployed to:", await marketplace.getAddress());

  await nft.setMarketplace(await marketplace.getAddress());
  console.log("Marketplace set on NFT contract ✓");

  console.log("\n=== Deployment Summary ===");
  console.log("NFT:         ", await nft.getAddress());
  console.log("Marketplace: ", await marketplace.getAddress());
  console.log("Platform fee:", PLATFORM_FEE_BPS / 100, "%");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
