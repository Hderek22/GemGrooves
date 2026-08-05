// Lists one sample track on a local Hardhat network so the frontend has
// something real to render while developing The Record Shop / Studio.
// Not meant for testnet/mainnet — run after deploy:localhost.
// Pay currency defaults to ETH; override with CURRENCY=usdc or CURRENCY=dai
// to exercise the ERC-20 buy path (run mint-test-tokens:localhost first so
// a buyer account actually holds some).
const fs = require("fs");
const path = require("path");
const { ethers } = require("hardhat");

const TRACKS = {
  eth: { name: "Golden Hour", artist: "DJ Sample", price: "0.05" },
  usdc: { name: "Neon Tide", artist: "Voltage", price: "25" },
  dai: { name: "Static Bloom", artist: "Echo Chamber", price: "25" },
};

async function main() {
  const deploymentPath = path.join(__dirname, "..", "deployments", "localhost.json");
  if (!fs.existsSync(deploymentPath)) {
    throw new Error(
      'No local deployment found — run "npm run deploy:localhost -w packages/contracts" first.'
    );
  }
  const deployment = JSON.parse(fs.readFileSync(deploymentPath, "utf8"));

  const currency = (process.env.CURRENCY || "eth").toLowerCase();
  const track = TRACKS[currency];
  if (!track) throw new Error(`Unknown CURRENCY "${currency}" — use eth, usdc, or dai.`);

  const payToken =
    currency === "eth"
      ? ethers.ZeroAddress
      : currency === "usdc"
        ? deployment.config.usdc
        : deployment.config.dai;

  const [, artist, coCreator] = await ethers.getSigners();
  const nft = await ethers.getContractAt("GemGroovesNFT", deployment.contracts.GemGroovesNFT);
  const marketplace = await ethers.getContractAt(
    "GemGroovesMarketplace",
    deployment.contracts.GemGroovesMarketplace
  );

  await (
    await nft.connect(artist).setApprovalForAll(deployment.contracts.GemGroovesMarketplace, true)
  ).wait();

  // A data: URI keeps this seed script fully offline — no IPFS pinning
  // needed just to see a listing render.
  const metadata = { name: track.name, artist: track.artist };
  const tokenURI = "data:application/json;base64," + Buffer.from(JSON.stringify(metadata)).toString("base64");

  const tx = await marketplace.connect(artist).listTrack(
    tokenURI,
    1000, // 10% royalty
    [artist.address, coCreator.address],
    [7000, 3000],
    ethers.parseEther(track.price),
    payToken
  );
  const receipt = await tx.wait();
  const event = receipt.logs.find((l) => l.fragment?.name === "TrackListed");

  console.log("Seeded sample listing.");
  console.log("  tokenId:", event?.args?.[0]?.toString());
  console.log("  seller: ", artist.address);
  console.log("  price:  ", `${track.price} ${currency.toUpperCase()}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
