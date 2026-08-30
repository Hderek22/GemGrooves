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
  (schedules multi-track playback against one shared clock, through a
  per-track FX chain into a master bus), `renderMixdown`
  (OfflineAudioContext export, same FX-chain/master-bus graph),
  `audioBufferToWav`, `playCountIn`
- `hooks/useMicRecorder.ts` — `MediaRecorder`/`getUserMedia` wrapper
- `hooks/useSessionPersistence.ts` — Supabase-backed save/load of sessions
  and tracks (see `apps/web/supabase/schema.sql`), plus realtime
  collaborator sync and session sharing/joining (see Collaboration below)
- Components: `Transport`, `Timeline`, `TrackRow` (per-track
  mute/solo/loop/gain/drag/FX), `EffectsPanel`, `SessionPicker`, `Waveform`

### StudioTrack model

Fields: `id, name, blob, buffer, durationSec, gain, muted, solo, offsetSec,
looped, fx, playbackRate, sourceLoopId?, remoteId?, storagePath?`.

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

### Per-track effects chain + master bus

Every track always runs through the full chain — `gain -> 3-band EQ
(BiquadFilterNode ×3) -> DynamicsCompressorNode -> [dry/reverb-wet
ConvolverNode mix] -> output`, then every track's `output` feeds one shared
master `GainNode` that connects to the actual destination (live
`ctx.destination` or offline `offlineCtx.destination`). There's no
conditional bypass-by-omission: `TrackFx`'s default values
(`DEFAULT_TRACK_FX` in `audioEngine.ts`) are chosen to be audibly
transparent (0dB EQ gains, compressor `ratio: 1` = no gain reduction ever,
`reverbWetPct: 0`) so a parameter change during live playback never needs
to rebuild the graph — just `applyTrackFxParams`, the same live-patch
pattern `updateLiveMix` already used for gain/mute/solo. `buildTrackFxChain`
in `audioEngine.ts` is the one function both `PlaybackController.play` and
`renderMixdown` call, since `AudioContext`/`OfflineAudioContext` both
satisfy `BaseAudioContext` — keeping live/offline parity by construction
rather than by convention. Reverb uses a synthetic noise-decay impulse
response generated in code (`buildImpulseResponse`), not a bundled asset.

### Tempo-aware loop library

`lib/loopLibrary.ts` defines a small built-in loop pack — **synthesized in
code at import time** (simple kick/hat/bass patterns via oscillators and
filtered noise, `renderLoopAudio()` bounces one to a WAV `Blob` via an
`OfflineAudioContext`), not bundled audio assets. No licensing concerns,
and it exercises the same tempo-sync path a real sample pack would need.
`LoopBrowser` (toggled from `TheStudio.tsx`) adds a loop at the current
playhead via the ordinary `addTrack()` path — no special-cased "loop
track" concept in the data model, just a `StudioTrack` with `looped: true`
and `playbackRate = sessionBpm / loop.bpm`.

`playbackRate` is threaded through `PlaybackTrack`/`MixdownTrack` in
`audioEngine.ts` and is the **first place `StudioTrack.durationSec` means
something other than `buffer.duration`**: `durationSec` is the wall-clock
(tempo-adjusted) duration everywhere it's used (timeline clip width,
`sessionDurationSec`), so `addTrack()` computes it as `buffer.duration /
playbackRate` rather than storing the raw buffer length. Every existing
caller passes the default `playbackRate = 1`, at which point this is
identical to before — no behavior change for non-loop tracks.

`PlaybackController.play`'s loop-scheduling math needed care: buffer
duration and playback position are in different units once
`playbackRate != 1` (position is wall-clock seconds; `source.start()`'s
offset argument is buffer-native seconds, unaffected by playback rate) —
see the comments there before touching that method again.

### One-click auto-master

`audioEngine.ts`'s `applyAutoMaster(buffer)` is a post-processing step
over an already-rendered mixdown, not folded into `renderMixdown` itself:
it scans the buffer's own PCM samples directly for peak (no render pass
needed just to measure it), computes a pre-gain to bring that peak up to
~90% full scale, then runs one more offline render through a fixed glue
compressor + `WaveShaperNode` soft-clip saturator. No manual knobs — "auto"
means the gain-staging is derived from the audio itself. Toggled via
Transport's "Auto-master" checkbox (`TheStudio.tsx`'s `autoMaster` state),
which `useMultiTrackSession.ts`'s `renderMixdownFile(autoMaster)` applies
before WAV-encoding — used at both mixdown call sites (mint flow, manual
download). Web Audio has no true brickwall limiter, so this is explicitly
"loudness-maximizer lite," not real mastering — said plainly in the UI
tooltip too.

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

`apps/web/supabase/schema.sql` defines `studio_sessions`/`studio_tracks`/
`studio_session_collaborators`, RLS-scoped per session (see Collaboration
below for the exact model). The file is meant to be re-run against a live
database after schema changes, so keep new columns idempotent (`alter
table ... add column if not exists ...`) rather than only adding them to
the `create table` statement — and likewise every `create policy` is
preceded by `drop policy if exists`, since Postgres has no `create policy
if not exists`.

## Auth: Sign-In with Ethereum (Studio Phase 3, part 1)

Wallet identity is a plain `owner_wallet` text column — no RLS policy can
safely key off it without some proof the client controls that wallet.
`useSiweAuth.ts` drives the flow from a "Sign in to collaborate" button in
`TheStudio.tsx`: fetch a nonce, sign a message, exchange the signature for
a Supabase-compatible JWT. Session save/load now **requires** this — RLS
keys off `auth.jwt()->>'sub'`, which is only populated once signed in.

- `api/_lib/siwe.ts` — nonce issuance (stored in `siwe_nonces`, single-use,
  5min TTL) + signature verification (`viem`'s `verifyMessage`) + JWT
  minting (`jose`, HS256, `sub` = lowercased wallet, `role: authenticated`)
- `api/siwe-nonce.ts` / `api/siwe-verify.ts` — thin Vercel handlers over
  the above
- `api/_lib/supabaseAdmin.ts` — service-role client for the nonce table
  only; **must** pass the `ws` package as the realtime `transport` option,
  or `createClient` throws ("native WebSocket not found") on any Node
  version below 22, even though this code never touches Realtime
- `src/lib/supabase.ts` — the exported `supabase` client is a mutable
  `let`; `setSupabaseAuthToken(token)` swaps in an authenticated client
  **and** calls `client.realtime.setAuth(token)` — the `global.headers`
  override only covers REST/Storage, Realtime's websocket needs its auth
  set separately or RLS-scoped subscriptions silently receive nothing
- `vite.config.ts`'s dev middleware (originally `/api/pin`-only) is now a
  generic `apiDevMiddleware()` helper — reuse it for any new `/api/*`
  Vercel function so it also works under plain `npm run dev`
- Any new file imported (even transitively) by `vite.config.ts` or an
  `api/_lib/*.ts` must also be added to `tsconfig.node.json`'s `include`
  list — `npm run typecheck` won't catch a missing entry, only `npm run
  build` (`tsc -b`) does, since project-references mode is stricter about
  explicit file lists than plain `tsc --noEmit`

## Collaboration (Studio Phase 3, part 2)

A session's owner (`owner_wallet`) or an accepted collaborator
(`studio_session_collaborators`) can read/write it; anyone else can, at
most, see that a link-shared session (`studio_sessions.is_shared`) exists —
enough to decide whether to join.

- **Sharing**: `SessionPicker`'s "Share session" button calls
  `useSessionPersistence`'s `shareSession()`, which sets `is_shared = true`
  and returns a `/TheStudio/:sessionId` link (route added in `App.tsx`).
- **Joining**: opening that link (`TheStudio.tsx` reads the `:sessionId`
  route param via `useParams`) calls `joinSession(id)` once signed in —
  self-service insert into `studio_session_collaborators` (RLS only allows
  a wallet to add *itself*, and only while `is_shared` is true), then loads
  the session.
- **Realtime sync is save-triggered, not live-per-keystroke** (a
  deliberate choice — The Studio has no autosave, to avoid the
  debounce/race-condition bugs autosave would reintroduce). A
  `postgres_changes` subscription on `studio_tracks`/`studio_sessions`,
  scoped to the current `sessionId`, fires whenever *any* member saves;
  `useMultiTrackSession`'s `applyRemoteTrackSync()` merges the change in
  without the full-replace `loadTracks()` does (which would also wipe out
  a collaborator's own not-yet-saved local edits).
- **RLS helper functions** (`studio_session_is_member`,
  `studio_session_is_member_of`, `studio_session_is_shared`,
  `storage_path_session_id` in `schema.sql`) exist because a policy
  referencing another RLS-protected table would itself get filtered by
  that table's RLS for the querying role — `security definer` bypasses
  that. **Gotcha hit during verification**: `studio_sessions`' own
  select/update policies must NOT re-query `studio_sessions` from inside
  their helper function — `insert ... returning` evaluates the return
  row's SELECT policy using the insert statement's own snapshot, and a
  security-definer function that re-queries the table currently being
  inserted into can miss the just-inserted row under that snapshot (insert
  succeeds, the chained `.select()` on it inexplicably fails RLS). Fixed
  by `studio_session_is_member_of(id, owner_wallet)` taking the row's own
  columns as arguments instead of looking the row up again.
- Verified end-to-end with three scripted wallets (owner, invited
  collaborator, uninvited stranger) against a live Supabase project,
  including a live realtime delivery check — not just RLS unit checks.

## Conventions

- CSS Modules per component (`Component.module.css`), plus shared
  `styles/buttons.module.css` and `styles/layout.module.css`
- No frontend test suite in `apps/web` yet — only `npm run typecheck` is
  wired up; `packages/contracts` has a real Hardhat test suite
- No CLAUDE.md — this file is the primary technical reference; the root
  `README.md` has a user-facing "Collaborators guide" for The Studio's
  sharing feature, kept in sync with what's actually shipped

## Keeping this skill current

After a commit+push that changes how any of the above works (new feature,
schema change, architecture change, new page/hook/contract), update the
relevant section here in the same push. Skip it for changes that don't
affect this reference (typo fixes, pure styling tweaks, dependency bumps).
