# StreamSave ROSCA Process Flow

## Overview

StreamSave uses a **one-contract-per-ROSCA** architecture where each savings circle (ROSCA) gets its own smart contract deployment. The system enables privacy-preserving, automated savings pools with instant payouts.

## Complete Process Flow

### 1. ROSCA Creation

**Participant creates a new Stream (savings circle):**

1. **Creator defines ROSCA parameters:**
   - Total number of participants (e.g., 10 people)
   - Contribution amount per round (e.g., 10 USDC)
   - Cycle duration (e.g., 30 days per round)
   - Stream rate (tokens per second for flexible streaming)

2. **Creator generates privacy structure:**
   - Creates nullifiers for each participant (privacy-preserving identifiers)
   - Builds merkle tree from nullifiers
   - Generates merkle root for privacy verification

3. **System deploys new StreamSaveROSCA contract:**
   - Via factory pattern or direct deployment
   - Each ROSCA = Separate smart contract
   - Immutable parameters locked at deployment

**Example Deployment:**
```typescript
const rosca = await StreamSaveROSCA.deploy(
    usdcAddress,              // 0xcebA9300f2b948710d2653dD7B07f33A8B32118C
    merkleRoot,               // 0x... (privacy tree root)
    contributionAmount,       // 10 USDC (10000000 with 6 decimals)
    streamRate,               // ~0.1 USDC/hour
    cycleDuration,            // 30 days (2592000 seconds)
    totalParticipants         // 10 people
);
```

### 2. Participant Registration

**Each participant joins the ROSCA:**

1. **Participant provides:**
   - Their privacy nullifier (unique identifier)
   - Payout wallet address (where they'll receive USDC)
   - Merkle proof (proves they're in allowed participant list)

2. **Smart contract verifies:**
   - Merkle proof is valid
   - Nullifier not already used
   - ROSCA not full
   - Payout address is valid

3. **Contract records participant:**
   - Adds to rotation order
   - Stores payout address
   - Initializes streaming state

**Join Function:**
```solidity
rosca.joinROSCA(
    nullifier,       // 0x... (privacy identifier)
    payoutAddress,   // 0x... (where to receive USDC)
    merkleProof      // [0x..., 0x...] (privacy verification)
);
```

### 3. Rotation Order Determination

**Once all participants joined:**

1. **System determines payout order:**
   - Based on join order OR random draw
   - Creates rotation schedule
   - First joiner = Round 0 winner
   - Second joiner = Round 1 winner
   - etc.

2. **Order is recorded on-chain:**
   ```solidity
   participantNullifiers = [alice, bob, charlie, ..., zoe]
   // Round 0: alice receives
   // Round 1: bob receives
   // Round 2: charlie receives
   // ...
   // Round 9: zoe receives
   ```

### 4. Payment Collection (Each Round)

**Each participant must contribute for the current round:**

#### Step 4.1: Participant Signs Payment
```typescript
// Off-chain: Participant signs EIP-3009 authorization
const signature = await user.signTypedData({
    domain: { name: "USD Coin", version: "2", ... },
    types: { TransferWithAuthorization: [...] },
    message: {
        from: userAddress,
        to: roscaContractAddress,
        value: contributionAmount,
        validAfter: 0,
        validBefore: maxUint256,
        nonce: randomNonce
    }
});
```

#### Step 4.2: Facilitator Transfers USDC
```typescript
// x402 Facilitator calls USDC contract directly
await usdcContract.transferWithAuthorization(
    from: userAddress,
    to: roscaContractAddress,
    value: contributionAmount,
    validAfter: 0,
    validBefore: maxUint256,
    nonce: nonce,
    v: signature.v,
    r: signature.r,
    s: signature.s
);
```

#### Step 4.3: Track Contribution
```typescript
// Participant or facilitator calls ROSCA contract
await rosca.trackContribution(
    nullifier,           // Participant's privacy identifier
    contributionAmount   // Amount that was transferred
);
```

#### Step 4.4: Contract Records Payment
```solidity
// Smart contract logic:
function trackContribution(bytes32 _nullifier, uint256 _amount) {
    // Verify USDC received
    require(IERC20(token).balanceOf(address(this)) >= _amount);

    // Record payment for this round
    roundContributions[currentRound][_nullifier] = true;
    roundContributionCount[currentRound]++;

    // Check if all paid
    if (roundContributionCount[currentRound] == totalParticipants) {
        _autoPayWinner(); // 🎉 Automatic payout!
    }
}
```

### 5. Automatic Payout Distribution

**When ALL participants have paid for the current round:**

#### Step 5.1: Detect Complete Payment
```solidity
// Contract detects: 10 out of 10 participants paid
roundContributionCount[currentRound] == totalParticipants
// true → trigger automatic payout!
```

#### Step 5.2: Calculate Winner
```solidity
// Get current round winner from rotation
bytes32 winnerNullifier = participantNullifiers[currentRound % totalParticipants];

// Example: Round 0 → participantNullifiers[0] = alice
// Example: Round 5 → participantNullifiers[5] = frank
```

#### Step 5.3: Calculate Payout Amount
```solidity
// Total pool = contribution × participants
uint256 payoutAmount = contributionAmount * totalParticipants;
// Example: 10 USDC × 10 participants = 100 USDC
```

#### Step 5.4: Automatic Transfer
```solidity
// Get winner's payout address
address winner = participants[winnerNullifier].payoutAddress;

// Contract automatically sends USDC to winner
IERC20(token).transfer(winner, payoutAmount);

// Emit events
emit AutoPayoutTriggered(currentRound, winnerNullifier, totalParticipants);
emit PayoutDistributed(currentRound, winnerNullifier, winner, payoutAmount, true);
```

#### Step 5.5: Advance to Next Round
```solidity
// Increment round counter
currentRound++;
lastPayoutTime = block.timestamp;

// Check if ROSCA complete
if (currentRound >= totalParticipants) {
    isActive = false;
    emit ROSCACompleted(totalRounds, block.timestamp);
}
```

### 6. Round Progression

**ROSCA continues through all rounds:**

| Round | Winner | All Pay | Payout | Status |
|-------|--------|---------|--------|--------|
| 0 | Alice | 10 × 10 USDC | 100 USDC → Alice | ✅ Complete |
| 1 | Bob | 10 × 10 USDC | 100 USDC → Bob | ✅ Complete |
| 2 | Charlie | 10 × 10 USDC | 100 USDC → Charlie | ✅ Complete |
| ... | ... | ... | ... | ... |
| 9 | Zoe | 10 × 10 USDC | 100 USDC → Zoe | ✅ Complete |

**After Round 9 completes:**
- All 10 participants received payout once
- ROSCA cycle finished
- Contract marked inactive

### 7. Event Tracking

**Smart contract emits events for each action:**

```solidity
// Participant joins
event ParticipantJoined(bytes32 indexed nullifier, address indexed payoutAddress);

// Payment tracked
event ContributionTracked(bytes32 indexed nullifier, uint256 amount, uint256 timestamp);

// Automatic payout triggered
event AutoPayoutTriggered(uint256 indexed round, bytes32 indexed recipientNullifier, uint256 contributionCount);

// Winner received payout
event PayoutDistributed(uint256 indexed round, bytes32 indexed recipientNullifier, address indexed recipient, uint256 amount, bool automatic);

// ROSCA completed
event ROSCACompleted(uint256 totalRounds, uint256 completedAt);
```

**Frontend/Backend monitors events:**
```typescript
// Listen for automatic payouts
rosca.on("AutoPayoutTriggered", (round, winner, count) => {
    console.log(`Round ${round}: All ${count} paid! Winner: ${winner}`);
});

rosca.on("PayoutDistributed", (round, winner, recipient, amount) => {
    console.log(`${recipient} received ${amount} USDC!`);
});
```

### 8. New ROSCA Creation

**When creating another ROSCA:**

1. Deploy new StreamSaveROSCA contract (separate deployment)
2. Different participants, parameters, schedule
3. Each ROSCA operates independently
4. No shared state between ROSCAs

**Example: Multiple ROSCAs:**
```typescript
// ROSCA Group 1: 10 people, 10 USDC, 30 days
const rosca1 = await StreamSaveROSCA.deploy(...);

// ROSCA Group 2: 5 people, 5 USDC, 7 days
const rosca2 = await StreamSaveROSCA.deploy(...);

// ROSCA Group 3: 20 people, 20 USDC, 60 days
const rosca3 = await StreamSaveROSCA.deploy(...);
```

## Key Architectural Decisions

### 1. Privacy-Preserving Design
- Uses nullifiers instead of wallet addresses
- Merkle tree verification for participant membership
- No public identity exposure in events

### 2. Automatic Payout System
- No manual claim required
- Winner receives USDC instantly when all pay
- Last contributor pays gas for payout execution
- Eliminates forgotten claims

### 3. Payment Tracking Only
- Contract does NOT execute USDC transfers
- x402 facilitator handles EIP-3009 externally
- Contract verifies balance and tracks payments
- Cleaner separation of concerns

### 4. One Contract Per ROSCA
- Each savings circle = Separate deployment
- Isolated state per group
- No cross-ROSCA interference
- Simple, predictable flow

### 5. Immutable Parameters
- Contribution amount locked at deployment
- Cycle duration fixed
- Total participants immutable
- Predictable behavior

## Process Summary

```
CREATE ROSCA
    ↓
DEPLOY CONTRACT (immutable parameters)
    ↓
PARTICIPANTS JOIN (nullifier + payout address)
    ↓
DETERMINE ROTATION ORDER
    ↓
┌─────────────────────────────────────┐
│         REPEAT EACH ROUND:          │
│                                     │
│  1. Participants sign payments      │
│  2. Facilitator transfers USDC      │
│  3. Participants track contributions│
│  4. When ALL paid → AUTO-PAY WINNER │
│  5. Advance to next round          │
│                                     │
└─────────────────────────────────────┘
    ↓
ROSCA COMPLETES (after totalParticipants rounds)
    ↓
CONTRACT BECOMES INACTIVE
```

## Roles

### Participant
- Creates ROSCA or joins existing one
- Signs EIP-3009 payment authorizations
- Calls `trackContribution()` after payment
- Receives automatic payout when their turn

### x402 Facilitator (External Service)
- Receives signed authorizations from participants
- Calls USDC contract's `transferWithAuthorization()`
- Transfers USDC from participants to ROSCA contract
- Does NOT interact with ROSCA contract directly

### Smart Contract
- Verifies USDC balance
- Tracks payments per round
- Counts contributions
- **Automatically pays winner** when all contribute
- Manages round progression
- Emits events for tracking

### Factory (Optional)
- Deploys new StreamSaveROSCA contracts
- Maintains registry of deployed ROSCAs
- Simplifies ROSCA creation UI

## Security & Privacy

✅ **Privacy:** Nullifier-based identity, no address exposure
✅ **Security:** OpenZeppelin standards, reentrancy protection
✅ **Balance Verification:** Contract checks USDC actually arrived
✅ **Double-Payment Prevention:** Can't pay twice per round
✅ **Exact Amount Enforcement:** Must pay exact contribution
✅ **Immutable Parameters:** No mid-cycle changes
✅ **Automatic Payout:** Eliminates manual claim vulnerabilities

## Advantages Over Traditional ROSCA

Traditional ROSCA problems:
- ❌ Trust required for manual collection
- ❌ Coordinator can disappear with funds
- ❌ Forgotten or delayed claims
- ❌ Manual bookkeeping prone to errors

StreamSave solutions:
- ✅ Trustless smart contract execution
- ✅ Automatic payout when cycle completes
- ✅ Instant transfers, no claims needed
- ✅ On-chain event tracking
- ✅ Privacy-preserving design

## Next Steps

1. Read [ROSCA-ARCHITECTURE.md](ROSCA-ARCHITECTURE.md) for technical details
2. Review [ROSCA-QUICKSTART.md](ROSCA-QUICKSTART.md) for deployment guide
3. Check [StreamSaveROSCA.sol](../backend/contracts/StreamSaveROSCA.sol) contract code
4. Deploy test ROSCA: `npm run deploy:rosca`
