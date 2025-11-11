import { ethers } from "hardhat";

/**
 * Deploy StreamSavePoolZK with ZK privacy features
 * Network: Celo Mainnet (Chain ID: 42220)
 */

async function main() {
  console.log("🔐 Deploying StreamSavePoolZK to Celo Mainnet...\n");

  const [deployer] = await ethers.getSigners();
  console.log("📝 Deploying from account:", deployer.address);

  const balance = await ethers.provider.getBalance(deployer.address);
  console.log("💰 Account balance:", ethers.formatEther(balance), "CELO\n");

  // Deploy StreamSavePoolZK (no constructor args needed!)
  console.log("📦 Deploying StreamSavePoolZK contract...");
  console.log("ℹ️  Note: x402 works via EIP-3009 standard - no facilitator address needed in contract\n");

  const StreamSavePoolZK = await ethers.getContractFactory("StreamSavePoolZK");
  const poolContract = await StreamSavePoolZK.deploy();

  await poolContract.waitForDeployment();
  const poolAddress = await poolContract.getAddress();

  console.log("✅ StreamSavePoolZK deployed to:", poolAddress);
  console.log("🔗 View on CeloScan: https://celoscan.io/address/" + poolAddress);

  // Verification instructions
  console.log("\n" + "=".repeat(60));
  console.log("CONTRACT VERIFICATION");
  console.log("=".repeat(60));
  console.log("\nRun the following command to verify on CeloScan:");
  console.log(`\nnpx hardhat verify --network celo ${poolAddress}`);

  // Configuration instructions
  console.log("\n" + "=".repeat(60));
  console.log("NEXT STEPS");
  console.log("=".repeat(60));

  console.log("\n1. Update .env file:");
  console.log(`   STREAMSAVE_POOL_ZK_ADDRESS=${poolAddress}`);

  console.log("\n2. Test ZK functionality:");
  console.log(`   npm run test:zk`);

  console.log("\n3. Create first ZK pool:");
  console.log(`   - Use StreamSavePoolZK.createPool()`);
  console.log(`   - Set minContribution and maxContribution for range proofs`);
  console.log(`   - Participants join with ZK commitments`);

  console.log("\n4. Security checklist:");
  console.log(`   ⚠️  Professional security audit required`);
  console.log(`   ⚠️  Test thoroughly on testnet first`);
  console.log(`   ⚠️  Start with minimal amounts`);
  console.log(`   ⚠️  Monitor for issues continuously`);

  console.log("\n📚 Documentation:");
  console.log(`   - ZK Security Model: docs/ZK-SECURITY.md`);
  console.log(`   - Architecture: docs/ARCHITECTURE.md`);
  console.log(`   - Pool Flow: docs/POOL-FLOW.md`);

  console.log("\n🎉 Deployment complete!\n");

  // Save deployment info
  const deploymentInfo = {
    network: "celo-mainnet",
    chainId: 42220,
    deployer: deployer.address,
    contract: "StreamSavePoolZK",
    address: poolAddress,
    timestamp: new Date().toISOString(),
    transactionHash: poolContract.deploymentTransaction()?.hash,
  };

  console.log("📋 Deployment Info:");
  console.log(JSON.stringify(deploymentInfo, null, 2));
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Deployment failed:", error);
    process.exit(1);
  });
