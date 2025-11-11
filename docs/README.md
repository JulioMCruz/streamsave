# StreamSave Documentation

**Version:** 2.0.0
**Last Updated:** November 11, 2025
**Contract:** StreamSave.sol

---

## Quick Navigation

### 🚀 Getting Started
- **[10-HOUR-MVP-PLAN.md](10-HOUR-MVP-PLAN.md)** - Start here for the 10-hour sprint plan
- **[STREAMSAVE-QUICKSTART.md](STREAMSAVE-QUICKSTART.md)** - Quick start guide for developers

### 📚 Core Documentation
- **[STREAMSAVE-ARCHITECTURE.md](STREAMSAVE-ARCHITECTURE.md)** - Complete architecture overview
- **[PROCESS.md](PROCESS.md)** - Current process flows and workflows
- **[UI-CONSIDERATIONS.md](UI-CONSIDERATIONS.md)** - Frontend implementation guide

### 🛠️ Implementation
- **[IMPLEMENTATION-PLAN.md](IMPLEMENTATION-PLAN.md)** - Full 10-week implementation roadmap
- **[OPENZEPPELIN-STANDARDS.md](OPENZEPPELIN-STANDARDS.md)** - Security standards and compliance

---

## Documentation Overview

### Architecture & Design

#### [STREAMSAVE-ARCHITECTURE.md](STREAMSAVE-ARCHITECTURE.md)
**Purpose:** Complete technical architecture documentation

**Contents:**
- One-contract-per-group design
- Automatic payout mechanism
- Payment tracking flow
- Security features
- Deployment guide
- Contract lifecycle

**Best For:** Understanding system design and architecture decisions

---

#### [PROCESS.md](PROCESS.md)
**Purpose:** Current operational workflows

**Contents:**
- Create group process
- Join group process
- Make payment process
- Receive payout process
- Role definitions (Participant, x402 Facilitator, Smart Contract)
- Event tracking

**Best For:** Understanding how the system works step-by-step

---

### Implementation Guides

#### [10-HOUR-MVP-PLAN.md](10-HOUR-MVP-PLAN.md)
**Purpose:** Focused MVP implementation in 10 hours

**Contents:**
- Hour-by-hour breakdown
- MVP feature set vs. deferred features
- Smart contract setup (Hours 1-2: DONE ✅)
- Backend API (Hours 3-4)
- Frontend core (Hours 5-6)
- Payment flow (Hours 7-8)
- Testing (Hour 9)
- Deployment & demo (Hour 10)
- Success criteria
- Quick reference commands

**Best For:** Building working prototype quickly

---

#### [IMPLEMENTATION-PLAN.md](IMPLEMENTATION-PLAN.md)
**Purpose:** Complete implementation roadmap (full production)

**Contents:**
- Phase 1: Smart Contracts (✅ DONE)
- Phase 2: Backend API Development
- Phase 3: Frontend Development
- Phase 4: Testing Strategy
- Phase 5: Deployment & DevOps
- Phase 6: Monitoring & Maintenance
- 10-week sprint timeline
- Success metrics
- Risk management

**Best For:** Long-term production planning

---

### Frontend Development

#### [UI-CONSIDERATIONS.md](UI-CONSIDERATIONS.md)
**Purpose:** Complete frontend implementation guide

**Contents:**
- Technology stack (Next.js 14, viem, wagmi, RainbowKit)
- Application structure
- Page layouts (Landing, Dashboard, Group Detail, Create)
- Component architecture
- Payment flow implementation (EIP-3009 signatures)
- Event monitoring
- User flows (Create, Join, Pay, Receive)
- Privacy considerations
- Deployment options

**Best For:** Building the frontend application

---

### Quick References

#### [STREAMSAVE-QUICKSTART.md](STREAMSAVE-QUICKSTART.md)
**Purpose:** Quick start for developers

**Contents:**
- 5-minute overview
- Key concepts
- Payment flow diagram
- Example 10-person group lifecycle
- Deployment instructions
- Basic usage examples

**Best For:** Getting up to speed quickly

---

#### [OPENZEPPELIN-STANDARDS.md](OPENZEPPELIN-STANDARDS.md)
**Purpose:** Security standards compliance

**Contents:**
- OpenZeppelin v5.0.0 verification
- Contract imports and usage
- Security patterns
- Compilation verification
- Best practices

**Best For:** Security review and compliance

---

## Current Architecture Summary

### Key Features

✅ **One Contract Per Group**
- Each savings group gets separate deployment
- Isolated state and parameters
- No poolId complexity

✅ **Automatic Payouts**
- Winner receives USDC automatically when all participants pay
- No manual claim transaction needed
- Gas paid by last contributor

✅ **Flexible Cycle Duration**
- User-defined at deployment
- 5 minutes (testing/demo)
- Daily, weekly, monthly
- Custom duration in seconds

✅ **Privacy-Preserving**
- Nullifier-based participant identity
- Merkle proof verification
- Anonymous until payout

✅ **Payment Tracking Only**
- Contract doesn't execute transfers
- x402 facilitator handles EIP-3009 transfers
- Contract verifies balance and tracks payments

✅ **OpenZeppelin Security**
- v5.0.0 standards throughout
- ReentrancyGuard
- IERC20 interface
- Ownable access control

---

## Technology Stack

### Smart Contracts
- **Solidity:** ^0.8.20
- **Framework:** Hardhat
- **Network:** Celo (mainnet), Alfajores (testnet)
- **Standards:** OpenZeppelin v5.0.0
- **Token:** USDC (EIP-3009 compatible)

### Backend (Optional for MVP)
- **Runtime:** Node.js
- **Framework:** Express or Next.js API routes
- **Database:** PostgreSQL
- **Caching:** Redis
- **Library:** viem or ethers v6

### Frontend
- **Framework:** Next.js 14 with App Router
- **Web3:** viem v2.0, wagmi v2.0, RainbowKit v2.0
- **UI:** Tailwind CSS, shadcn/ui
- **State:** TanStack Query
- **Network:** Celo (Chain ID: 42220)

---

## Development Workflow

### 1. Smart Contracts (✅ DONE)
```bash
cd apps/streamsave/contracts

# Install dependencies
npm install

# Compile contracts
npm run compile

# Deploy to testnet
npm run deploy:rosca -- --network alfajores

# Verify on Celoscan
npx hardhat verify --network alfajores <ADDRESS> <PARAMS>
```

### 2. Backend API (Optional)
```bash
# See IMPLEMENTATION-PLAN.md Phase 2
# Or skip for MVP and use direct contract interaction
```

### 3. Frontend
```bash
cd apps/streamsave/frontend

# Install dependencies
npm install

# Configure environment
cp .env.local.example .env.local
# Add deployed contract address

# Start dev server
npm run dev

# Build for production
npm run build
```

### 4. Testing
```bash
# Contract tests
cd contracts
npm test

# Frontend E2E tests
cd frontend
npm run test:e2e
```

---

## File Locations

### Smart Contracts
- **Main Contract:** `contracts/StreamSaveROSCA.sol` (referred to as StreamSave.sol)
- **Legacy Pool:** `contracts/StreamSavePool.sol` (reference only)
- **ZK Pool:** `contracts/StreamSavePoolZK.sol` (deferred)
- **Deployment:** `scripts/deploy-rosca.ts`

### Documentation
- **Root:** `apps/streamsave/docs/`
- **Changelog:** `apps/streamsave/CHANGELOG.md`
- **README:** `apps/streamsave/README.md`

---

## Common Tasks

### Deploy New StreamSave Group
```bash
npm run deploy:rosca -- --network alfajores
```

### View Contract on Celoscan
```
https://alfajores.celoscan.io/address/<CONTRACT_ADDRESS>
```

### Connect Frontend to Contract
```typescript
// lib/contracts/StreamSave.ts
export const DEPLOYED_GROUPS = [
  '0x...' // Add deployed contract address
];
```

### Make Payment
```typescript
// 1. Sign EIP-3009 authorization
const signature = await signTypedData({...});

// 2. Send to x402 facilitator
await fetch('https://facilitator.x402hub.xyz/transfer', {
  method: 'POST',
  body: JSON.stringify({ signature, ...params })
});

// 3. Track contribution on contract
await writeContract({
  address: groupAddress,
  functionName: 'trackContribution',
  args: [nullifier, amount]
});
```

---

## Documentation Status

### Current (Up-to-Date)
✅ STREAMSAVE-ARCHITECTURE.md
✅ STREAMSAVE-QUICKSTART.md
✅ IMPLEMENTATION-PLAN.md
✅ 10-HOUR-MVP-PLAN.md
✅ PROCESS.md
✅ UI-CONSIDERATIONS.md
✅ OPENZEPPELIN-STANDARDS.md
✅ CHANGELOG.md (root directory)

### Removed (Obsolete)
❌ ARCHITECTURE.md (multi-pool system)
❌ POOL-FLOW.md (deferred vouchers)
❌ SIMPLIFIED-FLOW.md (N² vouchers)
❌ CONTRACTS-COMPARISON.md (old comparison)
❌ QUICKSTART-ZK.md (ZK deferred)
❌ ZK-IMPLEMENTATION-SUMMARY.md (ZK deferred)
❌ ZK-SECURITY.md (ZK deferred)
❌ X402-INTEGRATION.md (old integration)
❌ X402-CLARIFICATION.md (superseded)

---

## Version Information

**Current Version:** v2.0.0
**Release Date:** November 11, 2025
**Contract:** StreamSave.sol (file: `contracts/StreamSaveROSCA.sol`)
**Architecture:** One-contract-per-group with automatic payouts

**Previous Version:** v1.0.0 (deprecated)
**Architecture:** Multi-pool with manual claims

See [CHANGELOG.md](../CHANGELOG.md) for complete version history.

---

## Need Help?

1. **Quick Start:** Read [10-HOUR-MVP-PLAN.md](10-HOUR-MVP-PLAN.md)
2. **Architecture Questions:** Check [STREAMSAVE-ARCHITECTURE.md](STREAMSAVE-ARCHITECTURE.md)
3. **Process Flow:** Review [PROCESS.md](PROCESS.md)
4. **Frontend:** See [UI-CONSIDERATIONS.md](UI-CONSIDERATIONS.md)
5. **Full Plan:** Reference [IMPLEMENTATION-PLAN.md](IMPLEMENTATION-PLAN.md)

---

**Last Updated:** November 11, 2025 7:27 AM
**Next Review:** After MVP completion
