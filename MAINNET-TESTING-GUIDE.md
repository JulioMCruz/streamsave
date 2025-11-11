# StreamSave Mainnet Testing Guide

**Date:** November 11, 2025
**Network:** Celo Mainnet (Chain ID: 42220)
**Testing Amounts:** 0.001 USDC
**Cycle Duration:** 2 minutes (120 seconds)

---

## 🚨 Important Context

**Why Mainnet?**
- USDC on Celo with EIP-3009 support is **only available on mainnet**
- Alfajores testnet does NOT support EIP-3009 transfers
- x402 facilitator requires EIP-3009 for gasless USDC transfers

**Testing Safety:**
- Use tiny amounts: 0.001 USDC per participant
- Short cycles: 2 minutes for quick testing
- Total risk per test: 0.003 USDC (3 participants × 0.001)

---

## 📋 Pre-Deployment Checklist

### 1. Three Test Wallets Required
You need 3 wallets with:
- ✅ Small CELO balance for gas (~0.1 CELO each)
- ✅ 0.001 USDC each
- ✅ Private keys in `.env`

### 2. Environment Setup

**File:** `apps/streamsave/contracts/.env`
```bash
# Deployer wallet (will become admin)
PRIVATE_KEY=0x...

# Test participant wallets
PRIVATE_KEY_WALLET_2=0x...
PRIVATE_KEY_WALLET_3=0x...

# Celo Mainnet RPC (default uses Forno)
# If needed: CELO_RPC_URL=https://forno.celo.org

# CeloScan API key (for verification)
CELOSCAN_API_KEY=your_api_key_here

# x402 Facilitator (use zero address for MVP testing)
X402_FACILITATOR_ADDRESS=0x0000000000000000000000000000000000000000

# USDC on Celo Mainnet
CELO_USDC_ADDRESS=0xcebA9300f2b948710d2653dD7B07f33A8B32118C
```

### 3. Get Test USDC on Mainnet

**Option A: Bridge from another chain**
- Use [Portal Bridge](https://www.portalbridge.com/)
- Bridge USDC from Ethereum/Polygon/etc to Celo
- Minimum: 0.01 USDC (covers 3 test wallets)

**Option B: Swap on Celo DEX**
- Use [Ubeswap](https://app.ubeswap.org/)
- Swap CELO → USDC
- Minimum: ~$0.01 worth

**Option C: Buy USDC on CEX**
- Buy on exchange that supports Celo withdrawals
- Withdraw to Celo mainnet

---

## 🚀 Deployment Steps

### Step 1: Prepare Deployment Script

**File:** `apps/streamsave/contracts/scripts/deploy-test-group.ts`

Create a deployment script for testing:

```typescript
import { ethers } from "hardhat";
import * as dotenv from "dotenv";

dotenv.config();

async function main() {
  const [deployer, wallet2, wallet3] = await ethers.getSigners();

  console.log("=".repeat(60));
  console.log("StreamSave Test Group Deployment - Celo Mainnet");
  console.log("=".repeat(60));
  console.log(`Deployer: ${deployer.address}`);
  console.log(`Wallet 2: ${wallet2.address}`);
  console.log(`Wallet 3: ${wallet3.address}`);
  console.log("=".repeat(60));

  // USDC on Celo Mainnet
  const USDC_ADDRESS = "0xcebA9300f2b948710d2653dD7B07f33A8B32118C";

  // Test parameters
  const contributionAmount = ethers.parseUnits("0.001", 6); // 0.001 USDC
  const cycleDuration = 120; // 2 minutes
  const totalParticipants = 3;

  // Generate merkle tree for 3 participants
  const participant1Hash = ethers.keccak256(ethers.toUtf8Bytes(deployer.address + "-streamsave"));
  const participant2Hash = ethers.keccak256(ethers.toUtf8Bytes(wallet2.address + "-streamsave"));
  const participant3Hash = ethers.keccak256(ethers.toUtf8Bytes(wallet3.address + "-streamsave"));

  // Simple merkle root (for testing - production needs proper merkle tree)
  const merkleRoot = ethers.keccak256(
    ethers.concat([participant1Hash, participant2Hash, participant3Hash])
  );

  console.log("\n📝 Deployment Parameters:");
  console.log(`Token: ${USDC_ADDRESS}`);
  console.log(`Contribution: 0.001 USDC`);
  console.log(`Cycle: 2 minutes`);
  console.log(`Participants: 3`);
  console.log(`Merkle Root: ${merkleRoot}`);

  console.log("\n🚀 Deploying StreamSave contract...");

  const StreamSave = await ethers.getContractFactory("StreamSave");
  const streamSave = await StreamSave.deploy(
    USDC_ADDRESS,
    merkleRoot,
    contributionAmount,
    0, // No streaming rate for MVP
    cycleDuration,
    totalParticipants
  );

  await streamSave.waitForDeployment();
  const address = await streamSave.getAddress();

  console.log("\n✅ StreamSave Test Group Deployed!");
  console.log(`Contract Address: ${address}`);
  console.log(`View on CeloScan: https://celoscan.io/address/${address}`);

  console.log("\n📋 Next Steps:");
  console.log(`1. Add to frontend: lib/contracts/StreamSave.ts`);
  console.log(`   DEPLOYED_GROUPS.push({ address: "${address}", name: "Test Group" })`);
  console.log(`2. Have each wallet approve USDC spending:`);
  console.log(`   Visit: https://celoscan.io/token/${USDC_ADDRESS}#writeContract`);
  console.log(`   Call approve(${address}, 1000000000) for each wallet`);
  console.log(`3. Join group with each wallet (optional for testing)`);
  console.log(`4. Test payment flow on frontend`);
  console.log("=".repeat(60));
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
```

### Step 2: Deploy Contract

```bash
cd apps/streamsave/contracts

# Compile contracts
npm run compile

# Deploy to Celo Mainnet
npx hardhat run scripts/deploy-test-group.ts --network celo
```

**Expected Output:**
```
============================================================
StreamSave Test Group Deployment - Celo Mainnet
============================================================
Deployer: 0x...
Wallet 2: 0x...
Wallet 3: 0x...
============================================================

📝 Deployment Parameters:
Token: 0xcebA9300f2b948710d2653dD7B07f33A8B32118C
Contribution: 0.001 USDC
Cycle: 2 minutes
Participants: 3
Merkle Root: 0x...

🚀 Deploying StreamSave contract...

✅ StreamSave Test Group Deployed!
Contract Address: 0x...
View on CeloScan: https://celoscan.io/address/0x...
============================================================
```

### Step 3: Verify Contract (Optional)

```bash
npx hardhat verify --network celo <CONTRACT_ADDRESS> \
  "0xcebA9300f2b948710d2653dD7B07f33A8B32118C" \
  "<MERKLE_ROOT>" \
  "1000" \
  "0" \
  "120" \
  "3"
```

---

## 💻 Frontend Configuration

### Step 1: Add Contract Address

**File:** `apps/streamsave/frontend/lib/contracts/StreamSave.ts`

```typescript
export const DEPLOYED_GROUPS: Array<{ address: Address; name: string }> = [
  {
    address: '0xYourDeployedAddress',
    name: 'Mainnet Test Group (2min, 0.001 USDC)'
  }
];
```

### Step 2: Start Frontend

```bash
cd apps/streamsave/frontend
npm run dev
```

Open: http://localhost:3000

---

## 🧪 Testing Flow

### Preparation (One-Time Setup)

For each of the 3 wallets, approve USDC spending:

1. Visit CeloScan: https://celoscan.io/token/0xcebA9300f2b948710d2653dD7B07f33A8B32118C#writeContract
2. Connect wallet
3. Find `approve` function
4. Enter:
   - `spender`: Your StreamSave contract address
   - `value`: 1000000000 (1000 USDC with 6 decimals - plenty for testing)
5. Submit transaction

### Testing Cycle

**Wallet 1:**
1. Connect to http://localhost:3000
2. Switch to Celo Mainnet in MetaMask
3. Go to Dashboard → Click on test group
4. Read x402 voucher explanation
5. Click "Sign Payment Voucher (x402)"
6. Approve signature in MetaMask
7. Click "Track Contribution On-Chain"
8. Confirm transaction

**Wallet 2:**
1. Disconnect Wallet 1
2. Connect Wallet 2
3. Repeat steps 2-8

**Wallet 3:**
1. Disconnect Wallet 2
2. Connect Wallet 3
3. Repeat steps 2-7
4. **Watch for auto-payout!** 🎉

**Expected Behavior:**
- After Wallet 3 tracks contribution
- Contract automatically triggers payout
- Winner receives 0.003 USDC (3 × 0.001)
- Event logs show: `AutoPayoutTriggered`, `PayoutDistributed`, `ROSCACompleted`

---

## 🔍 Monitoring & Debugging

### View Contract on CeloScan

https://celoscan.io/address/<YOUR_CONTRACT_ADDRESS>

**Tabs to check:**
- **Transactions:** See all contract interactions
- **Events:** Monitor ContributionTracked, AutoPayoutTriggered, etc.
- **Read Contract:** Check currentRound, contributionAmount, etc.
- **Write Contract:** Manual contract calls if needed

### Check USDC Balances

```bash
# Check wallet USDC balance on CeloScan
https://celoscan.io/token/0xcebA9300f2b948710d2653dD7B07f33A8B32118C?a=<WALLET_ADDRESS>
```

### Frontend Console Logs

Open browser DevTools console to see:
- Payment voucher signatures
- Transaction hashes
- Event logs
- Error messages

---

## ⚠️ Common Issues

### Issue 1: "Insufficient USDC balance"
**Solution:** Bridge more USDC to Celo mainnet

### Issue 2: "Transaction reverted: ERC20: insufficient allowance"
**Solution:** Approve USDC spending for the contract (see Preparation section)

### Issue 3: "Wrong network"
**Solution:** Switch MetaMask to Celo Mainnet (Chain ID: 42220)

### Issue 4: "Nonce too high" or "Transaction failed"
**Solution:**
- Reset MetaMask account (Settings → Advanced → Clear activity tab data)
- Try again

### Issue 5: Auto-payout not triggering
**Solution:**
- Wait 2 minutes for cycle to complete
- Ensure all 3 participants tracked contributions
- Check contract events on CeloScan

---

## 💰 Cost Estimate

**Per Test Cycle:**
- USDC: 0.003 (3 × 0.001)
- Gas: ~0.01 CELO per transaction
- Total per wallet: ~0.001 USDC + 0.03 CELO
- **Total cost: ~$0.05 per complete test**

**Total for 10 tests:** ~$0.50

---

## ✅ Success Criteria

After completing one full test cycle:

- ✅ Contract deployed on Celo Mainnet
- ✅ 3 wallets successfully approved USDC
- ✅ All 3 wallets signed payment vouchers
- ✅ All 3 wallets tracked contributions
- ✅ Auto-payout triggered and executed
- ✅ Winner received 0.003 USDC
- ✅ Events visible on CeloScan
- ✅ Frontend UI updated in real-time

---

## 🎯 Ready for Production

Once testing is complete and working:

1. Deploy with production parameters:
   - Higher contribution amounts (e.g., 100 USDC)
   - Longer cycles (e.g., weekly = 604800 seconds)
   - More participants (e.g., 10-20)

2. Integrate x402 facilitator:
   - Set X402_FACILITATOR_ADDRESS in .env
   - Connect to x402 API for automated transfers

3. Deploy frontend to Vercel:
   ```bash
   cd apps/streamsave/frontend
   vercel --prod
   ```

---

**Happy Testing! 🚀**

For questions or issues, check:
- Contract: `apps/streamsave/contracts/contracts/StreamSave.sol`
- Deployment: `apps/streamsave/contracts/scripts/deploy.ts`
- Frontend: `apps/streamsave/frontend/`
- Documentation: `apps/streamsave/docs/`
