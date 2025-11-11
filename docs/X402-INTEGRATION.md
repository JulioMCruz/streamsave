# StreamSave x402 Protocol Integration

Complete guide to using x402 HTTP 402 Payment Required protocol with StreamSave pools.

## x402 Protocol Overview

x402 extends the HTTP 402 status code to enable **native web payments** with blockchain settlement.

### Core Concepts

**HTTP 402 Payment Required**:
- Standard HTTP status code reserved for future use
- x402 unlocks it for machine-to-machine payments
- Pay-per-use APIs without traditional accounts

**Facilitator Role**:
- **Verify** payments: Validate client payment payloads
- **Settle** transactions: Submit validated payments to blockchain
- **Non-custodial**: Does NOT hold funds, only executes signed transactions

## StreamSave x402 Flow

### Standard x402 Flow (Immediate Payment)

```http
1. Client Request
GET /api/data HTTP/1.1
Host: vendor.com

2. Server Response: 402 Payment Required
HTTP/1.1 402 Payment Required
X-Vendor-URL: https://vendor.com
X-Payment-Required: true
X-Payment-Amount: 1000000
X-Payment-Token: USDC
X-Payment-Network: celo
X-Facilitator-URL: https://facilitator.x402hub.xyz

3. Client Prepares Payment
- Signs EIP-712 payment payload
- Amount: 1000000 (0.001 USDC, 6 decimals)
- Signature: 0x...

4. Client Resubmits with Payment
GET /api/data HTTP/1.1
Host: vendor.com
X-Payment-Signature: 0x...
X-Payment-Payload: {...}

5. Server Verifies & Settles
- Sends to facilitator for verification
- Facilitator executes EIP-3009 transferWithAuthorization
- Server provides resource
```

### StreamSave x402 Flow (Deferred Payment)

**Key Innovation**: Pre-sign payments, execute later in batches

```http
┌──────────────────────────────────────────────────────────┐
│ Phase 1: Pool Creation - Pre-sign 10 months of payments │
└──────────────────────────────────────────────────────────┘

1. Client (Alice) Signs Voucher
POST /voucher/submit HTTP/1.1
Host: facilitator.x402hub.xyz
Content-Type: application/json

{
  "payer_address": "0xAlice...",
  "payee_address": "0xPoolContract...",
  "amount": "50000000",  // $50 USDC (6 decimals)
  "nonce": "alice_pool_123_month_all",
  "valid_until": 1735689600,  // 2025-12-31
  "signature": "0x...",  // EIP-712 signature
  "network": "celo",
  "scheme": "deferred"  // ✅ Key: don't execute now
}

2. Facilitator Stores (Not Executes)
HTTP/1.1 200 OK
{
  "success": true,
  "voucher_id": "uuid-...",
  "stored_at": "2025-01-10T12:00:00Z",
  "settled": false  // ✅ Marked as unsettled
}

┌──────────────────────────────────────────────────────────┐
│ Phase 2: Monthly Execution - Facilitator settles batch   │
└──────────────────────────────────────────────────────────┘

3. App Triggers Round 1 Payout
POST /streamsave/pool/execute-round HTTP/1.1
Host: facilitator.x402hub.xyz
Content-Type: application/json

{
  "pool_id": "pool_123",
  "round": 1,
  "recipient": "0xAlice..."
}

4. Facilitator Executes
- Fetches 10 vouchers (all participants)
- Validates all EIP-712 signatures
- Aggregates: 10 × $50 = $500
- Calls EIP-3009: transferWithAuthorization(Alice, 500 USDC)
- Marks vouchers as settled

5. Facilitator Response
HTTP/1.1 200 OK
{
  "success": true,
  "settlement_id": "uuid-...",
  "tx_hash": "0x123abc...",
  "recipient": "0xAlice...",
  "amount": "500000000",
  "vouchers_settled": 10,
  "next_round": 2,
  "next_recipient": "0xBob...",
  "next_payout_date": "2025-02-10T00:00:00Z"
}
```

## EIP-712 Signature Structure

### Domain Separator

```typescript
const domain = {
  name: 'x402 Payment Voucher',
  version: '1',
  chainId: 42220,  // Celo Mainnet
  verifyingContract: facilitatorAddress  // 0x...
};
```

### Voucher Types

```typescript
const types = {
  Voucher: [
    { name: 'payer', type: 'address' },
    { name: 'payee', type: 'address' },
    { name: 'amount', type: 'uint256' },
    { name: 'nonce', type: 'string' },
    { name: 'validUntil', type: 'uint256' }
  ]
};
```

### Value Object

```typescript
const value = {
  payer: participantAddress,         // 0xAlice...
  payee: poolContractAddress,        // 0xPool...
  amount: '50000000',                // $50 USDC (6 decimals)
  nonce: 'alice_pool_123_month_1',  // Unique per payment
  validUntil: 1735689600            // Unix timestamp
};
```

### Signing

```typescript
import { ethers } from 'ethers';

const signer = await provider.getSigner();
const signature = await signer._signTypedData(domain, types, value);

// Submit to facilitator
await fetch('https://facilitator.x402hub.xyz/voucher/submit', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    payer_address: value.payer,
    payee_address: value.payee,
    amount: value.amount,
    nonce: value.nonce,
    valid_until: new Date(value.validUntil * 1000).toISOString(),
    signature: signature,
    network: 'celo',
    scheme: 'deferred'
  })
});
```

## Network Support

### Celo Network (Custom Facilitator)

**Important**: Celo is NOT in the official x402 network list, but our **Custom402Facilitator** supports it!

**Facilitator URL**: `https://facilitator.x402hub.xyz`

**Supported Networks**:
- ✅ Celo Mainnet (Chain ID: 42220)
- ✅ Alfajores Testnet (Chain ID: 44787)
- ✅ Base, Arbitrum, Polygon, Avalanche, Abstract

**USDC Addresses**:
```typescript
const USDC_ADDRESSES = {
  celo: '0xcebA9300f2b948710d2653dD7B07f33A8B32118C',  // Native USDC
  alfajores: '0x2F25deB3848C207fc8E0c34035B3Ba7fC157602B'  // Test USDC
};
```

### EIP-3009 Support

Celo's native USDC implements EIP-3009: `transferWithAuthorization`

```solidity
interface IERC3009 {
  function transferWithAuthorization(
    address from,
    address to,
    uint256 value,
    uint256 validAfter,
    uint256 validBefore,
    bytes32 nonce,
    uint8 v,
    bytes32 r,
    bytes32 s
  ) external;
}
```

**Benefits**:
- ✅ Gasless transactions (meta-transactions)
- ✅ Facilitator pays gas, deducts from payment
- ✅ Users don't need native CELO for gas

## Facilitator Endpoints

### Existing Endpoints (Production)

#### 1. Submit Voucher

```http
POST /voucher/submit
Content-Type: application/json

{
  "payer_address": "0x...",
  "payee_address": "0x...",
  "amount": "50000000",
  "nonce": "unique_string",
  "valid_until": "2025-12-31T23:59:59Z",
  "signature": "0x...",
  "network": "celo",
  "scheme": "deferred"  // or "exact" for immediate
}

Response:
{
  "success": true,
  "voucher_id": "uuid",
  "stored_at": "2025-01-10T12:00:00Z"
}
```

#### 2. Get Voucher Status

```http
GET /voucher/status/:nonce

Response:
{
  "voucher_id": "uuid",
  "nonce": "...",
  "settled": false,
  "amount": "50000000",
  "payer": "0x...",
  "payee": "0x...",
  "created_at": "2025-01-10T12:00:00Z"
}
```

### Required New Endpoints (StreamSave-specific)

#### 3. Create Pool

```http
POST /streamsave/pool/create
Content-Type: application/json

{
  "pool_id": "pool_celo_123",
  "participants": [
    {
      "address": "0xAlice...",
      "voucher_nonce": "alice_pool_123",
      "monthly_amount": "50000000"
    },
    // ... 9 more
  ],
  "payout_order": ["0xAlice...", "0xBob...", ...],
  "cycle_duration_days": 30,
  "start_date": "2025-02-01T00:00:00Z"
}

Response:
{
  "success": true,
  "pool_id": "pool_celo_123",
  "next_payout_date": "2025-03-01T00:00:00Z",
  "total_locked": "5000000000"
}
```

#### 4. Execute Round

```http
POST /streamsave/pool/execute-round
Content-Type: application/json

{
  "pool_id": "pool_celo_123",
  "round": 1,
  "recipient": "0xAlice..."
}

Response:
{
  "success": true,
  "settlement_id": "uuid",
  "tx_hash": "0x...",
  "recipient": "0xAlice...",
  "amount": "500000000",
  "vouchers_settled": 10,
  "next_round": 2,
  "next_recipient": "0xBob...",
  "next_payout_date": "2025-04-01T00:00:00Z"
}
```

#### 5. Get Pool Status

```http
GET /streamsave/pool/:poolId

Response:
{
  "pool_id": "pool_celo_123",
  "status": "active",
  "current_round": 1,
  "total_rounds": 10,
  "participants": 10,
  "monthly_amount": "50000000",
  "total_locked": "5000000000",
  "settled_amount": "500000000",
  "next_payout": {
    "round": 2,
    "recipient": "0xBob...",
    "amount": "500000000",
    "scheduled_date": "2025-04-01T00:00:00Z"
  }
}
```

## Security Considerations

### Nonce Strategy

**Problem**: Prevent double-spend attacks

**Solution**: Unique nonces per voucher

```typescript
// Good: Unique per participant per pool per month
const nonce = `${participantAddress}_${poolId}_${month}`;

// Better: Add random component
const nonce = `${participantAddress}_${poolId}_${month}_${randomBytes(16)}`;

// Best: Cryptographic hash
const nonce = keccak256(
  encodePacked(participantAddress, poolId, month, timestamp)
);
```

### Signature Validation

**Facilitator verifies**:
1. ✅ EIP-712 signature is valid (cryptographic proof)
2. ✅ Nonce hasn't been used (database check)
3. ✅ Voucher hasn't expired (validUntil > now)
4. ✅ Payer has sufficient USDC balance
5. ✅ Payer has approved facilitator to spend USDC

### Privacy via Nullifiers

**Problem**: Payout order reveals identities

**Solution**: Use keccak256 nullifiers instead of addresses

```typescript
// Generate nullifier (off-chain)
const nullifier = keccak256(
  encodePacked(participantAddress, poolId, secret)
);

// Payout order uses nullifiers
const payoutOrder = [
  nullifier1,  // Only Alice knows this is her
  nullifier2,  // Only Bob knows this is him
  // ...
];

// When claiming, participant proves ownership
const proof = generateMerkleProof(nullifier, merkleTree);
contract.claimPayout(poolId, nullifier, proof);
```

## Implementation Checklist

### Phase 1: Basic Integration ✅
- [x] Configure Wagmi for Celo network
- [x] Create StreamSavePool smart contract
- [x] Implement EIP-712 signature generation
- [x] Test voucher submission to facilitator

### Phase 2: Deferred Payments ✅
- [x] Add pool creation endpoint to facilitator
- [x] Add execute-round endpoint to facilitator
- [x] Implement voucher aggregation logic
- [ ] Test batch settlement (10 vouchers → 1 transaction)
- [ ] Add Supabase database schema (streamsave_pools, streamsave_rounds tables)

### Phase 3: Privacy & Governance 📋
- [ ] Generate merkle trees for participants
- [ ] Implement nullifier-based claiming
- [ ] Add quadratic voting for payout order
- [ ] Test zero-knowledge proofs

### Phase 4: Production 📋
- [ ] Security audit of smart contracts
- [ ] Load testing (100+ pools)
- [ ] Deploy to Celo Mainnet
- [ ] Set up Chainlink Automation for scheduled payouts

## Cost Analysis

### Without x402 (Traditional Approach)

```
10 participants × 10 months = 100 on-chain transactions

Gas per transaction: ~50,000 gas
Gas price: 0.5 gwei (Celo)
CELO price: $0.50

Cost per transaction: 50,000 × 0.5 × 10⁻⁹ × $0.50 = $0.0000125
Total cost: 100 × $0.0000125 = $0.00125 ≈ $0.0013

Wait, Celo gas is super cheap! Let me recalculate...

Actually: 50,000 × 5 gwei × 10⁻⁹ × $0.50 = $0.000125 per tx
Total: 100 × $0.000125 = $0.0125 ≈ $0.013
```

### With x402 Deferred (Our Approach)

```
10 batched settlements (1 per month)

Gas per settlement: ~100,000 gas (batch of 10)
Cost per settlement: 100,000 × 5 gwei × 10⁻⁹ × $0.50 = $0.00025
Total cost: 10 × $0.00025 = $0.0025 ≈ $0.003

Savings: $0.013 - $0.003 = $0.01 (77% reduction)
```

**Note**: Celo gas is extremely cheap! Main benefit is **simplicity** and **privacy**, not cost savings.

## Resources

### Official x402 Documentation
- Protocol: https://x402.gitbook.io/x402/core-concepts/http-402
- Facilitator: https://x402.gitbook.io/x402/core-concepts/facilitator
- Client-Server: https://x402.gitbook.io/x402/core-concepts/client-server

### Custom Facilitator
- Production: https://facilitator.x402hub.xyz
- Source: `/Users/osx/Projects/JulioMCruz/Custom402Facilitator`
- Documentation: `Custom402Facilitator/README.md`

### Celo Resources
- Network: https://docs.celo.org
- USDC: https://docs.celo.org/integration/tokens
- Faucet: https://faucet.celo.org (Alfajores testnet)

---

**Status**: Phase 2 Complete ✅ (endpoints implemented, database schema pending)
**Next**: Phase 3 - Privacy & Governance 🔨
