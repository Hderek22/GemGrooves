const { expect }        = require("chai");
const { ethers }        = require("hardhat");
const { parseEther, ZeroAddress } = ethers;

const BPS = (pct) => Math.round(pct * 100);

async function deploy() {
  const [owner, artist, coCreator1, coCreator2, buyer, treasury] =
    await ethers.getSigners();

  const ERC20Mock = await ethers.getContractFactory("ERC20Mock");
  const usdc = await ERC20Mock.deploy("USD Coin", "USDC");
  const dai  = await ERC20Mock.deploy("Dai Stablecoin", "DAI");

  const NFT = await ethers.getContractFactory("GemGroovesNFT");
  const nft = await NFT.deploy();

  const Marketplace = await ethers.getContractFactory("GemGroovesMarketplace");
  const marketplace = await Marketplace.deploy(
    await nft.getAddress(),
    BPS(2.5),
    treasury.address,
    await usdc.getAddress(),
    await dai.getAddress()
  );

  await nft.setMarketplace(await marketplace.getAddress());

  return { owner, artist, coCreator1, coCreator2, buyer, treasury, nft, marketplace, usdc, dai };
}

describe("GemGrooves — Full Test Suite", function () {

  // ── TrackSplitter ──────────────────────────────────────────────────────────
  describe("TrackSplitter", function () {

    it("reverts if shares don't sum to 10,000 BPS", async function () {
      const [, a, b] = await ethers.getSigners();
      const TrackSplitter = await ethers.getContractFactory("TrackSplitter");
      await expect(
        TrackSplitter.deploy(ZeroAddress, 0, [a.address, b.address], [5000, 4000])
      ).to.be.revertedWithCustomError(TrackSplitter, "InvalidSplits");
    });

    it("splits ETH correctly between two co-creators", async function () {
      const [owner, a, b] = await ethers.getSigners();
      const TrackSplitter = await ethers.getContractFactory("TrackSplitter");
      const splitter = await TrackSplitter.deploy(
        ZeroAddress, 0, [a.address, b.address], [7000, 3000]
      );

      await owner.sendTransaction({ to: await splitter.getAddress(), value: parseEther("1") });

      const aBefore = await ethers.provider.getBalance(a.address);
      const bBefore = await ethers.provider.getBalance(b.address);

      await splitter.releaseETH();

      expect(await ethers.provider.getBalance(a.address) - aBefore).to.equal(parseEther("0.7"));
      expect(await ethers.provider.getBalance(b.address) - bBefore).to.equal(parseEther("0.3"));
    });

    it("splits ERC-20 correctly among three co-creators", async function () {
      const [owner, a, b, c] = await ethers.getSigners();
      const ERC20Mock = await ethers.getContractFactory("ERC20Mock");
      const token = await ERC20Mock.deploy("Mock USDC", "USDC");

      const TrackSplitter = await ethers.getContractFactory("TrackSplitter");
      const splitter = await TrackSplitter.deploy(
        ZeroAddress, 0, [a.address, b.address, c.address], [5000, 3000, 2000]
      );

      await token.mint(await splitter.getAddress(), parseEther("1000"));
      await splitter.releaseERC20(await token.getAddress());

      expect(await token.balanceOf(a.address)).to.equal(parseEther("500"));
      expect(await token.balanceOf(b.address)).to.equal(parseEther("300"));
      expect(await token.balanceOf(c.address)).to.equal(parseEther("200"));
    });

    it("reverts releaseETH if balance is zero", async function () {
      const [, a] = await ethers.getSigners();
      const TrackSplitter = await ethers.getContractFactory("TrackSplitter");
      const splitter = await TrackSplitter.deploy(ZeroAddress, 0, [a.address], [10000]);
      await expect(splitter.releaseETH()).to.be.revertedWithCustomError(splitter, "ZeroBalance");
    });
  });

  // ── GemGroovesNFT ──────────────────────────────────────────────────────────
  describe("GemGroovesNFT", function () {

    it("allows marketplace to mint a track", async function () {
      const { artist, coCreator1, nft } = await deploy();

      const tx = await nft.mint(
        artist.address, "ipfs://QmTestHash", BPS(10),
        [artist.address, coCreator1.address], [6000, 4000]
      );
      const receipt = await tx.wait();
      const event = receipt.logs.find(l => l.fragment?.name === "TrackMinted");
      expect(event).to.not.be.undefined;

      const tokenId = event.args[0];
      expect(await nft.ownerOf(tokenId)).to.equal(artist.address);
      expect(await nft.tokenURI(tokenId)).to.equal("ipfs://QmTestHash");
    });

    it("enforces royalty cap at 50%", async function () {
      const { artist, nft } = await deploy();
      await expect(
        nft.mint(artist.address, "ipfs://test", BPS(51), [artist.address], [10000])
      ).to.be.revertedWithCustomError(nft, "RoyaltyTooHigh");
    });

    it("returns correct EIP-2981 royalty info", async function () {
      const { artist, coCreator1, nft } = await deploy();

      const tx = await nft.mint(
        artist.address, "ipfs://QmTest", BPS(10),
        [artist.address, coCreator1.address], [5000, 5000]
      );
      const receipt = await tx.wait();
      const event = receipt.logs.find(l => l.fragment?.name === "TrackMinted");
      const tokenId = event.args[0];
      const splitterAddr = event.args[2];

      const [receiver, amount] = await nft.royaltyInfo(tokenId, parseEther("1"));
      expect(receiver).to.equal(splitterAddr);
      expect(amount).to.equal(parseEther("0.1"));
    });

    it("prevents unauthorized minting", async function () {
      const { buyer, nft } = await deploy();
      await expect(
        nft.connect(buyer).mint(buyer.address, "ipfs://hack", 100, [buyer.address], [10000])
      ).to.be.revertedWithCustomError(nft, "Unauthorized");
    });

    it("supports ERC-2981 interface", async function () {
      const { nft } = await deploy();
      expect(await nft.supportsInterface("0x2a55205a")).to.be.true;
    });
  });

  // ── GemGroovesMarketplace ──────────────────────────────────────────────────
  describe("GemGroovesMarketplace", function () {

    async function listTrack(ctx, price, payToken = ZeroAddress) {
      const { artist, coCreator1, marketplace, nft } = ctx;
      await nft.connect(artist).setApprovalForAll(await marketplace.getAddress(), true);

      const tx = await marketplace.connect(artist).listTrack(
        "ipfs://QmTrack", BPS(10),
        [artist.address, coCreator1.address], [7000, 3000],
        price, payToken
      );
      const receipt = await tx.wait();
      const event = receipt.logs.find(l => l.fragment?.name === "TrackListed");
      return event.args[0];
    }

    it("executes a full ETH primary sale and splits proceeds", async function () {
      const ctx = await deploy();
      const { artist, coCreator1, buyer, treasury, marketplace } = ctx;

      const price = parseEther("1");
      const tokenId = await listTrack(ctx, price);

      const artistBefore   = await ethers.provider.getBalance(artist.address);
      const coBefore       = await ethers.provider.getBalance(coCreator1.address);
      const treasuryBefore = await ethers.provider.getBalance(treasury.address);

      await marketplace.connect(buyer).buyWithETH(tokenId, { value: price });

      expect(await ethers.provider.getBalance(treasury.address) - treasuryBefore)
        .to.equal(parseEther("0.025"));
      expect(await ethers.provider.getBalance(artist.address) - artistBefore)
        .to.be.closeTo(parseEther("0.6825"), parseEther("0.001"));
      expect(await ethers.provider.getBalance(coCreator1.address) - coBefore)
        .to.be.closeTo(parseEther("0.2925"), parseEther("0.001"));
    });

    it("transfers NFT to buyer after ETH sale", async function () {
      const ctx = await deploy();
      const { buyer, nft, marketplace } = ctx;

      const tokenId = await listTrack(ctx, parseEther("0.5"));
      await marketplace.connect(buyer).buyWithETH(tokenId, { value: parseEther("0.5") });
      expect(await nft.ownerOf(tokenId)).to.equal(buyer.address);
    });

    it("reverts if ETH amount is incorrect", async function () {
      const ctx = await deploy();
      const { buyer, marketplace } = ctx;

      const tokenId = await listTrack(ctx, parseEther("1"));
      await expect(
        marketplace.connect(buyer).buyWithETH(tokenId, { value: parseEther("0.5") })
      ).to.be.revertedWithCustomError(marketplace, "IncorrectETHAmount");
    });

    it("executes a full USDC primary sale and splits proceeds", async function () {
      const ctx = await deploy();
      const { artist, coCreator1, buyer, treasury, marketplace, usdc } = ctx;

      const price = parseEther("100");
      await usdc.mint(buyer.address, price);
      await usdc.connect(buyer).approve(await marketplace.getAddress(), price);

      const tokenId = await listTrack(ctx, price, await usdc.getAddress());
      await marketplace.connect(buyer).buyWithToken(tokenId, await usdc.getAddress());

      expect(await usdc.balanceOf(treasury.address)).to.equal(parseEther("2.5"));
      expect(await usdc.balanceOf(artist.address))
        .to.be.closeTo(parseEther("68.25"), parseEther("0.01"));
      expect(await usdc.balanceOf(coCreator1.address))
        .to.be.closeTo(parseEther("29.25"), parseEther("0.01"));
    });

    it("reverts when paying with a non-whitelisted token", async function () {
      const ctx = await deploy();
      const { buyer, marketplace, usdc } = ctx;

      // List with an allowed token (USDC), then attempt to pay with a
      // different, non-allow-listed token — listTrack() itself already
      // rejects a disallowed payToken at listing time, so this exercises
      // buyWithToken()'s own TokenNotAllowed guard on a mismatched token.
      const ERC20Mock = await ethers.getContractFactory("ERC20Mock");
      const rogue = await ERC20Mock.deploy("Rogue Token", "RGE");

      const tokenId = await listTrack(ctx, parseEther("100"), await usdc.getAddress());

      await expect(
        marketplace.connect(buyer).buyWithToken(tokenId, await rogue.getAddress())
      ).to.be.revertedWithCustomError(marketplace, "TokenNotAllowed");
    });

    it("allows seller to cancel a listing", async function () {
      const ctx = await deploy();
      const { artist, buyer, marketplace } = ctx;

      const tokenId = await listTrack(ctx, parseEther("1"));
      await marketplace.connect(artist).cancelListing(tokenId);

      await expect(
        marketplace.connect(buyer).buyWithETH(tokenId, { value: parseEther("1") })
      ).to.be.revertedWithCustomError(marketplace, "ListingInactive");
    });

    it("prevents non-seller from cancelling", async function () {
      const ctx = await deploy();
      const { buyer, marketplace } = ctx;

      const tokenId = await listTrack(ctx, parseEther("1"));
      await expect(
        marketplace.connect(buyer).cancelListing(tokenId)
      ).to.be.revertedWithCustomError(marketplace, "NotSeller");
    });

    it("prevents buying an already sold listing", async function () {
      const ctx = await deploy();
      const { buyer, marketplace } = ctx;

      const tokenId = await listTrack(ctx, parseEther("1"));
      await marketplace.connect(buyer).buyWithETH(tokenId, { value: parseEther("1") });

      await expect(
        marketplace.connect(buyer).buyWithETH(tokenId, { value: parseEther("1") })
      ).to.be.revertedWithCustomError(marketplace, "ListingInactive");
    });

    it("owner can update platform fee", async function () {
      const { marketplace } = await deploy();
      await marketplace.setPlatformFee(BPS(5));
      expect(await marketplace.platformFeeBPS()).to.equal(BPS(5));
    });

    it("reverts if platform fee exceeds 20%", async function () {
      const { marketplace } = await deploy();
      await expect(
        marketplace.setPlatformFee(BPS(21))
      ).to.be.revertedWithCustomError(marketplace, "FeeTooHigh");
    });
  });
});
