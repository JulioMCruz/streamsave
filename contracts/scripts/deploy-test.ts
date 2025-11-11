import { ethers } from "hardhat";
import * as dotenv from "dotenv";

dotenv.config();

async function main() {
  const [deployer] = await ethers.getSigners();
  const network = await ethers.provider.getNetwork();

  console.log("=".repeat(60));
  console.log("StreamSave Test Group Deployment - Celo Mainnet");
  console.log("=".repeat(60));
  console.log(`Network: ${network.name} (Chain ID: ${network.chainId})`);
  console.log(`Deployer: ${deployer.address}`);
  console.log(`Balance: ${ethers.formatEther(await ethers.provider.getBalance(deployer.address))} CELO`);
  console.log("=".repeat(60));

  // Verify we're on Celo Mainnet
  if (network.chainId !== 42220n) {
    throw new Error(`❌ Must deploy on Celo Mainnet (chainId: 42220). Current network: ${network.chainId}\n` +
                    `   Alfajores testnet does NOT support EIP-3009.`);
  }

  // USDC on Celo Mainnet
  const USDC_ADDRESS = process.env.CELO_USDC_ADDRESS || "0xcebA9300f2b948710d2653dD7B07f33A8B32118C";

  // Test parameters - 0.001 USDC, 2 minutes, 3 participants
  const contributionAmount = ethers.parseUnits("0.001", 6); // 0.001 USDC
  const streamRate = ethers.parseUnits("0.001", 6); // Same as contribution for testing
  const cycleDuration = 120; // 2 minutes
  const totalParticipants = 3; // 3 participants for quick testing

  // Generate merkle tree for 3 participants
  // For testing, we'll use deployer with different nullifiers
  const participant1Hash = ethers.keccak256(ethers.toUtf8Bytes(deployer.address + "-streamsave-1"));
  const participant2Hash = ethers.keccak256(ethers.toUtf8Bytes(deployer.address + "-streamsave-2"));
  const participant3Hash = ethers.keccak256(ethers.toUtf8Bytes(deployer.address + "-streamsave-3"));

  // Simple merkle root (for testing - production needs proper merkle tree)
  const merkleRoot = ethers.keccak256(
    ethers.concat([participant1Hash, participant2Hash, participant3Hash])
  );

  console.log("\n📝 Test Deployment Parameters:");
  console.log(`Token (USDC): ${USDC_ADDRESS}`);
  console.log(`Contribution: 0.001 USDC`);
  console.log(`Stream Rate: 0.001 USDC`);
  console.log(`Cycle Duration: 2 minutes (120 seconds)`);
  console.log(`Total Participants: 3`);
  console.log(`Merkle Root: ${merkleRoot}`);
  console.log(`Participant 1 Nullifier: ${participant1Hash}`);
  console.log(`Participant 2 Nullifier: ${participant2Hash}`);
  console.log(`Participant 3 Nullifier: ${participant3Hash}`);

  console.log("\n🚀 Deploying StreamSaveROSCA contract...");

  const StreamSave = await ethers.getContractFactory("StreamSaveROSCA");
  const streamSave = await StreamSave.deploy(
    USDC_ADDRESS,
    merkleRoot,
    contributionAmount,
    streamRate, // Required by contract (must be > 0)
    cycleDuration,
    totalParticipants
  );

  await streamSave.waitForDeployment();
  const contractAddress = await streamSave.getAddress();

  console.log("\n✅ StreamSave Test Group Deployed!");
  console.log(`Contract Address: ${contractAddress}`);
  console.log(`View on CeloScan: https://celoscan.io/address/${contractAddress}`);

  // Save deployment info
  const deploymentInfo = {
    network: network.name,
    chainId: network.chainId.toString(),
    contract: "StreamSave",
    address: contractAddress,
    deployer: deployer.address,
    usdcToken: USDC_ADDRESS,
    contributionAmount: "0.001 USDC",
    streamRate: "0.001 USDC",
    cycleDuration: "2 minutes (120 seconds)",
    totalParticipants: 3,
    merkleRoot: merkleRoot,
    timestamp: new Date().toISOString(),
    blockNumber: await ethers.provider.getBlockNumber(),
  };

  console.log("\n📋 Deployment Info:");
  console.log(JSON.stringify(deploymentInfo, null, 2));

  console.log("\n📌 Next Steps:");
  console.log("1. Verify contract on CeloScan:");
  console.log(`   npx hardhat verify --network celo ${contractAddress} \\`);
  console.log(`     "${USDC_ADDRESS}" \\`);
  console.log(`     "${merkleRoot}" \\`);
  console.log(`     "1000" \\`);
  console.log(`     "1000" \\`);
  console.log(`     "120" \\`);
  console.log(`     "3"`);
  console.log("\n2. Update frontend config:");
  console.log(`   File: frontend/lib/contracts/StreamSave.ts`);
  console.log(`   Add: { address: "${contractAddress}", name: "Test Group (2min, 0.001 USDC)" }`);
  console.log("\n3. Approve USDC spending:");
  console.log(`   Visit: https://celoscan.io/token/${USDC_ADDRESS}#writeContract`);
  console.log(`   Call: approve("${contractAddress}", "1000000000")`);
  console.log("\n4. Test payment flow on frontend:");
  console.log(`   http://localhost:3000/groups/${contractAddress}`);
  console.log("=".repeat(60));
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Deployment failed:");
    console.error(error);
    process.exit(1);
  });
