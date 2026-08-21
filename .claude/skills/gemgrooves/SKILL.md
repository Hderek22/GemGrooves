---
name: gemgrooves
description: Reference guide for the GemGrooves repo — monorepo layout, The Studio DAW architecture, minting/marketplace flow, Solidity contracts, and persistence. Use when working on GemGrooves (apps/web or packages/contracts) so changes land in the right place and follow existing patterns.
---

# GemGrooves reference

Web3 music platform: musicians record/mix tracks in a browser DAW ("The
Studio"), mint them as ERC-721 NFTs with on-chain royalty splits, sell them
in a marketplace ("The Record Shop"), and owners play their collection back
("The Lounge").

Keep this file current — see "Keeping this skill current" at the bottom.

## Monorepo layout

- `apps/web` — Vite + React 18 + TypeScript frontend, npm workspace `@gemgrooves/web`
- `packages/contracts` — Solidity contracts + Hardhat tests
- Root scripts: `npm run dev` (starts apps/web), `npm run build`,
  `npm run typecheck`, `npm run test:contracts`, `npm run sync:web`
  (regenerates `apps/web/src/config/contracts.generated.ts` from compiled
  contracts — run after any contract ABI/address change)

## Pages (`apps/web/src/pages`)

- `Home.tsx` — landing page, CTAs to Studio/Record Shop/Lounge
- `TheStudio.tsx` — the DAW: multitrack recorder/mixer + NFT minting form
- `TheRecordShop.tsx` — marketplace browse (`useListings`)
- `TheLounge.tsx` — owned-track playback (`useOwnedTracks`)
- `OurPurpose.tsx` — static mission page
- `Root.tsx` / `Error.tsx` — layout shell + 404/error boundary

## The Studio (DAW) architecture

- `hooks/useMultiTrackSession.ts` — core session state: tracks, transport
  (play/pause/stop/record), BPM/count-in, mixdown rendering
- `lib/audioEngine.ts` — Web Audio primitives: `PlaybackController`
  (schedules multi-track playback against one shared clock),
  `renderMixdown` (OfflineAudioContext export), `audioBufferToWav`,
  `playCountIn`
- `hooks/useMicRecorder.ts` — `MediaRecorder`/`getUserMedia` wrapper
- `hooks/useSessionPersistence.ts` — Supabase-backed save/load of sessions
  and tracks (see `apps/web/supabase/schema.sql`)
- Components: `Transport`, `Timeline`, `TrackRow` (per-track
  mute/solo/loop/gain/drag), `SessionPicker`, `Waveform`

### StudioTrack model

Fields: `id, name, blob, buffer, durationSec, gain, muted, solo, offsetSec,
looped, remoteId?, storagePath?`.

Adding a new per-track property touches ~5 places — check all of them:
1. `StudioTrack` interface + `TrackPatch` (`useMultiTrackSession.ts`)
2. `toPlaybackTracks()` mapping and the `addTrack` default
3. `PlaybackTrack`/`MixdownTrack` in `lib/audioEngine.ts` if playback/export needs it
4. `useSessionPersistence.ts` save (insert + update) and load mapping
5. `apps/web/supabase/schema.sql` — add the column to `create table`, plus
   an idempotent `alter table studio_tracks add column if not exists ...`
   for databases created before the change (the `create table if not
   exists` only applies to a fresh database)

### Loop pedal

Tracks can be toggled to loop indefinitely (Boss RC-pedal style) via
TrackRow's 🔁 button, so other tracks can be dubbed on top. Implemented via
`AudioBufferSourceNode.loop` in `PlaybackController.play`/`renderMixdown`;
the `useMultiTrackSession` tick effect suspends its normal
auto-stop-at-session-end behavior while any track is looped.

## Minting / on-chain flow

- `hooks/useIpfsUpload.ts` — uploads audio + metadata JSON to IPFS via
  `POST /api/pin` (Vercel function)
- `hooks/useMintTrack.ts` — calls `GemGroovesMarketplace.listTrack` via
  wagmi `writeContractAsync`
- `hooks/usePayTokenOptions.ts` — resolves accepted payment tokens (ETH +
  configured USDC/DAI)
- `config/contracts.generated.ts` — **auto-generated, do not hand-edit**;
  regenerate via `npm run sync:web` after contract changes
- `lib/wagmi.ts` — RainbowKit/wagmi chain config (hardhat + baseSepolia in
  dev, baseSepolia + base in prod)

## Marketplace / collection

- `hooks/useListings.ts` — active marketplace listings (`useReadContracts`)
- `hooks/useOwnedTracks.ts` — connected wallet's owned NFTs (iterates
  `totalSupply`)
- `hooks/useBuyTrack.ts` — approve+buy flow (ERC-20/ETH)
- `hooks/useTrackMetadata.ts` — fetches IPFS metadata JSON

## Contracts (`packages/contracts/contracts`)

- `GemGroovesNFT.sol` — ERC-721 + EIP-2981 royalties, deploys a
  `TrackSplitter` per token
- `GemGroovesMarketplace.sol` — primary-sale marketplace (ETH/USDC/DAI),
  platform fee, routes proceeds through `TrackSplitter`
- `TrackSplitter.sol` — per-track proportional payout splitter
- Tests: `packages/contracts/test/GemGrooves.test.js` (Hardhat/Mocha); run
  via `npm run test:contracts`
- Deployment: `packages/contracts/DEPLOY.md` (Base Sepolia)

## Persistence (Supabase)

`apps/web/supabase/schema.sql` defines `studio_sessions`/`studio_tracks`
with intentionally open RLS policies (draft session data, not funds — see
the comment at the top of that file for the reasoning, revisit once
collaborator invites are added). The file is meant to be re-run against a
live database after schema changes, so keep new columns idempotent
(`alter table ... add column if not exists ...`) rather than only adding
them to the `create table` statement.

## Conventions

- CSS Modules per component (`Component.module.css`), plus shared
  `styles/buttons.module.css` and `styles/layout.module.css`
- No frontend test suite in `apps/web` yet — only `npm run typecheck` is
  wired up; `packages/contracts` has a real Hardhat test suite
- No CLAUDE.md/README beyond this skill — this file is the primary
  reference for the project

## Keeping this skill current

After a commit+push that changes how any of the above works (new feature,
schema change, architecture change, new page/hook/contract), update the
relevant section here in the same push. Skip it for changes that don't
affect this reference (typo fixes, pure styling tweaks, dependency bumps).
