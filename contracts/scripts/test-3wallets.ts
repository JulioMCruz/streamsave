import { ethers } from "hardhat";
import * as dotenv from "dotenv";

dotenv.config();

/**
 * Test script for StreamSave with 3 wallets on Alfajores testnet
 * Each wallet deposits 0.001 USDC for testing
 */

const TEST_DEPOSIT_AMOUNT = ethers.parseUnits("0.001", 6); // 0.001 USDC (6 decimals)
const CONTRIBUTION_AMOUNT = TEST_DEPOSIT_AMOUNT; // Each participant contributes 0.001 USDC per round
const STREAM_RATE = ethers.parseUnits("0.0001", 6) / 3600n; // ~0.0001 USDC/hour = 0.000000027 USDC/second
const CYCLE_DURATION = 7 * 24 * 60 * 60; // 7 days in seconds

async function main() {
  const network = await ethers.provider.getNetwork();

  console.log("=".repeat(80));
  console.log("StreamSave 3-Wallet Test Setup");
  console.log("=".repeat(80));
  console.log(`Network: ${network.name} (Chain ID: ${network.chainId})`);

  // Get the 3 test wallets
  const [wallet1, wallet2, wallet3] = await ethers.getSigners();

  if (!wallet2 || !wallet3) {
    throw new Error("Need 3 wallets configured in .env (PRIVATE_KEY, PRIVATE_KEY_WALLET_2, PRIVATE_KEY_WALLET_3)");
  }

  console.log("\n👛 Test Wallets:");
  console.log(`Wallet 1: ${wallet1.address} (Balance: ${ethers.formatEther(await ethers.provider.getBalance(wallet1.address))} CELO)`);
  console.log(`Wallet 2: ${wallet2.address} (Balance: ${ethers.formatEther(await ethers.provider.getBalance(wallet2.address))} CELO)`);
  console.log(`Wallet 3: ${wallet3.address} (Balance: ${ethers.formatEther(await ethers.provider.getBalance(wallet3.address))} CELO)`);

  // Verify we're on Celo Mainnet (only network with EIP-3009 USDC support)
  if (network.chainId !== 42220n) {
    throw new Error(`❌ Must test on Celo Mainnet (chainId: 42220). Current network: ${network.chainId}\n` +
                    `   Alfajores testnet does NOT support EIP-3009.\n` +
                    `   Testing will use minimal USDC amounts (0.001 USDC per wallet = $0.003 total)`);
  }

  // Celo Mainnet USDC (EIP-3009 compatible)
  const usdcAddress = process.env.CELO_USDC_ADDRESS || "0xcebA9300f2b948710d2653dD7B07f33A8B32118C";

  console.log(`\n💵 USDC Contract: ${usdcAddress}`);

  // Check USDC balances
  const USDC = await ethers.getContractAt("IERC20", usdcAddress);

  console.log("\n💰 USDC Balances:");
  const balance1 = await USDC.balanceOf(wallet1.address);
  const balance2 = await USDC.balanceOf(wallet2.address);
  const balance3 = await USDC.balanceOf(wallet3.address);

  console.log(`Wallet 1: ${ethers.formatUnits(balance1, 6)} USDC`);
  console.log(`Wallet 2: ${ethers.formatUnits(balance2, 6)} USDC`);
  console.log(`Wallet 3: ${ethers.formatUnits(balance3, 6)} USDC`);

  // Verify all wallets have sufficient USDC
  const requiredBalance = TEST_DEPOSIT_AMOUNT * 3n; // Each wallet needs 3x contribution for the test
  const insufficientWallets = [];

  if (balance1 < requiredBalance) insufficientWallets.push({ wallet: "Wallet 1", address: wallet1.address, balance: balance1 });
  if (balance2 < requiredBalance) insufficientWallets.push({ wallet: "Wallet 2", address: wallet2.address, balance: balance2 });
  if (balance3 < requiredBalance) insufficientWallets.push({ wallet: "Wallet 3", address: wallet3.address, balance: balance3 });

  if (insufficientWallets.length > 0) {
    console.log("\n⚠️  WARNING: Insufficient USDC balance for testing");
    console.log(`Required: ${ethers.formatUnits(requiredBalance, 6)} USDC per wallet`);
    insufficientWallets.forEach(w => {
      console.log(`${w.wallet} (${w.address}): ${ethers.formatUnits(w.balance, 6)} USDC`);
    });
    console.log("\n💡 Get testnet USDC from Celo faucet or use Circle's testnet USDC");
    return;
  }

  console.log("\n✅ All wallets have sufficient USDC for testing");

  // Create privacy nullifiers for each wallet
  const nullifier1 = ethers.keccak256(ethers.toUtf8Bytes(`participant-${wallet1.address}-${Date.now()}`));
  const nullifier2 = ethers.keccak256(ethers.toUtf8Bytes(`participant-${wallet2.address}-${Date.now()}`));
  const nullifier3 = ethers.keccak256(ethers.toUtf8Bytes(`participant-${wallet3.address}-${Date.now()}`));

  console.log("\n🔐 Privacy Nullifiers Generated:");
  console.log(`Wallet 1: ${nullifier1}`);
  console.log(`Wallet 2: ${nullifier2}`);
  console.log(`Wallet 3: ${nullifier3}`);

  // Create merkle tree for privacy
  const leaves = [nullifier1, nullifier2, nullifier3].sort();
  const merkleRoot = ethers.keccak256(
    ethers.concat([
      ethers.keccak256(ethers.concat([leaves[0], leaves[1]])),
      leaves[2]
    ])
  );

  console.log(`\n🌲 Merkle Root: ${merkleRoot}`);

  // Deploy or get existing StreamSavePool contract
  const poolAddress = process.env.STREAMSAVE_POOL_ADDRESS;

  let pool;
  if (poolAddress) {
    console.log(`\n📋 Using existing pool at: ${poolAddress}`);
    pool = await ethers.getContractAt("StreamSavePool", poolAddress);
  } else {
    console.log("\n📝 Deploying new StreamSavePool contract...");
    const StreamSavePool = await ethers.getContractFactory("StreamSavePool");
    pool = await StreamSavePool.deploy(process.env.X402_FACILITATOR_ADDRESS || ethers.ZeroAddress);
    await pool.waitForDeployment();
    const deployedAddress = await pool.getAddress();
    console.log(`✅ Deployed at: ${deployedAddress}`);
    console.log(`   Add to .env: STREAMSAVE_POOL_ADDRESS=${deployedAddress}`);
  }

  // Create pool
  console.log("\n🏊 Creating StreamSave pool...");
  console.log(`  Contribution: ${ethers.formatUnits(CONTRIBUTION_AMOUNT, 6)} USDC per round`);
  console.log(`  Stream Rate: ${ethers.formatUnits(STREAM_RATE * 3600n, 6)} USDC/hour`);
  console.log(`  Cycle Duration: ${CYCLE_DURATION / 86400} days`);
  console.log(`  Participants: 3`);

  const createTx = await pool.createPool(
    merkleRoot,
    CONTRIBUTION_AMOUNT,
    STREAM_RATE,
    CYCLE_DURATION,
    3, // 3 participants
    usdcAddress
  );

  const receipt = await createTx.wait();
  const poolCreatedEvent = receipt?.logs.find(log => {
    try {
      return pool.interface.parseLog(log as any)?.name === "PoolCreated";
    } catch {
      return false;
    }
  });

  const poolId = poolCreatedEvent ? pool.interface.parseLog(poolCreatedEvent as any)?.args[0] : 1n;

  console.log(`✅ Pool created with ID: ${poolId}`);

  console.log("\n📌 Test Setup Complete!");
  console.log("=".repeat(80));
  console.log("\nNext steps:");
  console.log("1. Each wallet joins the pool using their nullifier");
  console.log("2. Each wallet approves USDC spending for the pool contract");
  console.log("3. Simulate streaming contributions over time");
  console.log("4. Test payout distribution to first recipient");
  console.log("\nTest Parameters:");
  console.log(`  Pool ID: ${poolId}`);
  console.log(`  Test Deposit: ${ethers.formatUnits(TEST_DEPOSIT_AMOUNT, 6)} USDC per wallet`);
  console.log(`  Total Pool Value: ${ethers.formatUnits(TEST_DEPOSIT_AMOUNT * 3n, 6)} USDC`);
  console.log("=".repeat(80));
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Test setup failed:");
    console.error(error);
    process.exit(1);
  });
