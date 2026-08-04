# GemGrooves Contracts — Deploy to Base Sepolia Testnet

Follow these steps in order. Each step builds on the previous one.

---

## Prerequisites

- Node.js v20 installed (`node -v` to check — see the repo's `.nvmrc`)
- A wallet you control (MetaMask or any EOA)
- Your wallet's **private key** (export from MetaMask: Account Details → Export Private Key)
- A **Basescan API key** (free — sign up at https://basescan.org/register)

---

## Step 1 — Install dependencies

From the repo root (this is an npm workspace, not a standalone project):

```bash
npm install
```

This installs Hardhat, OpenZeppelin contracts, and all tooling for every workspace, including `packages/contracts`.

---

## Step 2 — Configure your environment

```bash
cd packages/contracts
cp .env.example .env
```

Open `.env` and fill in:

```
PRIVATE_KEY=your_wallet_private_key_without_0x_prefix
BASESCAN_KEY=your_basescan_api_key
```

`.env` is already git-ignored in this package — **never commit it.**

`USDC_ADDRESS` / `DAI_ADDRESS` / `PLATFORM_FEE_BPS` / `FEE_RECIPIENT` are optional overrides in `.env` — `scripts/deploy.js` falls back to Base Sepolia defaults if unset. **Re-verify the default USDC/DAI addresses against current Base docs before deploying** — Base Sepolia may not have an official DAI deployment, in which case deploy a second `ERC20Mock` as a testnet stand-in and set `DAI_ADDRESS` to that.

---

## Step 3 — Get free Base Sepolia ETH

You need testnet ETH to pay gas for deployment.

1. Go to: https://www.coinbase.com/faucets/base-ethereum-goerli-faucet
2. Connect your wallet or paste your address
3. Request testnet ETH (usually arrives in < 1 minute)

Alternatively: https://faucet.quicknode.com/base/sepolia

You need at least **0.01 Base Sepolia ETH** to cover deployment gas.

---

## Step 4 — Compile the contracts

```bash
npm run compile -w packages/contracts
```

Expected output:
```
Compiled 5 Solidity files successfully
```

---

## Step 5 — Run tests locally (IMPORTANT — do this before deploying)

```bash
npm run test -w packages/contracts
```

All tests should pass:
```
GemGrooves — Full Test Suite
  TrackSplitter
    ✔ reverts if shares don't sum to 10,000 BPS
    ✔ splits ETH correctly between two co-creators
    ✔ splits ERC-20 correctly among three co-creators
    ✔ reverts releaseETH if balance is zero
  GemGroovesNFT
    ✔ allows marketplace to mint a track
    ✔ enforces royalty cap at 50%
    ✔ returns correct EIP-2981 royalty info
    ✔ prevents unauthorized minting
    ✔ supports ERC-2981 interface
  GemGroovesMarketplace
    ✔ executes a full ETH primary sale and splits proceeds
    ✔ transfers NFT to buyer after ETH sale
    ✔ reverts if ETH amount is incorrect
    ✔ executes a full USDC primary sale and splits proceeds
    ✔ reverts when paying with a non-whitelisted token
    ✔ allows seller to cancel a listing
    ✔ prevents non-seller from cancelling
    ✔ prevents buying an already sold listing
    ✔ owner can update platform fee
    ✔ reverts if platform fee exceeds 20%

19 passing
```

**Do not deploy if any tests fail.**

---

## Step 6 — Deploy to Base Sepolia

```bash
npm run deploy:testnet -w packages/contracts
```

Expected output:
```
Deploying with: 0xYourWalletAddress
GemGroovesNFT deployed to: 0x...
GemGroovesMarketplace deployed to: 0x...
Marketplace set on NFT contract ✓

=== Deployment Summary ===
NFT:          0x...
Marketplace:  0x...
Platform fee: 2.5 %
```

**Save these addresses!** You'll need them to configure the web app (`apps/web`) — the `sync:web` script will do this automatically once it exists.

---

## Step 7 — Verify contracts on Basescan

```bash
npx hardhat verify --network base-sepolia <NFT_ADDRESS>
```

```bash
npx hardhat verify --network base-sepolia <MARKETPLACE_ADDRESS> \
  "<NFT_ADDRESS>" \
  "250" \
  "<YOUR_WALLET_ADDRESS>" \
  "<USDC_ADDRESS>" \
  "<DAI_ADDRESS>"
```

After verification, you can view your contracts at:
- `https://sepolia.basescan.org/address/<YOUR_CONTRACT_ADDRESS>`

---

## Step 8 — Smoke test on Basescan

1. Go to your **Marketplace** contract on Basescan
2. Click **"Write Contract"** → Connect your wallet
3. Call `listTrack()` with test values:
   - `tokenURI_`: `ipfs://QmTest123`
   - `royaltyBPS`: `1000` (10%)
   - `wallets`: `["your_wallet_address"]`
   - `sharesBPS`: `[10000]`
   - `priceWei`: `10000000000000000` (0.01 ETH in wei)
   - `payToken`: `0x0000000000000000000000000000000000000000` (ETH)
4. Confirm transaction in MetaMask
5. Check **"Read Contract"** → `listings(0)` to confirm listing is active ✓

---

## Deployed Contract Addresses (fill in after deployment)

| Contract | Base Sepolia Address |
|---|---|
| GemGroovesNFT | `0x...` |
| GemGroovesMarketplace | `0x...` |

---

## What's next?

Once deployed and verified → wire up `apps/web` (`VITE_WALLETCONNECT_PROJECT_ID`, `PINATA_JWT`, `VITE_IPFS_GATEWAY`) and run `npm run sync:web` to pull these addresses/ABIs into the frontend config.
