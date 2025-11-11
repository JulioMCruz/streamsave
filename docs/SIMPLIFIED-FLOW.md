# StreamSave Pool - Simplified Flow

**Key Principle**: ALL vouchers signed on Day 0, executed periodically by facilitator on app request.

**Note**: This example uses 10 participants with monthly periods, but StreamSave supports:
- **Participants**: 5-20 people (customizable)
- **Period**: Weekly, bi-weekly, monthly, or custom intervals
- **Amount**: Any contribution amount decided by the group

---

## Day 0: Pool Creation (All Vouchers Signed Upfront)

### Example: 10 Participants, $50/month, 10 Months

### Participants Sign N Vouchers Each

**Alice** signs and sends 10 vouchers (one per period):
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

**Bob, Carol, ..., Jane** do the same (each signs N vouchers for N periods).

**Total**: N participants × N periods = **N² contribution vouchers** → Facilitator (stored, NOT executed)
**Example**: 10 participants × 10 months = **100 contribution vouchers**

---

### App Signs N Payout Vouchers (One Per Participant)

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

**Total**: **N payout vouchers** → Facilitator (stored, NOT executed)
**Example**: **10 payout vouchers** (one per participant)

---

## **Total Vouchers in Facilitator After Day 0**:
- **N² contribution vouchers** (participants → pool)
- **N payout vouchers** (pool → participants)
- **Total: N² + N vouchers**, all `scheme: "deferred"`, all `settled: false`

**Example with 10 participants**: 100 contribution + 10 payout = **110 vouchers** total

---

## Period 1: App Executes Round 1

### Request 1: Collect Period 1 Contributions
```bash
POST /deferred/settle
{
  "payee": "0xPoolWallet",
  "network": "celo"
}
```

**Facilitator**:
1. Finds N vouchers with nonce `*_period_1` (or `*_month_1`)
2. Validates signatures
3. Aggregates: N participants × contribution amount
4. Executes on-chain: All participants→Pool
5. Marks vouchers as `settled: true`

**Result**: Pool wallet receives total contributions ✅
**Example**: 10 × $50 = $500

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
3. Executes on-chain: Pool→Alice (total pool amount)
4. Marks voucher as `settled: true`

**Result**: Alice receives payout ✅
**Example**: $500 (10 participants × $50)

---

## Period 2: App Executes Round 2

### Request 1: Collect Period 2 Contributions
```bash
POST /deferred/settle
{
  "payee": "0xPoolWallet",
  "network": "celo"
}
```

**Facilitator**:
- Finds N vouchers with nonce `*_period_2` (or `*_month_2`)
- Executes: N participants × contribution amount → Pool
- **Example**: 10 × $50 = $500 → Pool

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
- Executes: Pool → Bob (total pool amount)
- **Example**: Pool → Bob ($500)

---

## Periods 3-N: Same Pattern

Each period:
1. Collect contributions (Period N)
2. Pay recipient (Round N)

**Continues until all N participants receive payout**

---

## Key Implementation Details

### Nonce Strategy

**Contribution Vouchers** (participants):
```
alice_pool_123_period_1  (or month_1, week_1, etc.)
alice_pool_123_period_2
...
alice_pool_123_period_N
```

**Payout Vouchers** (app):
```
pool_123_round_1_alice
pool_123_round_2_bob
...
pool_123_round_N_lastParticipant
```

**Pattern**: Use period identifier (month, week, day) that matches group's chosen frequency

### Facilitator Filtering

The `/deferred/settle` endpoint fetches vouchers by:
1. `payee` address (pool wallet for contributions, participant for payouts)
2. `payer` address (optional - if null, aggregates from all payers)
3. `network` (celo)
4. `settled: false` (only unsettled vouchers)

**Problem**: How to select only "Period 2" contributions?

**Solution**: Filter by nonce pattern after fetching:
```typescript
const allVouchers = await getUnsettledVouchers(payer, payee, network);
const period2Vouchers = allVouchers.filter(v => v.nonce.includes("_period_2")); // or _month_2, _week_2, etc.
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

✅ **Day 0**: N² + N vouchers signed and stored (all participants × all periods + payouts)
✅ **Period 1**: 2 settlements (collect contributions + pay 1st recipient)
✅ **Period 2**: 2 settlements (collect contributions + pay 2nd recipient)
✅ **Period N**: 2 settlements (collect contributions + pay Nth recipient)

**Total on-chain transactions**: 2N (N periods × 2 settlements per period)
**Without x402**: 2N² transactions (N participants × N periods × 2 directions)
**Gas savings**: ~90% (scales with participant count) ✅

**Example with 10 participants, 10 periods**:
- **With x402**: 20 transactions
- **Without x402**: 200 transactions
- **Savings**: 90% (180 fewer transactions)

---

## Next Steps

1. ✅ Participants sign N vouchers each → `/deferred/verify`
2. ✅ App signs N payout vouchers → `/deferred/verify`
3. ✅ App calls `/streamsave/pool/execute-round` periodically (based on group's chosen frequency)
4. ✅ Facilitator executes 2 settlements per round
5. ✅ Repeat until all N rounds complete

**Flexibility**: Works with any number of participants (5-20), any period (weekly to monthly), any amount

**Status**: Architecture confirmed ✅
**Implementation**: Facilitator endpoints ready 🎯
