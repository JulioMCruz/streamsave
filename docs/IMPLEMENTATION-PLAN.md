# StreamSave - Complete Implementation Plan

**Version:** 2.0.0
**Architecture:** One-Contract-Per-Group with Automatic Payouts
**Date:** 2025-11-11

---

## Executive Summary

This plan outlines the complete implementation of StreamSave application with:
- ✅ **Smart Contracts** - StreamSave.sol (completed)
- 🔨 **Backend API** - x402 facilitator integration (optional for MVP)
- 🔨 **Frontend App** - Next.js 14 with App Router
- 🔨 **Testing** - Basic integration testing
- 🔨 **Deployment** - Celo testnet deployment

**Time Constraint: 10 hours total**

---

## Phase 1: Smart Contracts (COMPLETED ✅)

### Status: ✅ DONE

**Contracts Developed:**
- ✅ StreamSave.sol - Main contract with automatic payouts
- ✅ StreamSavePool.sol - Legacy multi-pool (reference)
- ✅ StreamSavePoolZK.sol - Legacy with ZK proofs (reference)

**Key Features Implemented:**
- One contract deployment per StreamSave group
- Immutable parameters (contributionAmount, cycleDuration, totalParticipants)
- Round-based payment tracking with nullifiers
- Automatic winner payout when all participants pay
- Privacy-preserving with merkle proofs
- OpenZeppelin v5.0.0 standards

**Deployment Scripts:**
- ✅ `scripts/deploy-rosca.ts` - Deploy single StreamSave contract
- ✅ `npm run deploy:rosca` command configured

**Contract Name:** StreamSave.sol (located at `contracts/StreamSaveROSCA.sol`)

**Testing:**
- Basic compilation ✅
- Need comprehensive unit tests 🔨

---

## Phase 2: Backend API Development 🔨

### 2.1 API Server Setup

**Directory:** `apps/streamsave/api/`

**Tech Stack:**
- Node.js + Express (or Next.js API routes)
- TypeScript
- ethers v6 or viem
- PostgreSQL for persistence
- Redis for caching

**Core Responsibilities:**
1. StreamSave group creation and deployment
2. Invitation management
3. x402 facilitator communication
4. Event monitoring and webhooks
5. User authentication (wallet-based)

### 2.2 API Endpoints

```typescript
// StreamSave Group Management
POST   /api/groups/create          // Deploy new StreamSave group contract
GET    /api/groups/:address        // Get group details
GET    /api/groups/list            // List user's groups
PATCH  /api/groups/:address/start  // Start group when full

// Invitations
POST   /api/groups/:address/invite       // Create invitation
GET    /api/groups/:address/invitations  // List invitations
POST   /api/invite/:code/accept          // Accept invitation

// Payments
POST   /api/payment/sign          // Sign EIP-3009 authorization
POST   /api/payment/track         // Track contribution on-chain

// Events
GET    /api/groups/:address/events // Get event history
POST   /api/webhooks/events        // Event notifications

// User
GET    /api/user/profile          // Get user profile
GET    /api/user/groups           // Get user's StreamSave groups
```

### 2.3 Database Schema

```sql
-- StreamSave groups table
CREATE TABLE groups (
  id UUID PRIMARY KEY,
  contract_address VARCHAR(42) UNIQUE NOT NULL,
  creator_address VARCHAR(42) NOT NULL,
  contribution_amount NUMERIC NOT NULL,
  cycle_duration INTEGER NOT NULL,
  total_participants INTEGER NOT NULL,
  current_round INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT NOW(),
  started_at TIMESTAMP,
  merkle_root VARCHAR(66) NOT NULL
);

-- Participants table
CREATE TABLE participants (
  id UUID PRIMARY KEY,
  group_id UUID REFERENCES groups(id),
  wallet_address VARCHAR(42) NOT NULL,
  nullifier VARCHAR(66) UNIQUE NOT NULL,
  payout_address VARCHAR(42) NOT NULL,
  position INTEGER NOT NULL,
  joined_at TIMESTAMP DEFAULT NOW(),
  has_received_payout BOOLEAN DEFAULT false,
  UNIQUE(group_id, position)
);

-- Invitations table
CREATE TABLE invitations (
  id UUID PRIMARY KEY,
  group_id UUID REFERENCES groups(id),
  code VARCHAR(20) UNIQUE NOT NULL,
  email VARCHAR(255),
  wallet_address VARCHAR(42),
  status VARCHAR(20) DEFAULT 'pending', -- pending, accepted, expired
  created_at TIMESTAMP DEFAULT NOW(),
  expires_at TIMESTAMP NOT NULL,
  accepted_at TIMESTAMP
);

-- Contributions table
CREATE TABLE contributions (
  id UUID PRIMARY KEY,
  group_id UUID REFERENCES groups(id),
  participant_id UUID REFERENCES participants(id),
  round INTEGER NOT NULL,
  amount NUMERIC NOT NULL,
  tx_hash VARCHAR(66) NOT NULL,
  tracked_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(group_id, participant_id, round)
);

-- Payouts table
CREATE TABLE payouts (
  id UUID PRIMARY KEY,
  group_id UUID REFERENCES groups(id),
  participant_id UUID REFERENCES participants(id),
  round INTEGER NOT NULL,
  amount NUMERIC NOT NULL,
  tx_hash VARCHAR(66) NOT NULL,
  paid_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(group_id, round)
);

-- Events table
CREATE TABLE events (
  id UUID PRIMARY KEY,
  group_id UUID REFERENCES groups(id),
  event_name VARCHAR(50) NOT NULL,
  block_number BIGINT NOT NULL,
  transaction_hash VARCHAR(66) NOT NULL,
  log_index INTEGER NOT NULL,
  data JSONB NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(transaction_hash, log_index)
);
```

### 2.4 x402 Facilitator Integration

**Facilitator Endpoint:** `https://facilitator.x402hub.xyz`

```typescript
// apps/streamsave/api/src/services/x402.service.ts
import axios from 'axios';

interface TransferWithAuthRequest {
  from: string;
  to: string;
  value: string;
  validAfter: number;
  validBefore: string;
  nonce: string;
  v: number;
  r: string;
  s: string;
}

export class X402Service {
  private readonly facilitatorUrl: string;

  constructor(facilitatorUrl: string) {
    this.facilitatorUrl = facilitatorUrl;
  }

  async executeTransferWithAuth(params: TransferWithAuthRequest): Promise<string> {
    const response = await axios.post(
      `${this.facilitatorUrl}/transfer-with-authorization`,
      params
    );

    return response.data.txHash; // x402 returns transaction hash
  }

  async checkNonce(address: string): Promise<string> {
    const response = await axios.get(
      `${this.facilitatorUrl}/nonce/${address}`
    );

    return response.data.nonce;
  }
}
```

### 2.5 Event Monitoring Service

```typescript
// apps/streamsave/api/src/services/event-monitor.service.ts
import { createPublicClient, http, parseAbiItem } from 'viem';
import { celo } from 'viem/chains';

export class EventMonitorService {
  private client;

  constructor() {
    this.client = createPublicClient({
      chain: celo,
      transport: http()
    });
  }

  async startMonitoring(contractAddress: string) {
    // Watch ContributionTracked events
    this.client.watchContractEvent({
      address: contractAddress as `0x${string}`,
      abi: StreamSaveABI,
      eventName: 'ContributionTracked',
      onLogs: async (logs) => {
        for (const log of logs) {
          await this.handleContributionTracked(log);
        }
      }
    });

    // Watch AutoPayoutTriggered events
    this.client.watchContractEvent({
      address: contractAddress as `0x${string}`,
      abi: StreamSaveABI,
      eventName: 'AutoPayoutTriggered',
      onLogs: async (logs) => {
        for (const log of logs) {
          await this.handleAutoPayoutTriggered(log);
        }
      }
    });

    // Watch PayoutDistributed events
    this.client.watchContractEvent({
      address: contractAddress as `0x${string}`,
      abi: StreamSaveABI,
      eventName: 'PayoutDistributed',
      onLogs: async (logs) => {
        for (const log of logs) {
          await this.handlePayoutDistributed(log);
        }
      }
    });
  }

  private async handleContributionTracked(log: any) {
    // Store contribution in database
    // Send notification to participant
    // Update group status
  }

  private async handleAutoPayoutTriggered(log: any) {
    // Send notification to winner
    // Update round status
  }

  private async handlePayoutDistributed(log: any) {
    // Record payout in database
    // Send confirmation to winner
    // Move to next round
  }
}
```

---

## Phase 3: Frontend Development 🔨

### 3.1 Project Structure

```
apps/streamsave/frontend/
├── app/                          # Next.js App Router
│   ├── layout.tsx               # Root layout with providers
│   ├── page.tsx                 # Landing page
│   ├── dashboard/
│   │   └── page.tsx            # User dashboard
│   ├── groups/
│   │   ├── [id]/
│   │   │   ├── page.tsx        # Group detail
│   │   │   ├── members/
│   │   │   │   └── page.tsx    # Members tab
│   │   │   ├── payments/
│   │   │   │   └── page.tsx    # Payments tab
│   │   │   └── payouts/
│   │   │       └── page.tsx    # Payouts tab
│   ├── create/
│   │   └── page.tsx            # Create StreamSave group wizard
│   ├── invitations/
│   │   └── page.tsx            # Invitations page
│   ├── invite/
│   │   └── [code]/
│   │       └── page.tsx        # Accept invitation
│   └── profile/
│       └── page.tsx            # User profile
│
├── components/                  # Reusable components
│   ├── providers/
│   │   ├── Web3Provider.tsx   # wagmi + RainbowKit
│   │   └── QueryProvider.tsx  # TanStack Query
│   ├── layout/
│   │   ├── Header.tsx
│   │   ├── Sidebar.tsx
│   │   └── Footer.tsx
│   ├── groups/
│   │   ├── GroupCard.tsx
│   │   ├── GroupDetailTabs.tsx
│   │   ├── MembersList.tsx
│   │   ├── PaymentTimeline.tsx
│   │   ├── PayoutSchedule.tsx
│   │   └── GroupProgress.tsx
│   ├── payments/
│   │   ├── SignPaymentButton.tsx
│   │   ├── TrackContributionButton.tsx
│   │   └── PaymentStatusBadge.tsx
│   ├── invitations/
│   │   ├── InviteForm.tsx
│   │   ├── InvitationCard.tsx
│   │   └── InviteLink.tsx
│   └── ui/                     # shadcn/ui components
│       ├── button.tsx
│       ├── card.tsx
│       ├── dialog.tsx
│       ├── form.tsx
│       ├── input.tsx
│       ├── toast.tsx
│       └── ...
│
├── lib/                        # Utilities
│   ├── contracts/
│   │   ├── StreamSave.ts      # Contract ABIs and addresses
│   │   └── config.ts          # Chain config
│   ├── api/
│   │   ├── client.ts          # API client
│   │   ├── groups.ts          # StreamSave group API methods
│   │   ├── payments.ts        # Payment API methods
│   │   └── invitations.ts     # Invitation API methods
│   ├── utils/
│   │   ├── nullifier.ts       # Nullifier generation
│   │   ├── merkle.ts          # Merkle tree utils
│   │   ├── format.ts          # Format helpers
│   │   └── validation.ts      # Form validation
│   └── hooks/
│       ├── useGroup.ts        # StreamSave group data hooks
│       ├── usePayment.ts      # Payment flow hooks
│       ├── useInvitation.ts   # Invitation hooks
│       └── useEvents.ts       # Event monitoring hooks
│
└── public/                     # Static assets
    ├── images/
    └── fonts/
```

### 3.2 Key Dependencies

```json
{
  "dependencies": {
    "next": "^14.0.0",
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "viem": "^2.0.0",
    "wagmi": "^2.0.0",
    "@tanstack/react-query": "^5.0.0",
    "@rainbow-me/rainbowkit": "^2.0.0",
    "zod": "^3.22.0",
    "react-hook-form": "^7.48.0",
    "@hookform/resolvers": "^3.3.0",
    "date-fns": "^3.0.0",
    "lucide-react": "^0.300.0",
    "class-variance-authority": "^0.7.0",
    "clsx": "^2.0.0",
    "tailwind-merge": "^2.0.0"
  },
  "devDependencies": {
    "@types/node": "^20.0.0",
    "@types/react": "^18.2.0",
    "@types/react-dom": "^18.2.0",
    "typescript": "^5.0.0",
    "tailwindcss": "^3.3.0",
    "autoprefixer": "^10.4.0",
    "postcss": "^8.4.0",
    "eslint": "^8.54.0",
    "eslint-config-next": "^14.0.0"
  }
}
```

### 3.3 Web3 Provider Setup

```typescript
// app/providers.tsx
'use client';

import '@rainbow-me/rainbowkit/styles.css';
import { getDefaultConfig, RainbowKitProvider } from '@rainbow-me/rainbowkit';
import { WagmiProvider } from 'wagmi';
import { celo } from 'wagmi/chains';
import { QueryClientProvider, QueryClient } from '@tanstack/react-query';

const config = getDefaultConfig({
  appName: 'StreamSave',
  projectId: process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID!,
  chains: [celo],
  ssr: true,
});

const queryClient = new QueryClient();

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider>
          {children}
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
```

### 3.4 Contract Integration

```typescript
// lib/contracts/StreamSave.ts
import { Address } from 'viem';

export const CELO_USDC_ADDRESS: Address = '0xcebA9300f2b948710d2653dD7B07f33A8B32118C';

export const StreamSaveABI = [
  // Constructor
  {
    type: 'constructor',
    inputs: [
      { name: '_token', type: 'address' },
      { name: '_merkleRoot', type: 'bytes32' },
      { name: '_contributionAmount', type: 'uint256' },
      { name: '_streamRate', type: 'uint256' },
      { name: '_cycleDuration', type: 'uint256' },
      { name: '_totalParticipants', type: 'uint256' }
    ]
  },
  // View functions
  {
    type: 'function',
    name: 'token',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'address' }]
  },
  {
    type: 'function',
    name: 'contributionAmount',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'uint256' }]
  },
  {
    type: 'function',
    name: 'currentRound',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'uint256' }]
  },
  {
    type: 'function',
    name: 'totalParticipants',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'uint256' }]
  },
  {
    type: 'function',
    name: 'isActive',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'bool' }]
  },
  // Write functions
  {
    type: 'function',
    name: 'trackContribution',
    stateMutability: 'nonpayable',
    inputs: [
      { name: '_nullifier', type: 'bytes32' },
      { name: '_amount', type: 'uint256' }
    ],
    outputs: []
  },
  // Events
  {
    type: 'event',
    name: 'ContributionTracked',
    inputs: [
      { name: 'nullifier', type: 'bytes32', indexed: true },
      { name: 'amount', type: 'uint256', indexed: false },
      { name: 'timestamp', type: 'uint256', indexed: false }
    ]
  },
  {
    type: 'event',
    name: 'AutoPayoutTriggered',
    inputs: [
      { name: 'round', type: 'uint256', indexed: true },
      { name: 'winnerNullifier', type: 'bytes32', indexed: true },
      { name: 'participantCount', type: 'uint256', indexed: false }
    ]
  },
  {
    type: 'event',
    name: 'PayoutDistributed',
    inputs: [
      { name: 'round', type: 'uint256', indexed: true },
      { name: 'nullifier', type: 'bytes32', indexed: true },
      { name: 'recipient', type: 'address', indexed: true },
      { name: 'amount', type: 'uint256', indexed: false },
      { name: 'isAutomatic', type: 'bool', indexed: false }
    ]
  }
] as const;
```

### 3.5 Payment Flow Implementation

```typescript
// components/payments/SignPaymentButton.tsx
'use client';

import { useState } from 'react';
import { useAccount, useSignTypedData } from 'wagmi';
import { Button } from '@/components/ui/button';
import { toast } from '@/components/ui/use-toast';
import { CELO_USDC_ADDRESS } from '@/lib/contracts/StreamSave';
import { maxUint256 } from 'viem';

interface SignPaymentButtonProps {
  groupAddress: string;
  amount: bigint;
  onSigned: (signature: { v: number; r: string; s: string; nonce: string }) => void;
}

export function SignPaymentButton({ groupAddress, amount, onSigned }: SignPaymentButtonProps) {
  const { address } = useAccount();
  const { signTypedDataAsync } = useSignTypedData();
  const [loading, setLoading] = useState(false);

  const handleSign = async () => {
    if (!address) {
      toast({ title: 'Connect wallet first', variant: 'destructive' });
      return;
    }

    setLoading(true);

    try {
      // Get nonce from API
      const nonceResponse = await fetch(`/api/payment/nonce/${address}`);
      const { nonce } = await nonceResponse.json();

      // Sign EIP-3009 authorization
      const signature = await signTypedDataAsync({
        domain: {
          name: 'USD Coin',
          version: '2',
          chainId: 42220,
          verifyingContract: CELO_USDC_ADDRESS
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
        primaryType: 'TransferWithAuthorization',
        message: {
          from: address,
          to: groupAddress,
          value: amount,
          validAfter: 0n,
          validBefore: maxUint256,
          nonce: nonce as `0x${string}`
        }
      });

      // Parse signature
      const r = signature.slice(0, 66);
      const s = `0x${signature.slice(66, 130)}`;
      const v = parseInt(signature.slice(130, 132), 16);

      onSigned({ v, r, s, nonce });
      toast({ title: 'Payment authorized successfully' });
    } catch (error) {
      console.error('Sign error:', error);
      toast({ title: 'Failed to sign payment', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button onClick={handleSign} disabled={loading}>
      {loading ? 'Signing...' : 'Authorize Payment'}
    </Button>
  );
}
```

---

## Phase 4: Testing Strategy 🔨

### 4.1 Smart Contract Tests

**Location:** `apps/streamsave/contracts/test/`

```typescript
// test/StreamSave.test.ts
import { expect } from "chai";
import { ethers } from "hardhat";
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";

describe("StreamSave", function () {
  async function deployStreamSaveFixture() {
    const [owner, p1, p2, p3, p4, p5] = await ethers.getSigners();

    // Deploy mock USDC
    const MockUSDC = await ethers.getContractFactory("MockERC20");
    const usdc = await MockUSDC.deploy("USD Coin", "USDC", 6);

    // Generate merkle tree
    const participants = [p1, p2, p3, p4, p5];
    const nullifiers = participants.map((p, i) =>
      ethers.keccak256(ethers.toUtf8Bytes(`participant-${i}`))
    );
    const merkleRoot = ethers.keccak256(ethers.concat(nullifiers));

    // Deploy StreamSave group contract
    const StreamSave = await ethers.getContractFactory("StreamSave");
    const group = await StreamSave.deploy(
      await usdc.getAddress(),
      merkleRoot,
      ethers.parseUnits("100", 6), // 100 USDC
      ethers.parseUnits("10", 6),  // 10 USDC/day streaming
      86400 * 7, // 7 days cycle
      5 // 5 participants
    );

    return { group, usdc, owner, participants, nullifiers };
  }

  describe("Deployment", function () {
    it("Should set correct parameters", async function () {
      const { group, usdc } = await loadFixture(deployStreamSaveFixture);

      expect(await group.token()).to.equal(await usdc.getAddress());
      expect(await group.contributionAmount()).to.equal(ethers.parseUnits("100", 6));
      expect(await group.totalParticipants()).to.equal(5);
      expect(await group.currentRound()).to.equal(0);
    });
  });

  describe("Contributions", function () {
    it("Should track contribution correctly", async function () {
      const { group, usdc, participants, nullifiers } = await loadFixture(deployStreamSaveFixture);

      // Mint USDC to participant
      await usdc.mint(participants[0].address, ethers.parseUnits("100", 6));

      // Transfer USDC to contract (simulating facilitator)
      await usdc.connect(participants[0]).transfer(
        await group.getAddress(),
        ethers.parseUnits("100", 6)
      );

      // Track contribution
      await expect(
        group.trackContribution(nullifiers[0], ethers.parseUnits("100", 6))
      ).to.emit(group, "ContributionTracked");
    });

    it("Should auto-pay winner when all contribute", async function () {
      const { group, usdc, participants, nullifiers } = await loadFixture(deployStreamSaveFixture);

      // All participants contribute
      for (let i = 0; i < 5; i++) {
        await usdc.mint(participants[i].address, ethers.parseUnits("100", 6));
        await usdc.connect(participants[i]).transfer(
          await group.getAddress(),
          ethers.parseUnits("100", 6)
        );

        if (i < 4) {
          await group.trackContribution(nullifiers[i], ethers.parseUnits("100", 6));
        } else {
          // Last contribution triggers auto-payout
          await expect(
            group.trackContribution(nullifiers[i], ethers.parseUnits("100", 6))
          ).to.emit(group, "AutoPayoutTriggered")
           .and.to.emit(group, "PayoutDistributed");
        }
      }

      // Check winner received payout
      const winner = participants[0];
      const balance = await usdc.balanceOf(winner.address);
      expect(balance).to.equal(ethers.parseUnits("500", 6)); // 100 * 5
    });
  });
});
```

### 4.2 Integration Tests

**Test Scenarios:**
1. ✅ End-to-end StreamSave group creation flow
2. ✅ Invitation acceptance flow
3. ✅ Complete payment cycle with automatic payout
4. ✅ Event monitoring and database updates
5. ✅ x402 facilitator integration

### 4.3 Frontend E2E Tests

**Tools:** Playwright + wagmi testing utilities

```typescript
// tests/e2e/group-creation.spec.ts
import { test, expect } from '@playwright/test';

test.describe('StreamSave Group Creation Flow', () => {
  test('should create new StreamSave group successfully', async ({ page }) => {
    await page.goto('/dashboard');

    // Click create button
    await page.click('text=Create Group');

    // Step 1: Basic info
    await page.fill('[name="name"]', 'Monthly Savings Circle');
    await page.fill('[name="contributionAmount"]', '100');
    await page.selectOption('[name="cycleDuration"]', '7');
    await page.fill('[name="totalParticipants"]', '10');
    await page.click('text=Next');

    // Step 2: Add participants
    for (let i = 0; i < 9; i++) {
      await page.fill('[name="email"]', `participant${i}@example.com`);
      await page.click('text=Add Participant');
    }
    await page.click('text=Next');

    // Step 3: Review
    await expect(page.locator('text=100 USDC')).toBeVisible();
    await expect(page.locator('text=10 participants')).toBeVisible();
    await page.click('text=Deploy Group');

    // Wait for deployment
    await expect(page.locator('text=Group Created')).toBeVisible({ timeout: 30000 });

    // Should redirect to group detail page
    await expect(page).toHaveURL(/\/groups\/0x[a-fA-F0-9]{40}/);
  });
});
```

---

## Phase 5: Deployment & DevOps 🔨

### 5.1 Environment Setup

**Development:**
- Local Hardhat node
- Local PostgreSQL
- Local Redis
- Next.js dev server

**Staging:**
- Celo Alfajores testnet
- Railway/Render PostgreSQL
- Railway/Render Redis
- Vercel preview deployment

**Production:**
- Celo mainnet
- Railway/Render PostgreSQL (production)
- Railway/Render Redis (production)
- Vercel production deployment

### 5.2 Smart Contract Deployment

```bash
# Deploy to testnet
npm run deploy:rosca -- --network alfajores

# Verify on Celoscan
npx hardhat verify --network alfajores <CONTRACT_ADDRESS> \
  "0xcebA9300f2b948710d2653dD7B07f33A8B32118C" \
  "<MERKLE_ROOT>" \
  "100000000" \
  "10000000" \
  "604800" \
  "10"

# Deploy to mainnet
npm run deploy:rosca -- --network celo
```

### 5.3 Backend Deployment

**Railway Configuration:**

```yaml
# railway.yaml
version: 1

services:
  api:
    build:
      context: ./api
      dockerfile: Dockerfile
    env:
      NODE_ENV: production
      DATABASE_URL: ${{Postgres.DATABASE_URL}}
      REDIS_URL: ${{Redis.REDIS_URL}}
    healthcheck:
      path: /health
      interval: 30s
      timeout: 10s
```

### 5.4 Frontend Deployment

**Vercel Configuration:**

```json
// vercel.json
{
  "buildCommand": "npm run build",
  "devCommand": "npm run dev",
  "installCommand": "npm install",
  "framework": "nextjs",
  "env": {
    "NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID": "@walletconnect-project-id",
    "NEXT_PUBLIC_API_URL": "@api-url",
    "NEXT_PUBLIC_CHAIN_ID": "42220"
  }
}
```

---

## Phase 6: Monitoring & Maintenance 🔨

### 6.1 Monitoring Stack

**Tools:**
- Sentry - Error tracking
- Datadog/New Relic - APM
- Grafana - Metrics visualization
- PagerDuty - Alerting

**Metrics to Track:**
- Smart contract events per minute
- API response times
- Database query performance
- x402 facilitator success rate
- Frontend bundle size
- User engagement metrics

### 6.2 Security Audits

**Pre-Launch:**
- [ ] Smart contract audit (recommended: OpenZeppelin, Trail of Bits)
- [ ] Backend security review
- [ ] Frontend security review
- [ ] Penetration testing

**Post-Launch:**
- [ ] Bug bounty program
- [ ] Regular security updates
- [ ] Dependency vulnerability scanning

---

## Implementation Timeline - 10 Hour Sprint

**Total Time Available: 10 hours**
**Strategy: MVP with core features only**

### Hour 1-2: Smart Contract Updates (DONE ✅)
- ✅ StreamSave.sol with automatic payouts (completed)
- ✅ Payment tracking functionality
- ✅ OpenZeppelin standards compliance

### Hour 3-4: Backend API (HIGH PRIORITY)
- Set up Express/Next.js API routes
- Create PostgreSQL schema (groups, participants, contributions)
- Implement `/api/groups/create` endpoint
- Basic x402 facilitator integration
- Simple event monitoring

### Hour 5-6: Frontend Core (HIGH PRIORITY)
- Next.js 14 setup with wagmi + RainbowKit
- Landing page with wallet connect
- Dashboard page (list groups)
- Group creation wizard (basic form)
- Contract integration utilities

### Hour 7-8: Payment Flow (CRITICAL PATH)
- EIP-3009 signature component
- Track contribution button
- Payment status display
- Auto-payout event listening
- Success notifications

### Hour 9: Testing & Integration
- Test contract deployment on Alfajores
- Test full payment flow
- Fix critical bugs
- Basic error handling

### Hour 10: Deployment & Demo
- Deploy contracts to Celo testnet
- Deploy frontend to Vercel
- Deploy backend API (if needed)
- Create demo video/documentation
- Prepare presentation

**Total Timeline: 10 hours**

### Deferred to Post-MVP
- Invitation system (manual wallet addresses instead)
- Email notifications
- Advanced UI/UX polish
- Comprehensive testing
- Production deployment
- Security audits

---

## Success Metrics

### Technical Metrics
- Smart contract gas optimization (<200K gas per transaction)
- API response time (<200ms p95)
- Frontend bundle size (<500KB initial)
- Test coverage (>80%)
- Uptime (>99.9%)

### Business Metrics
- StreamSave groups created per month
- Total value locked (TVL)
- Active participants
- Successful completion rate
- User retention (30-day)

---

## Risk Management

### Technical Risks
1. **Smart contract vulnerabilities** - Mitigate with audits
2. **x402 facilitator downtime** - Implement fallback mechanisms
3. **Scalability issues** - Load testing and optimization
4. **Privacy leaks** - Careful nullifier management

### Operational Risks
1. **Participant defaults** - Clear terms and reputation system
2. **Regulatory compliance** - Legal consultation
3. **User education** - Comprehensive documentation

---

## Next Steps

1. **Review and approve this plan**
2. **Set up development environment**
3. **Begin Sprint 1: Backend Foundation**
4. **Schedule regular progress reviews**
5. **Allocate resources and assign tasks**

---

## Resources & Documentation

- [ROSCA Architecture](./ROSCA-ARCHITECTURE.md)
- [ROSCA Quickstart](./ROSCA-QUICKSTART.md)
- [Process Documentation](./PROCESS.md)
- [UI Considerations](./UI-CONSIDERATIONS.md)
- [OpenZeppelin Standards](./OPENZEPPELIN-STANDARDS.md)
- [Changelog](./CHANGELOG.md)

---

**Document Status:** Draft
**Next Review:** Upon approval
**Owner:** Development Team
**Last Updated:** 2025-11-11
