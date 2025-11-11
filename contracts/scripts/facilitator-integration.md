# StreamSave x402 Facilitator Integration

## Architecture Overview

StreamSave uses **deferred x402 payments** for pool-based savings:

1. **Pre-signed Payments**: All participants sign vouchers at pool creation
2. **Deferred Execution**: Facilitator stores vouchers without executing
3. **Scheduled Settlement**: App triggers monthly payouts in rotation order

## Required Facilitator Endpoints

### 1. Submit Deferred Voucher

**Endpoint**: `POST /voucher/submit`
**Purpose**: Store signed x402 payment for later execution

```typescript
// Request
{
  "payer_address": "0xParticipant...",
  "payee_address": "0xPoolContract...",
  "amount": "50000000", // $50 USDC (6 decimals)
  "nonce": "participant_pool_month_unique",
  "valid_until": "2025-12-31T23:59:59Z",
  "signature": "0x...", // EIP-712 signature
  "network": "celo",
  "scheme": "deferred" // ✅ Key: don't execute immediately
}

// Response
{
  "success": true,
  "voucher_id": "uuid-...",
  "stored_at": "2025-01-10T12:00:00Z"
}
```

### 2. Create Pool Schedule (NEW ENDPOINT NEEDED)

**Endpoint**: `POST /streamsave/pool/create`
**Purpose**: Register pool with payout schedule

```typescript
// Request
{
  "pool_id": "pool_celo_12345",
  "participants": [
    {
      "address": "0xAlice...",
      "voucher_nonce": "alice_pool_12345_contribution",
      "monthly_amount": "50000000" // $50 USDC
    },
    // ... 9 more participants
  ],
  "payout_order": [
    "0xAlice...", // Round 1
    "0xBob...",   // Round 2
    // ... remaining 8
  ],
  "cycle_duration_days": 30,
  "start_date": "2025-02-01T00:00:00Z"
}

// Response
{
  "success": true,
  "pool_id": "pool_celo_12345",
  "next_payout_date": "2025-03-01T00:00:00Z",
  "total_locked": "5000000000" // $5,000 USDC (10 people × $50 × 10 months)
}
```

### 3. Execute Monthly Round (NEW ENDPOINT NEEDED)

**Endpoint**: `POST /streamsave/pool/execute-round`
**Purpose**: Trigger monthly payout to current recipient

```typescript
// Request
{
  "pool_id": "pool_celo_12345",
  "round": 1,
  "recipient": "0xAlice...",
  "execution_type": "batch" // aggregate all participant vouchers
}

// Facilitator Actions:
// 1. Fetch all 10 vouchers for this pool
// 2. Validate signatures (EIP-712)
// 3. Aggregate total: 10 × $50 = $500
// 4. Execute EIP-3009 transferWithAuthorization to Alice
// 5. Mark vouchers as settled (settled = true)
// 6. Create settlement record

// Response
{
  "success": true,
  "settlement_id": "uuid-...",
  "tx_hash": "0x...",
  "recipient": "0xAlice...",
  "amount": "500000000", // $500 USDC
  "vouchers_settled": 10,
  "next_round": 2,
  "next_recipient": "0xBob...",
  "next_payout_date": "2025-04-01T00:00:00Z"
}
```

### 4. Get Pool Status

**Endpoint**: `GET /streamsave/pool/:poolId`
**Purpose**: Check pool health and next payout

```typescript
// Response
{
  "pool_id": "pool_celo_12345",
  "status": "active",
  "current_round": 1,
  "total_rounds": 10,
  "participants": 10,
  "monthly_amount": "50000000",
  "total_locked": "5000000000",
  "settled_amount": "500000000",
  "remaining_amount": "4500000000",
  "next_payout": {
    "round": 2,
    "recipient": "0xBob...",
    "amount": "500000000",
    "scheduled_date": "2025-04-01T00:00:00Z"
  },
  "vouchers": {
    "total": 10,
    "settled": 1,
    "pending": 9
  }
}
```

## Database Schema Additions Needed

```sql
-- StreamSave pools table
CREATE TABLE IF NOT EXISTS streamsave_pools (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pool_id TEXT NOT NULL UNIQUE,

  -- Pool configuration
  participants JSONB NOT NULL, -- Array of participant objects
  payout_order TEXT[] NOT NULL, -- Array of addresses in payout order
  cycle_duration_days INTEGER NOT NULL,
  monthly_amount TEXT NOT NULL,

  -- Pool state
  status TEXT NOT NULL DEFAULT 'active', -- 'active', 'completed', 'cancelled'
  current_round INTEGER DEFAULT 0,
  total_rounds INTEGER NOT NULL,

  -- Timing
  start_date TIMESTAMP WITH TIME ZONE NOT NULL,
  next_payout_date TIMESTAMP WITH TIME ZONE NOT NULL,
  completed_at TIMESTAMP WITH TIME ZONE,

  -- Network
  network TEXT NOT NULL DEFAULT 'celo',

  -- Metadata
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  metadata JSONB DEFAULT '{}'::jsonb,

  CONSTRAINT check_pool_status CHECK (status IN ('active', 'completed', 'cancelled'))
);

-- StreamSave pool rounds (execution history)
CREATE TABLE IF NOT EXISTS streamsave_rounds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pool_id TEXT NOT NULL REFERENCES streamsave_pools(pool_id),

  -- Round details
  round_number INTEGER NOT NULL,
  recipient_address TEXT NOT NULL,
  amount TEXT NOT NULL,

  -- Settlement
  settlement_id UUID REFERENCES settlements(id),
  tx_hash TEXT,
  vouchers_settled TEXT[], -- Array of voucher nonces

  -- Status
  status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'settled', 'failed'

  -- Timing
  scheduled_date TIMESTAMP WITH TIME ZONE NOT NULL,
  settled_at TIMESTAMP WITH TIME ZONE,

  -- Metadata
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  CONSTRAINT unique_pool_round UNIQUE (pool_id, round_number),
  CONSTRAINT check_round_status CHECK (status IN ('pending', 'settled', 'failed'))
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_streamsave_pools_pool_id ON streamsave_pools (pool_id);
CREATE INDEX IF NOT EXISTS idx_streamsave_pools_status ON streamsave_pools (status);
CREATE INDEX IF NOT EXISTS idx_streamsave_pools_next_payout ON streamsave_pools (next_payout_date);

CREATE INDEX IF NOT EXISTS idx_streamsave_rounds_pool_id ON streamsave_rounds (pool_id);
CREATE INDEX IF NOT EXISTS idx_streamsave_rounds_status ON streamsave_rounds (status);
CREATE INDEX IF NOT EXISTS idx_streamsave_rounds_scheduled ON streamsave_rounds (scheduled_date);
```

## StreamSave App Integration Flow

```typescript
// 1. Create Pool
const pool = await createPool({
  participants: 10,
  monthlyContribution: 50, // $50
  duration: 10 // months
});

// 2. Each participant signs voucher
for (const participant of pool.participants) {
  const voucher = await signX402Voucher({
    payer: participant.address,
    payee: pool.contractAddress,
    amount: "50000000", // $50 USDC
    nonce: `${participant.address}_${pool.id}_contribution`,
    validUntil: pool.endDate,
    network: "celo"
  });

  // Submit to facilitator (deferred)
  await fetch('https://facilitator.x402hub.xyz/voucher/submit', {
    method: 'POST',
    body: JSON.stringify({
      ...voucher,
      scheme: "deferred" // ✅ Don't execute yet
    })
  });
}

// 3. Register pool with facilitator
await fetch('https://facilitator.x402hub.xyz/streamsave/pool/create', {
  method: 'POST',
  body: JSON.stringify({
    pool_id: pool.id,
    participants: pool.participants,
    payout_order: determinePayoutOrder(), // random/voting/auction
    cycle_duration_days: 30,
    start_date: pool.startDate
  })
});

// 4. Monthly cron job: Execute next round
await fetch('https://facilitator.x402hub.xyz/streamsave/pool/execute-round', {
  method: 'POST',
  body: JSON.stringify({
    pool_id: pool.id,
    round: pool.currentRound + 1,
    recipient: pool.payoutOrder[pool.currentRound]
  })
});
```

## Privacy Considerations

**Zero-Knowledge Nullifiers**: Use keccak256 hashes for privacy

```typescript
// Instead of raw addresses, use nullifiers in payout_order
const nullifier = keccak256(
  abi.encodePacked(
    participantAddress,
    poolId,
    secret // participant's private secret
  )
);

// Pool stores nullifiers, not addresses
payout_order: [
  "0xnullifier1...", // Month 1 (only participant knows it's them)
  "0xnullifier2...", // Month 2
  // ...
]

// When claiming, participant proves they own the nullifier
// Facilitator verifies proof and executes payment
```

## Security Features

1. **Nonce Uniqueness**: Each voucher has unique nonce (prevent double-spend)
2. **EIP-712 Signatures**: Cryptographic proof of participant consent
3. **Valid Until**: Vouchers expire if not executed by deadline
4. **Batch Validation**: All signatures verified before settlement
5. **Atomic Settlement**: Either all vouchers settle or none (transaction reverts)

## Cost Savings

**Without x402 Deferred**:
- 10 participants × 10 months = 100 on-chain transactions
- Gas cost: ~100 × $0.50 = $50

**With x402 Deferred**:
- 10 settlements (1 per month, batched)
- Gas cost: ~10 × $0.50 = $5
- **Savings: 90% ($45)**

## Implementation Priority

1. ✅ **Phase 1**: Use existing `/voucher/submit` endpoint with `scheme: "deferred"`
2. 🔨 **Phase 2**: Add StreamSave-specific endpoints to facilitator
3. 🔨 **Phase 3**: Implement privacy nullifiers
4. 🔨 **Phase 4**: Add quadratic voting for payout order

We can START with Phase 1 immediately using existing infrastructure!
