# StreamSaveROSCA Quick Start

**New Architecture**: One smart contract per ROSCA group with automatic payouts.

## What's New?

✅ **One contract = One ROSCA group**
✅ **Automatic payout** when all participants pay
✅ **No manual claims** - winner receives USDC instantly
✅ **Privacy-preserving** with nullifiers
✅ **OpenZeppelin standards** throughout

## How It Works

### 1. Deploy Contract (One per ROSCA)

```bash
npm run deploy:rosca
```

**Parameters:**
- USDC token address
- Merkle root (privacy)
- Contribution amount (e.g., 10 USDC)
- Stream rate (tokens/second)
- Cycle duration (e.g., 30 days)
- Total participants (e.g., 10 people)

### 2. Participants Join

```solidity
rosca.joinROSCA(nullifier, payoutAddress, merkleProof)
```

**Each participant:**
- Provides privacy nullifier
- Sets their payout address
- Proves membership with merkle proof

### 3. Payment Flow (Each Round)

```
┌──────────────┐   Signs EIP-3009   ┌─────────────┐
│ Participant  │ ─────────────────> │ x402        │
└──────────────┘                     │ Facilitator │
                                     └──────┬──────┘
                                            │
                            transferWithAuthorization(USDC)
                                            │
                                            ▼
                                     ┌─────────────┐
                                     │   ROSCA     │
                                     │  Contract   │
                                     └──────┬──────┘
                                            │
                            trackContribution(nullifier, amount)
                                            │
                                            ▼
                                  ┌─────────────────┐
                                  │ Payment Tracked │
                                  └─────────────────┘
                                            │
                            If ALL participants paid? ────┐
                                            │             │
                                           YES           NO
                                            │             │
                                            ▼             ▼
                                  ┌──────────────┐   Wait for
                                  │ AUTO-PAYOUT  │    more
                                  │   WINNER!    │  payments
                                  └──────────────┘
```

### 4. Automatic Payout

**When last participant pays:**
1. Contract detects all 10 have paid
2. Calculates payout: `10 USDC × 10 participants = 100 USDC`
3. Gets winner address from `participants[winnerNullifier].payoutAddress`
4. **Automatically sends 100 USDC** to winner
5. Increments to next round
6. Repeats until all rounds complete

## Key Functions

### joinROSCA()
```solidity
function joinROSCA(
    bytes32 _nullifier,
    address _payoutAddress,
    bytes32[] calldata _merkleProof
) external
```
**Purpose:** Join ROSCA group
**Requirements:** Valid merkle proof, ROSCA not full

### trackContribution()
```solidity
function trackContribution(
    bytes32 _nullifier,
    uint256 _amount
) external nonReentrant
```
**Purpose:** Record payment and trigger auto-payout
**Requirements:** USDC already transferred by facilitator
**Effects:** Records payment, auto-pays winner if all paid

## Example: 10-Person ROSCA

**Setup:**
- 10 participants
- 10 USDC per round
- 30-day cycles
- 100 USDC pool per round

**Round 0 - Winner: Alice**
1. Bob pays 10 USDC ✅ (1/10)
2. Charlie pays 10 USDC ✅ (2/10)
3. David pays 10 USDC ✅ (3/10)
4. ...
5. Zoe pays 10 USDC ✅ (10/10)
   - **🎉 All paid! Contract sends 100 USDC to Alice**
   - Round increments to 1

**Round 1 - Winner: Bob**
1. Alice pays 10 USDC ✅ (1/10)
2. Charlie pays 10 USDC ✅ (2/10)
3. ...
4. Zoe pays 10 USDC ✅ (10/10)
   - **🎉 All paid! Contract sends 100 USDC to Bob**
   - Round increments to 2

**Continue until Round 9...**
- After round 9 completes → ROSCA finished
- Contract becomes inactive

## Deployment

### 1. Configure Environment

```bash
# .env
PRIVATE_KEY=your_private_key_here
CELOSCAN_API_KEY=your_celoscan_api_key_here
CELO_USDC_ADDRESS=0xcebA9300f2b948710d2653dD7B07f33A8B32118C
```

### 2. Deploy

```bash
npm run deploy:rosca
```

### 3. Verify

```bash
npx hardhat verify --network celo <CONTRACT_ADDRESS> \
  "0xcebA9300f2b948710d2653dD7B07f33A8B32118C" \
  "<MERKLE_ROOT>" \
  "10000000" \
  "27777" \
  "2592000" \
  "10"
```

## Gas Costs

| Operation | Gas | Who Pays |
|-----------|-----|----------|
| Deploy | ~2M | Deployer |
| Join | ~150K | Participant |
| Track payment (not last) | ~100K | Participant |
| Track payment (last = auto-payout) | ~200K | Last participant |

**Note:** Last contributor pays extra gas to trigger automatic payout.

## Security

✅ **Reentrancy protection** via OpenZeppelin ReentrancyGuard
✅ **Balance verification** - verifies USDC actually arrived
✅ **Double-payment prevention** - can't pay twice per round
✅ **Exact amount enforcement** - must pay exact contribution
✅ **Privacy via nullifiers** - no address exposure

## View Functions

```solidity
// Get ROSCA info
rosca.getROSCAInfo()

// Get participant info
rosca.getParticipantInfo(nullifier)

// Check current winner
rosca.getCurrentRecipient()

// Check contract balance
rosca.getContractBalance()

// Check if payout ready
rosca.isPayoutReady()
```

## Events

```solidity
// Listen for these events
event ParticipantJoined(bytes32 indexed nullifier, address indexed payoutAddress);
event ContributionTracked(bytes32 indexed nullifier, uint256 amount, uint256 timestamp);
event AutoPayoutTriggered(uint256 indexed round, bytes32 indexed recipientNullifier, uint256 contributionCount);
event PayoutDistributed(uint256 indexed round, bytes32 indexed recipientNullifier, address indexed recipient, uint256 amount, bool automatic);
event ROSCACompleted(uint256 totalRounds, uint256 completedAt);
```

## Advantages

✅ **Simple**: One contract per ROSCA group
✅ **Automatic**: Winner paid instantly when all pay
✅ **Privacy**: Nullifier-based identity
✅ **Secure**: OpenZeppelin standards
✅ **Efficient**: No manual claim needed
✅ **Predictable**: Fixed flow every round

## Next Steps

1. Read [ROSCA-ARCHITECTURE.md](ROSCA-ARCHITECTURE.md) for detailed design
2. Review [StreamSaveROSCA.sol](../contracts/StreamSaveROSCA.sol) contract
3. Run deployment script: `npm run deploy:rosca`
4. Test with participants joining and contributing

## Support

Questions? Check:
- [ROSCA-ARCHITECTURE.md](ROSCA-ARCHITECTURE.md) - Full architecture details
- [OPENZEPPELIN-STANDARDS.md](OPENZEPPELIN-STANDARDS.md) - Security standards
- [X402-CLARIFICATION.md](X402-CLARIFICATION.md) - x402 facilitator explanation
