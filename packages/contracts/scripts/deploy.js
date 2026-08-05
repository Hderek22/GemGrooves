const fs = require("fs");
const path = require("path");
const { ethers, network } = require("hardhat");

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying with:", deployer.address);

  const NFT = await ethers.getContractFactory("GemGroovesNFT");
  const nft = await NFT.deploy();
  await nft.waitForDeployment();
  console.log("GemGroovesNFT deployed to:", await nft.getAddress());

  const PLATFORM_FEE_BPS = process.env.PLATFORM_FEE_BPS || 250;
  const FEE_RECIPIENT    = process.env.FEE_RECIPIENT || deployer.address;

  const isDevNetwork = network.name === "localhost" || network.name === "hardhat";
  const isMainnet = network.name === "base";
  let USDC_ADDRESS = process.env.USDC_ADDRESS;
  let DAI_ADDRESS  = process.env.DAI_ADDRESS;

  if (!USDC_ADDRESS) {
    if (isDevNetwork) {
      const ERC20Mock = await ethers.getContractFactory("ERC20Mock");
      const usdc = await ERC20Mock.deploy("USD Coin (mock)", "USDC");
      await usdc.waitForDeployment();
      USDC_ADDRESS = await usdc.getAddress();
      console.log("Mock USDC deployed to:", USDC_ADDRESS);
    } else {
      // Verified against BaseScan — Circle's real Base Sepolia/mainnet USDC
      // (same address on both, per Circle's cross-chain deployment).
      USDC_ADDRESS = "0x036CbD53842c5426634e7929541eC2318f3dCF7e";
    }
  }

  if (!DAI_ADDRESS) {
    if (isMainnet) {
      // Unlike USDC, there's no single canonical DAI address we've verified
      // for Base mainnet — MakerDAO/Sky's real deployment needs confirming
      // before a mainnet deploy. Refusing to guess with real funds at stake.
      throw new Error(
        "DAI_ADDRESS must be set explicitly for a Base mainnet deploy — " +
          "verify the real DAI contract address on Base first, no default is assumed here."
      );
    }
    // Base Sepolia has no official DAI deployment (unlike USDC, which
    // Circle issues on testnets too) — stand up our own mock stand-in.
    const ERC20Mock = await ethers.getContractFactory("ERC20Mock");
    const dai = await ERC20Mock.deploy("Dai Stablecoin (mock)", "DAI");
    await dai.waitForDeployment();
    DAI_ADDRESS = await dai.getAddress();
    console.log("Mock DAI deployed to:", DAI_ADDRESS);
  }

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

  const { chainId } = await ethers.provider.getNetwork();
  const record = {
    network: network.name,
    chainId: Number(chainId),
    deployedAt: new Date().toISOString(),
    contracts: {
      GemGroovesNFT: await nft.getAddress(),
      GemGroovesMarketplace: await marketplace.getAddress(),
    },
    config: {
      platformFeeBPS: Number(PLATFORM_FEE_BPS),
      feeRecipient: FEE_RECIPIENT,
      usdc: USDC_ADDRESS,
      dai: DAI_ADDRESS,
    },
  };

  const deploymentsDir = path.join(__dirname, "..", "deployments");
  fs.mkdirSync(deploymentsDir, { recursive: true });
  const outPath = path.join(deploymentsDir, `${network.name}.json`);
  fs.writeFileSync(outPath, JSON.stringify(record, null, 2) + "\n");
  console.log(`\nDeployment record written to ${outPath}`);
  console.log('Run "npm run sync:web -w packages/contracts" to update the frontend config.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
