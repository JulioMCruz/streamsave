# StreamSave Pool Flow - Corrected Architecture

Complete flow showing how StreamSave uses deferred x402 payments for rotating savings pools.

## Two-Signature Architecture

StreamSave Pool requires **TWO sets of x402 vouchers**:

### 1. Contribution Vouchers (Participants → Pool)
Signed by **participants** at pool creation

### 2. Payout Vouchers (Pool → Recipients)
Signed by **app wallet** after payout order determined

---

## Complete Flow Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│ PHASE 1: Pool Creation (Day 0)                                     │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│ Step 1.1: Participants Sign Contribution Vouchers                  │
│ ┌──────────────────────────────────────────────────────────────┐   │
│ │ Alice signs (participant wallet):                            │   │
│ │   voucher = {                                                │   │
│ │     payer: "0xAlice",                                        │   │
│ │     payee: "0xStreamSavePool",  // App's pool wallet        │   │
│ │     amount: "50000000",  // $50 USDC                         │   │
│ │     nonce: "alice_pool_123_contribution",                    │   │
│ │     validUntil: 1735689600  // Dec 31, 2025                  │   │
│ │   }                                                          │   │
│ │   signature: signer._signTypedData(domain, types, voucher)   │   │
│ └──────────────────────────────────────────────────────────────┘   │
│                                                                     │
│ Step 1.2: Submit to Facilitator (DEFERRED - Don't Execute)         │
│ ┌──────────────────────────────────────────────────────────────┐   │
│ │ POST https://facilitator.x402hub.xyz/deferred/verify         │   │
│ │ {                                                            │   │
│ │   "voucher": { ... },                                        │   │
│ │   "signature": "0x...",                                      │   │
│ │   "network": "celo",                                         │   │
│ │   "scheme": "deferred"  // ✅ Key: Store, don't execute     │   │
│ │ }                                                            │   │
│ │                                                              │   │
│ │ Response: { "voucher_id": "uuid-alice-contrib", ... }       │   │
│ └──────────────────────────────────────────────────────────────┘   │
│                                                                     │
│ Repeat for Bob, Carol, ... (10 participants total)                 │
│ Result: 10 contribution vouchers stored in facilitator             │
└─────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│ PHASE 2: Payout Order Selection (Day 1)                            │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│ Step 2.1: App Determines Payout Order                              │
│ ┌──────────────────────────────────────────────────────────────┐   │
│ │ Random: Provably fair shuffle                                │   │
│ │ Voting: Quadratic voting (community decides)                 │   │
│ │ Auction: Highest bidder goes first                           │   │
│ │                                                              │   │
│ │ Result: [Alice, Bob, Carol, ..., Jane]                       │   │
│ └──────────────────────────────────────────────────────────────┘   │
│                                                                     │
│ Step 2.2: App Signs Payout Vouchers (App Private Key)              │
│ ┌──────────────────────────────────────────────────────────────┐   │
│ │ App wallet signs payout for Round 1 (Alice):                 │   │
│ │   payoutVoucher = {                                          │   │
│ │     payer: "0xStreamSavePool",  // App's wallet             │   │
│ │     payee: "0xAlice",                                        │   │
│ │     amount: "500000000",  // $500 (10 × $50)                │   │
│ │     nonce: "pool_123_round_1_alice",                         │   │
│ │     validAfter: 1706745600,  // Feb 1, 2025 00:00 UTC       │   │
│ │     validUntil: 1709251200   // Feb 28, 2025 23:59 UTC      │   │
│ │   }                                                          │   │
│ │   signature: appWallet._signTypedData(...)                   │   │
│ └──────────────────────────────────────────────────────────────┘   │
│                                                                     │
│ Step 2.3: Submit Payout Vouchers to Facilitator                    │
│ ┌──────────────────────────────────────────────────────────────┐   │
│ │ POST /deferred/verify (for each round)                       │   │
│ │ {                                                            │   │
│ │   "voucher": { payer: "pool", payee: "Alice", ... },        │   │
│ │   "signature": "0x...",                                      │   │
│ │   "network": "celo",                                         │   │
│ │   "scheme": "deferred"                                       │   │
│ │ }                                                            │   │
│ │                                                              │   │
│ │ Repeat for all 10 rounds (Bob, Carol, ...)                  │   │
│ └──────────────────────────────────────────────────────────────┘   │
│                                                                     │
│ Result: 10 payout vouchers stored (1 per round)                    │
└─────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│ PHASE 3: Monthly Execution (Months 1-10)                           │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│ Month 1 (Feb 1, 2025): Alice's Turn                                │
│ ──────────────────────────────────────────────────────────────      │
│                                                                     │
│ Step 3.1: Collect Contributions from Participants                  │
│ ┌──────────────────────────────────────────────────────────────┐   │
│ │ POST /deferred/settle                                        │   │
│ │ {                                                            │   │
│ │   "payee": "0xStreamSavePool",  // Pool wallet              │   │
│ │   "payer": null,  // Aggregate from ALL participants        │   │
│ │   "network": "celo",                                         │   │
│ │   "minAmount": "500000000"  // $500 required                │   │
│ │ }                                                            │   │
│ │                                                              │   │
│ │ Facilitator:                                                 │   │
│ │ 1. Fetches 10 unsettled contribution vouchers               │   │
│ │ 2. Validates all EIP-712 signatures                          │   │
│ │ 3. Aggregates: 10 × $50 = $500                              │   │
│ │ 4. Executes EIP-3009 batch transfer:                         │   │
│ │    Alice → Pool ($50)                                        │   │
│ │    Bob → Pool ($50)                                          │   │
│ │    ... → Pool ($50)                                          │   │
│ │    Total: $500 to pool                                       │   │
│ │ 5. Marks vouchers as settled                                 │   │
│ │                                                              │   │
│ │ Response: { "txHash": "0xabc...", "totalAmount": "500..." } │   │
│ └──────────────────────────────────────────────────────────────┘   │
│                                                                     │
│ Step 3.2: Pay Out to Alice                                         │
│ ┌──────────────────────────────────────────────────────────────┐   │
│ │ POST /deferred/settle                                        │   │
│ │ {                                                            │   │
│ │   "payee": "0xAlice",                                        │   │
│ │   "payer": "0xStreamSavePool",                              │   │
│ │   "network": "celo"                                          │   │
│ │ }                                                            │   │
│ │                                                              │   │
│ │ Facilitator:                                                 │   │
│ │ 1. Fetches Alice's payout voucher (round 1)                  │   │
│ │ 2. Validates signature                                       │   │
│ │ 3. Checks validAfter timestamp (Feb 1 ≤ now < Feb 28)       │   │
│ │ 4. Executes EIP-3009 transfer: Pool → Alice ($500)          │   │
│ │ 5. Marks payout voucher as settled                           │   │
│ │                                                              │   │
│ │ Response: { "txHash": "0xdef...", "amount": "500..." }      │   │
│ └──────────────────────────────────────────────────────────────┘   │
│                                                                     │
│ Month 2 (Mar 1, 2025): Bob's Turn                                  │
│ ──────────────────────────────────────────────────────────────      │
│ Same process:                                                       │
│ 1. Collect $500 from participants → pool                            │
│ 2. Pay $500 from pool → Bob                                         │
│                                                                     │
│ ... (Repeat for Carol, David, ... Jane)                            │
│                                                                     │
│ Month 10 (Nov 1, 2025): Jane's Turn (Final Round)                  │
│ Pool completes and closes                                           │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Key Technical Details

### 1. App Wallet (Pool Controller)

The StreamSave app needs its own wallet that:
- Receives monthly contributions from participants
- Signs payout vouchers for each round
- Distributes payouts to recipients on schedule

**Security**: App wallet private key must be:
- Stored securely (AWS KMS, HashiCorp Vault, etc.)
- Only used for signing payout vouchers (not holding funds long-term)
- Rotated after each pool completion

### 2. Voucher Nonce Strategy

**Contribution Vouchers** (participants):
```typescript
nonce = keccak256(
  encodePacked(
    participantAddress,
    poolId,
    "contribution",
    timestamp
  )
)
```

**Payout Vouchers** (app):
```typescript
nonce = keccak256(
  encodePacked(
    poolId,
    round,
    recipientAddress,
    "payout"
  )
)
```

### 3. Timing Windows

Each payout voucher has a **validity window**:
- `validAfter`: Round start date (e.g., Feb 1, 00:00 UTC)
- `validUntil`: Round end date (e.g., Feb 28, 23:59 UTC)

This prevents:
- ❌ Early execution (before round starts)
- ❌ Late execution (after round expires)
- ✅ Ensures predictable monthly schedule

### 4. Gas Savings Analysis

**Traditional Approach** (on-chain every month):
```
10 participants × 10 months × 2 transactions (in + out) = 200 transactions
Gas: 200 × 50,000 = 10,000,000 gas
Cost: 10M × 5 gwei × $0.50 = $0.025 total
```

**Deferred x402 Approach**:
```
10 batched settlements × 2 (in + out) = 20 transactions
Gas: 20 × 100,000 = 2,000,000 gas
Cost: 2M × 5 gwei × $0.50 = $0.005 total

Savings: $0.020 (80% reduction)
```

---

## StreamSave-Specific Endpoints

The `/streamsave/*` endpoints now focus on **orchestration**, not settlement:

### POST /streamsave/pool/create
- Registers pool metadata (participants, payout order, schedule)
- Validates all contribution vouchers exist
- Returns pool_id for tracking

### POST /streamsave/pool/execute-round
- Triggers **TWO** `/deferred/settle` calls:
  1. Collect contributions (participants → pool)
  2. Distribute payout (pool → recipient)
- Updates pool round state
- Returns both transaction hashes

### GET /streamsave/pool/:poolId
- Returns pool status (current round, next payout date)
- Shows contribution and payout transaction history
- Displays remaining rounds

---

## Example: 10-Person StreamSave Pool ($50/month)

### Pool Configuration
```json
{
  "pool_id": "pool_celo_feb2025",
  "participants": 10,
  "monthly_amount": "50000000",
  "total_rounds": 10,
  "cycle_duration": "30 days",
  "payout_order": ["Alice", "Bob", "Carol", ..., "Jane"]
}
```

### Month 1 (Feb 2025)
```
Contributions: 10 × $50 = $500 → Pool wallet
Payout: $500 → Alice
```

### Month 2 (Mar 2025)
```
Contributions: 10 × $50 = $500 → Pool wallet
Payout: $500 → Bob
```

### ... Continue until Month 10

### Month 10 (Nov 2025)
```
Contributions: 10 × $50 = $500 → Pool wallet
Payout: $500 → Jane
Pool closes ✅
```

**Total per participant**:
- Contributed: 10 × $50 = $500
- Received: 1 × $500 = $500
- Net: $0 (fair distribution)

---

## Privacy Enhancement: Zero-Knowledge Nullifiers

Instead of using real addresses in payout_order:

```typescript
// Generate nullifier for each participant
const aliceNullifier = keccak256(
  encodePacked(aliceAddress, poolId, aliceSecret)
);

// Payout order uses nullifiers
payout_order = [
  aliceNullifier,  // Only Alice knows this is her
  bobNullifier,    // Only Bob knows this is him
  // ...
];

// When claiming, participant proves ownership via Merkle proof
const proof = generateMerkleProof(aliceNullifier, merkleTree);
contract.claimPayout(poolId, aliceNullifier, proof);
```

This hides the payout order from public view while maintaining verifiability.

---

## Next Steps

1. **App Wallet Setup**:
   - Generate wallet for pool management
   - Store private key securely (KMS)
   - Fund with CELO for gas

2. **Contribution Flow**:
   - Participants sign contribution vouchers
   - Submit to `/deferred/verify`
   - App validates all 10 vouchers exist

3. **Payout Flow**:
   - App signs 10 payout vouchers
   - Submit to `/deferred/verify`
   - Schedule monthly execution

4. **Execution Automation**:
   - Chainlink Automation triggers monthly
   - Calls `/streamsave/pool/execute-round`
   - Handles both contribution + payout settlements

---

**Status**: Architecture clarified ✅
**Next**: Implement app wallet + test end-to-end flow 🔨
