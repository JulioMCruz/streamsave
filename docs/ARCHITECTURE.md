# StreamSave Technical Architecture

Privacy-first savings pools using x402 deferred payments on Celo.

## System Overview

```
┌──────────────────────────────────────────────────────────────────┐
│                       StreamSave Ecosystem                       │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌────────────┐         ┌─────────────┐         ┌────────────┐  │
│  │  Frontend  │────────▶│ Facilitator │────────▶│   Celo     │  │
│  │  Next.js   │         │   x402      │         │ Blockchain │  │
│  └────────────┘         └─────────────┘         └────────────┘  │
│       │                        │                       │         │
│       │                        │                       │         │
│       ▼                        ▼                       ▼         │
│  ┌────────────┐         ┌─────────────┐         ┌────────────┐  │
│  │   Wagmi    │         │  Supabase   │         │StreamSave  │  │
│  │RainbowKit  │         │  Database   │         │  Contract  │  │
│  └────────────┘         └─────────────┘         └────────────┘  │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

## Core Components

### 1. Frontend (Next.js 14)

**Purpose**: User interface for pool creation, participation, and management

**Key Pages**:
- `/` - Landing page with value proposition
- `/pools` - Browse and join existing pools
- `/pools/create` - Create new savings pool
- `/pools/[id]` - Pool dashboard and status
- `/dashboard` - Personal savings overview

**Technology Stack**:
```json
{
  "framework": "Next.js 14.2.33",
  "styling": "Tailwind CSS 3.4.1",
  "wallet": "RainbowKit 2.1.0 + Wagmi 2.9.0",
  "blockchain": "Viem 2.13.0",
  "network": "Celo Mainnet (42220) + Alfajores (44787)"
}
```

### 2. x402 Facilitator

**Purpose**: Off-chain payment verification and settlement orchestration

**Endpoint**: `https://facilitator.x402hub.xyz`

**Existing Endpoints** (already deployed):
```typescript
POST /voucher/submit
// Submit deferred x402 payment voucher
// Used when participants join pool

GET /voucher/status/:nonce
// Check voucher settlement status

POST /voucher/settle
// Trigger batch settlement (admin only)
```

**New Endpoints Required**:
```typescript
POST /streamsave/pool/create
// Register new pool with facilitator
// Links vouchers to payout schedule

POST /streamsave/pool/execute-round
// Execute monthly payout round
// Aggregates vouchers and settles to recipient

GET /streamsave/pool/:poolId
// Get pool status and next payout info

GET /streamsave/pool/:poolId/rounds
// Get settlement history for pool
```

### 3. StreamSavePool Smart Contract

**Purpose**: On-chain pool state and payment verification

**Deployment**:
- Celo Mainnet: TBD
- Alfajores Testnet: TBD

**Core State**:
```solidity
struct Pool {
  uint256 poolId;
  bytes32 merkleRoot;        // Privacy: participant merkle tree
  uint256 contributionAmount;
  uint256 streamRate;        // Tokens/second for income streaming
  uint256 cycleDuration;     // Seconds between payouts
  uint256 totalParticipants;
  uint256 currentRound;      // 0-indexed payout round
  uint256 lastPayoutTime;
  uint256 totalContributed;
  bool isActive;
  address token;             // USDC on Celo
}

struct Participant {
  uint256 lastStreamTime;
  uint256 totalStreamed;
  bool hasReceivedPayout;
  bool isActive;
}

mapping(uint256 => Pool) public pools;
mapping(uint256 => mapping(bytes32 => Participant)) public participants;
mapping(uint256 => bytes32[]) public poolNullifiers;
```

### 4. Supabase Database

**Purpose**: Facilitator data persistence

**Existing Tables**:
```sql
-- Deferred payment vouchers
vouchers (
  id, payer_address, payee_address,
  amount, nonce, signature,
  valid_until, settled, network, scheme
)

-- Settlement records
settlements (
  id, tx_hash, payee_address, payer_address,
  total_amount, voucher_count, network,
  settled_at, voucher_ids, scheme
)
```

**New Tables Required**:
```sql
-- StreamSave pools
streamsave_pools (
  id, pool_id, participants, payout_order,
  cycle_duration_days, monthly_amount,
  status, current_round, total_rounds,
  start_date, next_payout_date, network
)

-- Pool execution rounds
streamsave_rounds (
  id, pool_id, round_number, recipient_address,
  amount, settlement_id, tx_hash,
  vouchers_settled, status, scheduled_date, settled_at
)
```

## Data Flow

### Pool Creation Flow

```
┌─────────┐                ┌──────────┐              ┌────────────┐
│ User 1  │                │ Frontend │              │Facilitator │
└────┬────┘                └────┬─────┘              └─────┬──────┘
     │                          │                          │
     │  1. Create Pool          │                          │
     ├─────────────────────────▶│                          │
     │                          │                          │
     │                          │  2. Generate Merkle Root │
     │                          │     (participant nullifiers)
     │                          │                          │
     │  3. Sign x402 Voucher    │                          │
     │    (EIP-712)             │                          │
     │◀─────────────────────────┤                          │
     │                          │                          │
     │  4. Submit Voucher       │  5. Store Voucher        │
     │                          ├─────────────────────────▶│
     │                          │     (scheme: deferred)   │
     │                          │                          │
     │                          │◀─────────────────────────┤
     │                          │  6. Voucher Stored       │
     │                          │                          │
     │  [Repeat for Users 2-10] │                          │
     │                          │                          │
     │                          │  7. Register Pool        │
     │                          ├─────────────────────────▶│
     │                          │    (payout_order,        │
     │                          │     voucher_nonces)      │
     │                          │                          │
     │                          │◀─────────────────────────┤
     │  8. Pool Active          │  Pool Created            │
     │◀─────────────────────────┤                          │
     │                          │                          │
```

### Monthly Payout Flow

```
┌──────────┐              ┌────────────┐              ┌──────────┐
│ Frontend │              │Facilitator │              │   Celo   │
└────┬─────┘              └─────┬──────┘              └────┬─────┘
     │                          │                          │
     │  1. Trigger Round        │                          │
     ├─────────────────────────▶│                          │
     │    (pool_id, round)      │                          │
     │                          │                          │
     │                          │  2. Fetch Vouchers       │
     │                          │     (10 participants)    │
     │                          │                          │
     │                          │  3. Validate Signatures  │
     │                          │     (EIP-712)            │
     │                          │                          │
     │                          │  4. Aggregate            │
     │                          │     ($50 × 10 = $500)    │
     │                          │                          │
     │                          │  5. Execute EIP-3009     │
     │                          ├─────────────────────────▶│
     │                          │    transferWithAuth()    │
     │                          │                          │
     │                          │◀─────────────────────────┤
     │                          │  6. TX Confirmed         │
     │                          │                          │
     │                          │  7. Mark Vouchers Settled│
     │                          │                          │
     │◀─────────────────────────┤  8. Update Pool State    │
     │  Payout Complete         │                          │
     │  (tx_hash, recipient)    │                          │
     │                          │                          │
```

## Privacy Architecture

### Zero-Knowledge Nullifiers

**Problem**: Payout order reveals participant identities

**Solution**: Use one-way hashes (nullifiers) instead of addresses

```solidity
// Generate nullifier (off-chain)
bytes32 nullifier = keccak256(
  abi.encodePacked(
    participantAddress,  // User's wallet
    poolId,             // Unique pool ID
    secret              // User's private secret (never shared)
  )
);

// Participant proves ownership (on-chain)
function claimPayout(
  uint256 _poolId,
  bytes32 _nullifier,
  bytes32[] calldata _merkleProof
) external {
  // 1. Verify nullifier is in merkle tree
  require(_verifyMerkleProof(_merkleProof, pool.merkleRoot, _nullifier));

  // 2. Check if it's this nullifier's turn
  bytes32 currentRecipient = poolNullifiers[_poolId][pool.currentRound];
  require(_nullifier == currentRecipient);

  // 3. Execute payout to msg.sender
  IERC20(pool.token).transfer(msg.sender, payoutAmount);
}
```

**Privacy Guarantees**:
- ✅ No one knows who is in the pool (except pool creator during setup)
- ✅ Payout order is public, but unlinkable to real identities
- ✅ Only the recipient knows when it's their turn
- ✅ Facilitator cannot correlate payments to identities

### Merkle Tree Construction

```typescript
// Off-chain (frontend generates)
const participants = [
  "0xAlice...",
  "0xBob...",
  // ... 8 more
];

const secrets = participants.map(() => randomBytes(32));

const nullifiers = participants.map((addr, i) =>
  keccak256(encodePacked(addr, poolId, secrets[i]))
);

const merkleTree = new MerkleTree(nullifiers, keccak256);
const merkleRoot = merkleTree.getRoot();

// Store in contract
contract.createPool(
  merkleRoot,
  contributionAmount,
  streamRate,
  cycleDuration,
  totalParticipants,
  tokenAddress
);

// Each participant stores their secret locally
localStorage.setItem(`pool_${poolId}_secret`, secrets[i]);
```

## x402 Integration

### EIP-712 Voucher Structure

```typescript
const domain = {
  name: 'x402 Payment Voucher',
  version: '1',
  chainId: 42220, // Celo Mainnet
  verifyingContract: facilitatorAddress
};

const types = {
  Voucher: [
    { name: 'payer', type: 'address' },
    { name: 'payee', type: 'address' },
    { name: 'amount', type: 'uint256' },
    { name: 'nonce', type: 'string' },
    { name: 'validUntil', type: 'uint256' }
  ]
};

const value = {
  payer: participantAddress,
  payee: poolContractAddress,
  amount: '50000000', // $50 USDC (6 decimals)
  nonce: `${participantAddress}_${poolId}_month_${month}`,
  validUntil: Math.floor(Date.now() / 1000) + 31536000 // +1 year
};

const signature = await signer._signTypedData(domain, types, value);
```

### Deferred vs. Exact Payment

```typescript
// Deferred (StreamSave uses this)
POST /voucher/submit
{
  "scheme": "deferred",
  // Voucher stored in database
  // NOT executed immediately
  // Settled later via /streamsave/pool/execute-round
}

// Exact (traditional x402)
POST /voucher/submit
{
  "scheme": "exact",
  // Voucher validated
  // EIP-3009 executed IMMEDIATELY
  // Settlement confirmed in response
}
```

## Security Model

### Threat Model

**Threats**:
1. **Double-spend**: Participant reuses same voucher
2. **Replay attack**: Voucher replayed on different network
3. **Front-running**: Malicious actor sees payout transaction and claims first
4. **Facilitator compromise**: Facilitator executes vouchers to wrong recipients
5. **Sybil attack**: One person creates multiple fake participants

**Mitigations**:
1. **Nonce uniqueness** enforced in database
2. **Chain ID** in EIP-712 signature
3. **Nullifier verification** on-chain (only rightful owner can claim)
4. **Merkle proofs** cryptographically prove membership
5. **Self Protocol** verification (proof-of-unique-human)

### Trust Assumptions

**Minimized Trust**:
- ✅ Smart contract is trustless (code is law)
- ✅ Signatures are cryptographically verified
- ✅ Merkle proofs are mathematically sound

**Required Trust**:
- ⚠️  Facilitator executes vouchers correctly
- ⚠️  Facilitator doesn't censor payout requests
- ⚠️  Frontend accurately generates merkle trees

**Future: Eliminate Trust**:
- 🔮 **Decentralized facilitator**: Multiple nodes validate settlements
- 🔮 **On-chain merkle verification**: Contract stores root, validates proofs
- 🔮 **Automated execution**: Chainlink Automation triggers monthly payouts

## Performance & Scalability

### Gas Costs (Celo Mainnet)

```
Operation                    | Gas Used  | Cost (CELO @ $0.50)
-----------------------------|-----------|--------------------
Create Pool                  | ~200,000  | $0.10
Join Pool (first)            | ~150,000  | $0.075
Join Pool (subsequent)       | ~50,000   | $0.025
Claim Payout (no merkle)     | ~100,000  | $0.05
Claim Payout (with merkle)   | ~150,000  | $0.075
Stream Contribution          | ~80,000   | $0.04

10-person pool (10 months):
- Setup: 10 × $0.075 = $0.75
- Payouts: 10 × $0.075 = $0.75
- Total: $1.50 for $5,000 in transactions
- Fee: 0.03%
```

### Throughput

**Celo Network**:
- Block time: ~5 seconds
- TPS: ~1,000 transactions/second
- Finality: ~10 seconds (soft), ~1 minute (hard)

**StreamSave Capacity**:
- 1,000 pools/block × 12 blocks/minute = **12,000 pools/minute**
- 1,000 payouts/block × 12 blocks/minute = **12,000 payouts/minute**

**Year 1 Target**: 50,000 pools = 0.003% of capacity

## Future Enhancements

### Phase 3: DeFi Yield Integration

```solidity
// Deposit pooled funds into Aave
function _depositToAave(uint256 _amount) internal {
  aaveLendingPool.deposit(
    usdcAddress,
    _amount,
    address(this),
    0
  );
}

// Withdraw on payout + accumulated interest
function claimPayout(...) external {
  uint256 principal = poolPayoutAmount;
  uint256 interest = aaveLendingPool.getReserveNormalizedIncome(usdcAddress);

  // Withdraw principal + interest
  aaveLendingPool.withdraw(usdcAddress, principal + interest, recipient);
}
```

### Phase 4: Quadratic Voting

```solidity
// Participants vote on payout order
function voteForPayoutOrder(
  uint256 _poolId,
  bytes32[] calldata _preferredOrder,
  uint256 _voteWeight
) external {
  // Quadratic cost: votes² tokens required
  uint256 voteCost = _voteWeight ** 2;
  require(balanceOf[msg.sender] >= voteCost);

  // Record vote
  votes[_poolId][msg.sender] = _preferredOrder;
  voteWeights[_poolId][msg.sender] = _voteWeight;
}

// Aggregate votes (quadratic funding style)
function finalizePayoutOrder(uint256 _poolId) external {
  // Calculate quadratic-weighted consensus
  bytes32[] memory finalOrder = _computeQuadraticConsensus(_poolId);
  poolNullifiers[_poolId] = finalOrder;
}
```

### Phase 5: Cross-Chain Pools

```solidity
// Participant on Polygon, pool on Celo
function joinCrossChainPool(
  uint256 _poolId,
  bytes32 _nullifier,
  bytes calldata _crossChainProof // LayerZero/Wormhole message
) external {
  // Verify cross-chain message
  require(_verifyCrossChainProof(_crossChainProof));

  // Add participant from different chain
  participants[_poolId][_nullifier] = Participant({...});
}
```

## Deployment Checklist

### Testnet (Alfajores)
- [ ] Deploy StreamSavePool contract
- [ ] Verify contract on Celoscan
- [ ] Test pool creation flow
- [ ] Test voucher submission to facilitator
- [ ] Test monthly payout execution
- [ ] Test merkle proof generation/verification
- [ ] Load test with 20-person pool

### Mainnet (Celo)
- [ ] Security audit (OpenZeppelin or CertiK)
- [ ] Deploy to Celo Mainnet
- [ ] Verify contract on Celoscan
- [ ] Transfer ownership to multisig
- [ ] Set up Chainlink Automation for payouts
- [ ] Configure facilitator with mainnet endpoints
- [ ] Deploy frontend to Vercel
- [ ] Set up monitoring (Sentry + Grafana)

---

**Architecture Version**: 1.0
**Last Updated**: January 2025
**Status**: Phase 1 Complete, Phase 2 In Progress
