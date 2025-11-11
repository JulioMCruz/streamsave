# StreamSave Pool - Simplified Flow

**Key Principle**: ALL vouchers signed on Day 0, executed monthly by facilitator on app request.

---

## Day 0: Pool Creation (All Vouchers Signed Upfront)

### Participants Sign 10 Vouchers Each

**Alice** signs and sends 10 vouchers:
```typescript
// Month 1 contribution
{
  payer: "0xAlice",
  payee: "0xPoolWallet",
  amount: "50000000", // $50
  nonce: "alice_pool_123_month_1"
}

// Month 2 contribution
{
  payer: "0xAlice",
  payee: "0xPoolWallet",
  amount: "50000000",
  nonce: "alice_pool_123_month_2"
}

// ... Month 3-10 (same pattern)
```

**Bob, Carol, ..., Jane** do the same.

**Total**: 10 participants × 10 months = **100 contribution vouchers** → Facilitator (stored, NOT executed)

---

### App Signs 10 Payout Vouchers

**App wallet** signs and sends 10 vouchers:
```typescript
// Round 1 payout (Alice)
{
  payer: "0xPoolWallet",
  payee: "0xAlice",
  amount: "500000000", // $500
  nonce: "pool_123_round_1_alice"
}

// Round 2 payout (Bob)
{
  payer: "0xPoolWallet",
  payee: "0xBob",
  amount: "500000000",
  nonce: "pool_123_round_2_bob"
}

// ... Rounds 3-10 (Carol through Jane)
```

**Total**: **10 payout vouchers** → Facilitator (stored, NOT executed)

---

## **Total Vouchers in Facilitator After Day 0**:
- 100 contribution vouchers (participants → pool)
- 10 payout vouchers (pool → participants)
- **110 vouchers** total, all `scheme: "deferred"`, all `settled: false`

---

## Month 1: App Executes Round 1

### Request 1: Collect Month 1 Contributions
```bash
POST /deferred/settle
{
  "payee": "0xPoolWallet",
  "network": "celo"
}
```

**Facilitator**:
1. Finds 10 vouchers with nonce `*_month_1`
2. Validates signatures
3. Aggregates: 10 × $50 = $500
4. Executes on-chain: Alice→Pool, Bob→Pool, ..., Jane→Pool
5. Marks vouchers as `settled: true`

**Result**: Pool wallet receives $500 ✅

---

### Request 2: Pay Alice (Round 1)
```bash
POST /deferred/settle
{
  "payer": "0xPoolWallet",
  "payee": "0xAlice",
  "network": "celo"
}
```

**Facilitator**:
1. Finds 1 voucher with nonce `pool_123_round_1_alice`
2. Validates signature
3. Executes on-chain: Pool→Alice ($500)
4. Marks voucher as `settled: true`

**Result**: Alice receives $500 ✅

---

## Month 2: App Executes Round 2

### Request 1: Collect Month 2 Contributions
```bash
POST /deferred/settle
{
  "payee": "0xPoolWallet",
  "network": "celo"
}
```

**Facilitator**:
- Finds 10 vouchers with nonce `*_month_2`
- Executes: 10 × $50 = $500 → Pool

---

### Request 2: Pay Bob (Round 2)
```bash
POST /deferred/settle
{
  "payer": "0xPoolWallet",
  "payee": "0xBob",
  "network": "celo"
}
```

**Facilitator**:
- Finds voucher `pool_123_round_2_bob`
- Executes: Pool → Bob ($500)

---

## Months 3-10: Same Pattern

Each month:
1. Collect contributions (Month N)
2. Pay recipient (Round N)

---

## Key Implementation Details

### Nonce Strategy

**Contribution Vouchers** (participants):
```
alice_pool_123_month_1
alice_pool_123_month_2
...
alice_pool_123_month_10
```

**Payout Vouchers** (app):
```
pool_123_round_1_alice
pool_123_round_2_bob
...
pool_123_round_10_jane
```

### Facilitator Filtering

The `/deferred/settle` endpoint fetches vouchers by:
1. `payee` address (pool wallet for contributions, participant for payouts)
2. `payer` address (optional - if null, aggregates from all payers)
3. `network` (celo)
4. `settled: false` (only unsettled vouchers)

**Problem**: How to select only "Month 2" contributions?

**Solution**: Filter by nonce pattern after fetching:
```typescript
const allVouchers = await getUnsettledVouchers(payer, payee, network);
const month2Vouchers = allVouchers.filter(v => v.nonce.includes("_month_2"));
```

---

## Orchestration Endpoint

To simplify the frontend, create a single endpoint that does BOTH operations:

```typescript
POST /streamsave/pool/execute-round
{
  "pool_id": "pool_123",
  "round": 2,
  "pool_wallet": "0xPoolWallet",
  "network": "celo"
}

// Internally calls:
// 1. /deferred/settle (collect month 2 contributions)
// 2. /deferred/settle (pay round 2 recipient)

Response:
{
  "success": true,
  "round": 2,
  "contribution_tx": "0xabc...",
  "contribution_amount": "500000000",
  "payout_tx": "0xdef...",
  "payout_recipient": "0xBob",
  "payout_amount": "500000000"
}
```

---

## Summary

✅ **Day 0**: 110 vouchers signed and stored
✅ **Month 1**: 2 settlements (collect + pay Alice)
✅ **Month 2**: 2 settlements (collect + pay Bob)
✅ **Month 10**: 2 settlements (collect + pay Jane)

**Total on-chain transactions**: 20 (10 months × 2 settlements)
**Without x402**: 200 transactions (10 participants × 10 months × 2 directions)
**Gas savings**: 90% ✅

---

## Next Steps

1. ✅ Participants sign 10 vouchers each → `/deferred/verify`
2. ✅ App signs 10 payout vouchers → `/deferred/verify`
3. ✅ App calls `/streamsave/pool/execute-round` monthly
4. ✅ Facilitator executes 2 settlements per round
5. ✅ Repeat until 10 rounds complete

**Status**: Architecture confirmed ✅
**Implementation**: Facilitator endpoints ready 🎯
