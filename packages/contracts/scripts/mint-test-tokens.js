// Mints mock USDC/DAI to a local test account so the ERC-20 buy path can
// be exercised. Only works against local deploys — real USDC/DAI don't
// expose a public mint(). Run after deploy:localhost.
// Override the recipient with RECIPIENT=0x... env var.
const fs = require("fs");
const path = require("path");
const { ethers } = require("hardhat");

const DEFAULT_RECIPIENT = "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266"; // Hardhat account #0
const AMOUNT = "1000";

async function main() {
  const deploymentPath = path.join(__dirname, "..", "deployments", "localhost.json");
  if (!fs.existsSync(deploymentPath)) {
    throw new Error(
      'No local deployment found — run "npm run deploy:localhost -w packages/contracts" first.'
    );
  }
  const deployment = JSON.parse(fs.readFileSync(deploymentPath, "utf8"));
  const recipient = process.env.RECIPIENT || DEFAULT_RECIPIENT;

  const usdc = await ethers.getContractAt("ERC20Mock", deployment.config.usdc);
  const dai = await ethers.getContractAt("ERC20Mock", deployment.config.dai);

  await (await usdc.mint(recipient, ethers.parseEther(AMOUNT))).wait();
  await (await dai.mint(recipient, ethers.parseEther(AMOUNT))).wait();

  console.log(`Minted ${AMOUNT} mock USDC and ${AMOUNT} mock DAI to ${recipient}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
