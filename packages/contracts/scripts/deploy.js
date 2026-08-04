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
  let USDC_ADDRESS = process.env.USDC_ADDRESS;
  let DAI_ADDRESS  = process.env.DAI_ADDRESS;

  if (isDevNetwork && (!USDC_ADDRESS || !DAI_ADDRESS)) {
    // No real USDC/DAI exist on a local chain regardless of address — stand
    // up mocks so buyWithToken() has something real to call.
    const ERC20Mock = await ethers.getContractFactory("ERC20Mock");
    if (!USDC_ADDRESS) {
      const usdc = await ERC20Mock.deploy("USD Coin (mock)", "USDC");
      await usdc.waitForDeployment();
      USDC_ADDRESS = await usdc.getAddress();
      console.log("Mock USDC deployed to:", USDC_ADDRESS);
    }
    if (!DAI_ADDRESS) {
      const dai = await ERC20Mock.deploy("Dai Stablecoin (mock)", "DAI");
      await dai.waitForDeployment();
      DAI_ADDRESS = await dai.getAddress();
      console.log("Mock DAI deployed to:", DAI_ADDRESS);
    }
  }

  // Defaults below are Base Sepolia testnet addresses — re-verify against
  // current Base docs before any real testnet/mainnet deploy.
  USDC_ADDRESS = USDC_ADDRESS || "0x036CbD53842c5426634e7929541eC2318f3dCF7e";
  DAI_ADDRESS  = DAI_ADDRESS  || "0x7683022d84F726a96c4A6611cD31DBf5409c0Ac9";

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
