# StreamSave ROSCA Architecture

**Updated Architecture**: One contract deployment per ROSCA group with automatic payout distribution.

## Overview

StreamSave uses a **one-contract-per-ROSCA** architecture where:
- Each ROSCA group gets its own smart contract deployment
- Participants sign EIP-3009 authorizations
- x402 facilitator transfers USDC to the ROSCA contract
- **Contract automatically pays winner** when all participants have paid for the round

## Architecture Flow

```
┌─────────────────────────────────────────────────────────────┐
│                     ROSCA Lifecycle                         │
└─────────────────────────────────────────────────────────────┘

1. DEPLOYMENT
   ├─ Deploy new StreamSaveROSCA contract
   ├─ Set ROSCA parameters (contribution, duration, participants)
   └─ Contract becomes active

2. PARTICIPANT JOINING
   ├─ Participant calls joinROSCA(nullifier, payoutAddress, merkleProof)
   ├─ Contract verifies merkle proof
   └─ Participant added to rotation order

3. CONTRIBUTION TRACKING (Each Round)
   ├─ Participant signs EIP-3009 authorization (off-chain)
   ├─ x402 Facilitator calls USDC.transferWithAuthorization()
   ├─ USDC arrives at ROSCA contract
   ├─ Participant/Facilitator calls trackContribution(nullifier, amount)
   ├─ Contract records payment for this round
   └─ When ALL participants paid → AUTO-PAY WINNER 🎉

4. AUTOMATIC PAYOUT
   ├─ Last participant contribution triggers auto-payout
   ├─ Contract calculates: contributionAmount × totalParticipants
   ├─ Contract sends USDC to winner's payoutAddress
   ├─ Round increments automatically
   └─ Cycle repeats until all rounds complete

5. COMPLETION
   ├─ After totalParticipants rounds, ROSCA completes
   └─ Contract becomes inactive
```

## Key Design Decisions

### 1. One Contract Per ROSCA

**Why?**
- Isolated state per ROSCA group
- Simpler logic (no poolId mapping)
- Each group has unique contribution/duration parameters
- Gas-efficient for individual ROSCAs
- No cross-ROSCA interference

**Deployment:**
```typescript
// Each ROSCA group deploys its own contract
const rosca1 = await StreamSaveROSCA.deploy(usdc, merkleRoot, 10e6, rate, 30days, 10);
const rosca2 = await StreamSaveROSCA.deploy(usdc, merkleRoot, 5e6, rate, 7days, 5);
```

### 2. Automatic Payout on Last Contribution

**How it works:**
```solidity
function trackContribution(nullifier, amount) {
    // Record payment
    roundContributions[currentRound][nullifier] = true;
    roundContributionCount[currentRound]++;

    // Check if ALL paid
    if (roundContributionCount[currentRound] == totalParticipants) {
        // AUTO-PAY WINNER!
        _autoPayWinner();
    }
}
```

**Benefits:**
- No manual claim required
- Instant payout when cycle completes
- Gas paid by last contributor
- Winner doesn't need to do anything

### 3. Payment Tracking Only

**Contract does NOT execute transfers:**
```solidity
// ❌ Contract doesn't call transferFrom()
// ❌ Contract doesn't call transferWithAuthorization()

// ✅ Contract only verifies balance and tracks payments
require(IERC20(token).balanceOf(address(this)) >= amount);
roundContributions[currentRound][nullifier] = true;
```

**External x402 Facilitator handles transfers:**
```javascript
// Facilitator calls USDC contract directly
await usdc.transferWithAuthorization(
    from, roscaContractAddress, amount,
    validAfter, validBefore, nonce, v, r, s
);
```

## Contract State Variables

### Immutable (Set at Deployment)

```solidity
address public immutable token;              // USDC address
bytes32 public immutable merkleRoot;         // Privacy merkle root
uint256 public immutable contributionAmount; // e.g., 10 USDC
uint256 public immutable streamRate;         // Tokens per second
uint256 public immutable cycleDuration;      // e.g., 30 days
uint256 public immutable totalParticipants;  // e.g., 10 people
uint256 public immutable createdAt;          // Deployment timestamp
```

### Mutable (Changes During Operation)

```solidity
uint256 public currentRound;                              // Which round (0-indexed)
uint256 public lastPayoutTime;                            // Last payout timestamp
uint256 public totalContributed;                          // Cumulative contributions
bool public isActive;                                     // ROSCA status
uint256 public participantCount;                          // Joined participants

mapping(bytes32 => Participant) public participants;      // Participant data
mapping(uint256 => mapping(bytes32 => bool)) public roundContributions;  // Who paid this round
mapping(uint256 => uint256) public roundContributionCount;               // Payment count per round
```

## Functions

### 1. joinROSCA()

```solidity
function joinROSCA(
    bytes32 _nullifier,
    address _payoutAddress,
    bytes32[] calldata _merkleProof
) external
```

**Purpose:** Add participant to ROSCA

**Requirements:**
- ROSCA must be active
- Nullifier not already used
- Valid merkle proof
- ROSCA not full

**Effects:**
- Creates Participant entry
- Adds to rotation order
- Sets payout address

### 2. trackContribution()

```solidity
function trackContribution(
    bytes32 _nullifier,
    uint256 _amount
) external nonReentrant
```

**Purpose:** Record payment and trigger auto-payout

**Requirements:**
- USDC already transferred by facilitator
- Exact contribution amount
- Not already paid this round
- Within streaming limits

**Effects:**
- Records payment for current round
- Increments contribution count
- **Auto-pays winner if all paid**

**Key Logic:**
```solidity
// Mark payment
roundContributions[currentRound][nullifier] = true;
roundContributionCount[currentRound]++;

// Check if complete
if (roundContributionCount[currentRound] == totalParticipants) {
    _autoPayWinner(); // 🎉 Automatic payout!
}
```

### 3. _autoPayWinner() (Internal)

```solidity
function _autoPayWinner() internal
```

**Purpose:** Automatically send USDC to round winner

**Logic:**
1. Get winner nullifier: `participantNullifiers[currentRound % totalParticipants]`
2. Calculate payout: `contributionAmount × totalParticipants`
3. Get winner address: `participants[winnerNullifier].payoutAddress`
4. Transfer USDC: `IERC20(token).transfer(winner, payoutAmount)`
5. Increment round: `currentRound++`
6. Check completion: `if (currentRound >= totalParticipants) isActive = false`

**Events Emitted:**
- `AutoPayoutTriggered(round, winnerNullifier, contributionCount)`
- `PayoutDistributed(round, winnerNullifier, winner, amount, true)`
- `ROSCACompleted(totalRounds, completedAt)` *(if last round)*

## Events

```solidity
event ParticipantJoined(bytes32 indexed nullifier, address indexed payoutAddress);
event ContributionTracked(bytes32 indexed nullifier, uint256 amount, uint256 timestamp);
event AutoPayoutTriggered(uint256 indexed round, bytes32 indexed recipientNullifier, uint256 contributionCount);
event PayoutDistributed(uint256 indexed round, bytes32 indexed recipientNullifier, address indexed recipient, uint256 amount, bool automatic);
event ROSCACompleted(uint256 totalRounds, uint256 completedAt);
```

## Example ROSCA Lifecycle

### Setup
- **10 participants**
- **10 USDC per round**
- **30-day cycles**
- **Total pool per round: 100 USDC**

### Round 0 (Winner: Alice)
1. Bob signs → Facilitator transfers 10 USDC → Bob calls `trackContribution()` ✅
2. Charlie signs → Facilitator transfers 10 USDC → Charlie calls `trackContribution()` ✅
3. ... (8 more participants) ...
4. Zoe signs → Facilitator transfers 10 USDC → Zoe calls `trackContribution()` ✅
   - **All 10 paid! Auto-trigger payout**
   - Contract sends **100 USDC** to Alice
   - Round increments to 1

### Round 1 (Winner: Bob)
1. Repeat process...
2. When 10th person pays → Bob receives 100 USDC automatically
3. Round increments to 2

### Continue until Round 9...
- After round 9 completes → ROSCA marked complete
- Contract becomes inactive

## Gas Costs

| Operation | Approximate Gas | Who Pays |
|-----------|----------------|----------|
| Deploy contract | ~2,000,000 | Deployer |
| joinROSCA() | ~150,000 | Participant |
| trackContribution() (not last) | ~100,000 | Participant/Facilitator |
| trackContribution() (last = triggers payout) | ~200,000 | Last participant |

**Note:** Last contributor pays extra gas for automatic payout execution.

## Security Features

### 1. Privacy-Preserving
- Uses nullifiers instead of addresses
- Merkle proof verification
- No public identity exposure

### 2. Reentrancy Protection
- `nonReentrant` modifier on `trackContribution()`
- Checks-effects-interactions pattern

### 3. Double-Payment Prevention
```solidity
require(!roundContributions[currentRound][nullifier], "Already contributed this round");
```

### 4. Balance Verification
```solidity
require(IERC20(token).balanceOf(address(this)) >= amount, "Insufficient balance");
```

### 5. Exact Amount Enforcement
```solidity
require(_amount == contributionAmount, "Must contribute exact amount");
```

## Deployment Guide

### 1. Deploy Contract

```bash
npm run deploy:rosca --network celo
```

### 2. Save Contract Address

```bash
# .env
STREAMSAVE_POOL_ADDRESS=0xYourDeployedROSCAAddress
```

### 3. Verify Contract

```bash
npx hardhat verify --network celo <ADDRESS> \
  "0xcebA9300f2b948710d2653dD7B07f33A8B32118C" \
  "0x..." \
  "10000000" \
  "27777" \
  "2592000" \
  "10"
```

### 4. Participants Join

```typescript
await rosca.joinROSCA(nullifier, payoutAddress, merkleProof);
```

### 5. Contributions Start

```typescript
// Off-chain: User signs EIP-3009
// Facilitator: Transfers USDC
// Participant: Tracks contribution
await rosca.trackContribution(nullifier, amount);
```

## Comparison with Old Architecture

| Feature | Old (Multi-Pool) | New (One-Contract-Per-ROSCA) |
|---------|------------------|------------------------------|
| Contract per group | No (poolId mapping) | Yes (separate deployment) |
| Payout mechanism | Manual claim | Automatic on last payment |
| State complexity | High (nested mappings) | Low (flat structure) |
| Gas efficiency | Moderate | High |
| Isolation | Shared state | Complete isolation |
| Deployment cost | Low (one deploy) | Higher (per group) |
| Operation cost | Higher (poolId lookups) | Lower (direct access) |

## Advantages of New Architecture

✅ **Simplicity**: Each ROSCA is independent with clear state
✅ **Automatic**: Winner receives payout instantly when all pay
✅ **Privacy**: Nullifier-based with merkle proofs
✅ **Secure**: OpenZeppelin standards, reentrancy protection
✅ **Efficient**: No manual claim transactions needed
✅ **Predictable**: Fixed gas costs per operation

## Future Enhancements

- [ ] Support partial payments (flexible streaming)
- [ ] Emergency withdrawal mechanisms
- [ ] Dispute resolution protocol
- [ ] Late payment penalties
- [ ] Early exit options with collateral

## Conclusion

The new **StreamSaveROSCA** architecture provides:
1. Simple one-contract-per-ROSCA deployment
2. Automatic payout when all participants pay
3. Privacy-preserving nullifier system
4. OpenZeppelin security standards
5. Gas-efficient operations

Each ROSCA group operates independently with predictable, automated payouts.
