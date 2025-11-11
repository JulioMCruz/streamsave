# StreamSave - 10 Hour MVP Implementation Plan

**Time Constraint:** 10 hours total
**Target:** Working prototype with core functionality
**Network:** Celo Mainnet (42220) - USDC with EIP-3009 only available on mainnet
**Testing Amounts:** 0.001 USDC for small-scale testing

---

## ✅ **COMPLETED** (Hours 1-2): Smart Contracts

### StreamSave.sol Contract
**Location:** `apps/streamsave/contracts/contracts/StreamSaveROSCA.sol`

**Key Features:**
- ✅ One contract deployment per savings group
- ✅ Immutable parameters set at deployment
- ✅ Automatic winner payout when all participants pay
- ✅ Privacy-preserving with nullifiers and merkle proofs
- ✅ OpenZeppelin v5.0.0 standards compliance
- ✅ Payment tracking (no transfer execution)

**Flexible Cycle Duration:**
The `cycleDuration` parameter (in seconds) is **user-defined** at deployment:
- **2 minutes:** 120 seconds (for mainnet testing)
- **Daily:** 86400 seconds
- **Weekly:** 604800 seconds (7 days)
- **Monthly:** 2592000 seconds (30 days)
- **Custom:** Any duration in seconds

**Contract Parameters:**
```solidity
constructor(
    address _token,           // USDC address on Celo
    bytes32 _merkleRoot,      // Merkle root of participant nullifiers
    uint256 _contributionAmount,  // Fixed contribution (e.g., 100 USDC)
    uint256 _streamRate,      // Streaming rate (unused in MVP)
    uint256 _cycleDuration,   // USER-DEFINED: seconds between rounds
    uint256 _totalParticipants    // Number of participants
)
```

**Example Deployments:**
```typescript
// Mainnet Testing (2 minute cycles with tiny amounts)
await StreamSave.deploy(
    USDC_ADDRESS,
    merkleRoot,
    ethers.parseUnits("0.001", 6),  // 0.001 USDC (tiny test amount)
    0,                               // No streaming
    120,                             // 2 minutes
    3                                // 3 participants for quick testing
);

// Production Weekly savings circle
await StreamSave.deploy(
    USDC_ADDRESS,
    merkleRoot,
    ethers.parseUnits("100", 6),  // 100 USDC
    0,
    604800,                        // 7 days
    10                             // 10 participants
);

// Production Monthly savings circle
await StreamSave.deploy(
    USDC_ADDRESS,
    merkleRoot,
    ethers.parseUnits("500", 6),  // 500 USDC
    0,
    2592000,                       // 30 days
    20                             // 20 participants
);
```

---

## 🔨 **Hour 3-4:** Minimal Backend (Optional)

**Decision Point:** Backend API is OPTIONAL for MVP. Can use direct contract interaction instead.

### Option A: No Backend (Faster MVP)
- Frontend connects directly to contracts
- Manual contract deployment via Hardhat CLI
- Manual participant management (hardcode addresses)
- ⏱️ **Saves 2 hours** - Recommended for 10-hour constraint

### Option B: Minimal Backend
**Only if time permits:**
- Next.js API routes (no separate server)
- No database (use local JSON file or localStorage)
- `/api/deploy` - Deploy new StreamSave contract
- `/api/nonce` - Get USDC nonce for signatures

---

## 🔨 **Hour 3-6:** Frontend Core (HIGH PRIORITY)

### Technology Stack
```json
{
  "next": "^14.0.0",
  "viem": "^2.0.0",
  "wagmi": "^2.0.0",
  "@rainbow-me/rainbowkit": "^2.0.0",
  "@tanstack/react-query": "^5.0.0",
  "tailwindcss": "^3.3.0"
}
```

### Pages to Build

#### 1. Landing Page (`app/page.tsx`)
```typescript
'use client';

import { ConnectButton } from '@rainbow-me/rainbowkit';

export default function Home() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center">
      <h1 className="text-4xl font-bold mb-4">StreamSave</h1>
      <p className="text-xl mb-8">Decentralized savings circles on Celo</p>
      <ConnectButton />
      <Link href="/dashboard">
        <button className="mt-4">Enter App</button>
      </Link>
    </div>
  );
}
```

#### 2. Dashboard (`app/dashboard/page.tsx`)
```typescript
'use client';

import { useAccount, useReadContract } from 'wagmi';
import { StreamSaveABI, DEPLOYED_GROUPS } from '@/lib/contracts';

export default function Dashboard() {
  const { address } = useAccount();

  // Hardcoded deployed group addresses for MVP
  const groups = DEPLOYED_GROUPS;

  return (
    <div className="container mx-auto p-8">
      <h1>My StreamSave Groups</h1>
      <div className="grid grid-cols-3 gap-4">
        {groups.map(group => (
          <GroupCard key={group.address} address={group.address} />
        ))}
      </div>
      <Link href="/create">
        <button>Create New Group</button>
      </Link>
    </div>
  );
}
```

#### 3. Group Detail (`app/groups/[address]/page.tsx`)
```typescript
'use client';

import { useParams } from 'next/navigation';
import { useReadContract, useWriteContract } from 'wagmi';
import { StreamSaveABI } from '@/lib/contracts';

export default function GroupDetail() {
  const { address } = useParams();

  // Read contract state
  const { data: currentRound } = useReadContract({
    address: address as `0x${string}`,
    abi: StreamSaveABI,
    functionName: 'currentRound',
  });

  const { data: contributionAmount } = useReadContract({
    address: address as `0x${string}`,
    abi: StreamSaveABI,
    functionName: 'contributionAmount',
  });

  const { data: totalParticipants } = useReadContract({
    address: address as `0x${string}`,
    abi: StreamSaveABI,
    functionName: 'totalParticipants',
  });

  const { data: cycleDuration } = useReadContract({
    address: address as `0x${string}`,
    abi: StreamSaveABI,
    functionName: 'cycleDuration',
  });

  return (
    <div className="container mx-auto p-8">
      <h1>StreamSave Group</h1>
      <p>Contract: {address}</p>
      <p>Round: {currentRound?.toString()}</p>
      <p>Contribution: {contributionAmount?.toString()} USDC</p>
      <p>Participants: {totalParticipants?.toString()}</p>
      <p>Cycle: {formatDuration(cycleDuration)}</p>

      <SignPaymentButton groupAddress={address} amount={contributionAmount} />
    </div>
  );
}

function formatDuration(seconds: bigint | undefined): string {
  if (!seconds) return 'Loading...';
  const s = Number(seconds);

  if (s === 120) return '2 minutes';
  if (s === 86400) return 'Daily';
  if (s === 604800) return 'Weekly';
  if (s === 2592000) return 'Monthly';

  return `${s} seconds`;
}
```

#### 4. Create Group (SIMPLIFIED)
**MVP Approach:** Manual deployment via Hardhat CLI
- Skip complex wizard UI
- Use Hardhat script with predefined parameters
- Deploy via `npm run deploy:rosca`

```bash
# Quick deployment for testing
cd apps/streamsave/contracts
npm run deploy:rosca -- --network alfajores

# Output: Contract deployed at 0x...
# Add address to frontend config
```

---

## 🔨 **Hour 7-8:** Payment Flow (CRITICAL PATH)

### EIP-3009 Payment Signature Component

```typescript
// components/payments/SignPaymentButton.tsx
'use client';

import { useState } from 'react';
import { useAccount, useSignTypedData } from 'wagmi';
import { maxUint256 } from 'viem';

export function SignPaymentButton({ groupAddress, amount }) {
  const { address } = useAccount();
  const { signTypedDataAsync } = useSignTypedData();
  const [loading, setLoading] = useState(false);

  const handleSign = async () => {
    setLoading(true);
    try {
      // Generate unique nonce (MVP: use timestamp)
      const nonce = `0x${Date.now().toString(16).padStart(64, '0')}`;

      // Sign EIP-3009 authorization
      const signature = await signTypedDataAsync({
        domain: {
          name: 'USD Coin',
          version: '2',
          chainId: 42220, // Celo Mainnet
          verifyingContract: '0xcebA9300f2b948710d2653dD7B07f33A8B32118C' // USDC on Celo Mainnet
        },
        types: {
          TransferWithAuthorization: [
            { name: 'from', type: 'address' },
            { name: 'to', type: 'address' },
            { name: 'value', type: 'uint256' },
            { name: 'validAfter', type: 'uint256' },
            { name: 'validBefore', type: 'uint256' },
            { name: 'nonce', type: 'bytes32' }
          ]
        },
        message: {
          from: address,
          to: groupAddress,
          value: amount,
          validAfter: 0n,
          validBefore: maxUint256,
          nonce: nonce as `0x${string}`
        }
      });

      // MVP: Send directly to x402 facilitator
      const response = await fetch('https://facilitator.x402hub.xyz/transfer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from: address,
          to: groupAddress,
          value: amount.toString(),
          validAfter: 0,
          validBefore: maxUint256.toString(),
          nonce,
          signature
        })
      });

      if (response.ok) {
        alert('Payment sent! Waiting for facilitator...');
        // Wait a few seconds, then track contribution
        setTimeout(() => trackContribution(), 3000);
      }
    } catch (error) {
      console.error('Sign error:', error);
      alert('Failed to sign payment');
    } finally {
      setLoading(false);
    }
  };

  const trackContribution = async () => {
    // Call trackContribution on contract
    const { writeContract } = useWriteContract();

    await writeContract({
      address: groupAddress as `0x${string}`,
      abi: StreamSaveABI,
      functionName: 'trackContribution',
      args: [myNullifier, amount]
    });
  };

  return (
    <button onClick={handleSign} disabled={loading}>
      {loading ? 'Signing...' : 'Make Payment'}
    </button>
  );
}
```

### Track Contribution Component

```typescript
// components/payments/TrackContributionButton.tsx
'use client';

import { useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { StreamSaveABI } from '@/lib/contracts';

export function TrackContributionButton({ groupAddress, nullifier, amount }) {
  const { writeContract, data: hash } = useWriteContract();
  const { isSuccess } = useWaitForTransactionReceipt({ hash });

  const handleTrack = async () => {
    await writeContract({
      address: groupAddress as `0x${string}`,
      abi: StreamSaveABI,
      functionName: 'trackContribution',
      args: [nullifier, amount]
    });
  };

  return (
    <div>
      <button onClick={handleTrack}>
        Track My Contribution
      </button>
      {isSuccess && <p>✅ Contribution tracked!</p>}
    </div>
  );
}
```

### Event Monitoring for Auto-Payout

```typescript
// hooks/usePayoutEvents.ts
import { useWatchContractEvent } from 'wagmi';
import { StreamSaveABI } from '@/lib/contracts';

export function usePayoutEvents(groupAddress: string) {
  useWatchContractEvent({
    address: groupAddress as `0x${string}`,
    abi: StreamSaveABI,
    eventName: 'AutoPayoutTriggered',
    onLogs(logs) {
      console.log('Auto payout triggered!', logs);
      alert('🎉 Winner has been paid automatically!');
    },
  });

  useWatchContractEvent({
    address: groupAddress as `0x${string}`,
    abi: StreamSaveABI,
    eventName: 'PayoutDistributed',
    onLogs(logs) {
      console.log('Payout distributed!', logs);
    },
  });
}
```

---

## 🔨 **Hour 9:** Testing & Integration

### Manual Testing Checklist

1. **Contract Deployment**
   ```bash
   cd apps/streamsave/contracts
   npm run deploy:rosca -- --network celo
   # Note: Deploys to Celo Mainnet (only network with EIP-3009 USDC)
   # Use 0.001 USDC amounts for testing
   # Note the deployed address
   ```

2. **Frontend Setup**
   ```bash
   cd apps/streamsave/frontend
   # Update lib/contracts/StreamSave.ts with deployed address
   npm run dev
   ```

3. **Test Flow:**
   - ✅ Connect wallet (MetaMask/WalletConnect)
   - ✅ View group details on dashboard
   - ✅ Sign payment authorization
   - ✅ Track contribution on contract
   - ✅ Verify auto-payout when all pay
   - ✅ Check winner received funds

4. **Debug Common Issues:**
   - RPC connection errors
   - Signature validation failures
   - Gas estimation issues
   - Event monitoring delays

---

## 🔨 **Hour 10:** Deployment & Demo Prep

### Deploy Frontend to Vercel

```bash
cd apps/streamsave/frontend

# Install Vercel CLI
npm i -g vercel

# Deploy
vercel --prod
```

### Demo Preparation

**Create 5-minute demo showing:**

1. **Problem Statement (30 sec)**
   - Traditional savings circles lack transparency
   - Manual tracking is error-prone
   - Need trustless, automated solution

2. **Solution Overview (1 min)**
   - StreamSave.sol contract on Celo
   - One contract per savings group
   - Automatic payouts when all contribute
   - Flexible cycles: 5 min to monthly

3. **Live Demo (3 min)**
   - Show deployed contract on Celoscan
   - Connect wallet to frontend
   - View group details (cycle duration, amount, participants)
   - Demonstrate payment signing
   - Show automatic payout event
   - Display winner receiving funds

4. **Technical Highlights (30 sec)**
   - EIP-3009 gasless USDC transfers
   - Privacy with nullifiers
   - OpenZeppelin security standards
   - x402 facilitator integration

### Demo Script

```
"Hi, I'm presenting StreamSave - a decentralized savings circle platform on Celo.

The problem: Traditional ROSCAs lack transparency and require manual coordination.

Our solution: Smart contracts that automatically pay winners when all participants contribute.

Let me show you how it works...

[Show contract on Celoscan]
Here's a live StreamSave group with 5 participants, 100 USDC per round, weekly cycles.

[Show frontend]
I connect my wallet, view my groups, and make a payment by signing an EIP-3009 authorization.

[Trigger contribution tracking]
When the last participant contributes, the contract automatically sends 500 USDC to the winner.

[Show payout event]
No manual claims needed - fully automated.

The key innovation: Flexible cycle durations - from 5 minutes for testing to monthly for real savings.

Thank you!"
```

---

## MVP Feature Set

### ✅ **MUST HAVE** (Core Functionality)
- StreamSave.sol contract with automatic payouts
- Frontend wallet connection (RainbowKit)
- View group details
- Sign payment authorization (EIP-3009)
- Track contribution on contract
- Auto-payout event monitoring
- Flexible cycle duration (user-defined at deployment)

### 🔄 **NICE TO HAVE** (If Time Permits)
- Multiple group dashboard
- Payment history timeline
- Participant list display
- Cycle progress indicator

### ❌ **DEFERRED** (Post-MVP)
- Invitation system
- Email notifications
- Group creation wizard UI
- Database persistence
- Admin functions
- Security audits
- Production deployment

---

## Success Criteria

**Minimum Viable Demo:**
1. ✅ Contract deployed on Celo Mainnet (with 0.001 USDC test amounts)
2. ✅ Frontend deployed and accessible
3. ✅ Can connect wallet
4. ✅ Can view group details including cycle duration
5. ✅ Can sign payment
6. ✅ Can track contribution
7. ✅ Auto-payout works when all pay

**Bonus Points:**
- Mobile responsive
- Clean UI design
- Error handling
- Loading states
- Transaction confirmations

---

## Time Management Tips

**If Running Behind:**
- Skip create group UI - deploy via CLI only
- Use hardcoded group addresses
- Skip backend entirely
- Simplify UI - focus on functionality
- Use console.log instead of toast notifications
- Skip loading states and error handling

**If Ahead of Schedule:**
- Add payment history timeline
- Improve UI/UX polish
- Add more test cases
- Create better demo video
- Write better documentation

---

## Quick Reference Commands

```bash
# Contract deployment (MAINNET only - USDC with EIP-3009)
cd apps/streamsave/contracts
npm run deploy:rosca -- --network celo

# Frontend dev
cd apps/streamsave/frontend
npm run dev

# Frontend deployment
vercel --prod

# Test contract on Celoscan (MAINNET)
https://celoscan.io/address/<CONTRACT_ADDRESS>
```

---

## Key Files to Create/Edit

1. `frontend/lib/contracts/StreamSave.ts` - Contract ABI and addresses
2. `frontend/components/payments/SignPaymentButton.tsx` - Payment signing
3. `frontend/components/payments/TrackContributionButton.tsx` - Contribution tracking
4. `frontend/app/groups/[address]/page.tsx` - Group detail page
5. `frontend/hooks/usePayoutEvents.ts` - Event monitoring

---

**Good luck! Focus on the critical path and keep it simple. 10 hours goes fast!** 🚀
