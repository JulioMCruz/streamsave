import { ethers } from "hardhat";

/**
 * Deploy a single StreamSaveROSCA contract
 * Each ROSCA group gets its own contract deployment
 */
async function main() {
  console.log("Deploying StreamSaveROSCA contract...\n");

  const [deployer] = await ethers.getSigners();
  console.log("Deploying with account:", deployer.address);

  // Get account balance
  const balance = await ethers.provider.getBalance(deployer.address);
  console.log("Account balance:", ethers.formatEther(balance), "CELO\n");

  // ROSCA Configuration
  const CELO_USDC = process.env.CELO_USDC_ADDRESS || "0xcebA9300f2b948710d2653dD7B07f33A8B32118C";

  // Example ROSCA parameters (adjust as needed)
  const merkleRoot = "0x" + "0".repeat(64); // Replace with actual merkle root
  const contributionAmount = ethers.parseUnits("10", 6); // 10 USDC per cycle
  const streamRate = ethers.parseUnits("0.1", 6) / 3600n; // ~$0.1/hour = 0.0000277 USDC/second
  const cycleDuration = 30 * 24 * 60 * 60; // 30 days in seconds
  const totalParticipants = 10; // 10 participants

  console.log("ROSCA Configuration:");
  console.log("- USDC Token:", CELO_USDC);
  console.log("- Contribution Amount:", ethers.formatUnits(contributionAmount, 6), "USDC");
  console.log("- Stream Rate:", ethers.formatUnits(streamRate * 3600n, 6), "USDC/hour");
  console.log("- Cycle Duration:", cycleDuration / (24 * 60 * 60), "days");
  console.log("- Total Participants:", totalParticipants);
  console.log("- Total Pool per Round:", ethers.formatUnits(contributionAmount * BigInt(totalParticipants), 6), "USDC\n");

  // Deploy StreamSaveROSCA
  const StreamSaveROSCA = await ethers.getContractFactory("StreamSaveROSCA");

  console.log("Deploying contract...");
  const rosca = await StreamSaveROSCA.deploy(
    CELO_USDC,
    merkleRoot,
    contributionAmount,
    streamRate,
    cycleDuration,
    totalParticipants
  );

  await rosca.waitForDeployment();
  const roscaAddress = await rosca.getAddress();

  console.log("\n✅ StreamSaveROSCA deployed to:", roscaAddress);

  // Display contract info
  const info = await rosca.getROSCAInfo();
  console.log("\nContract State:");
  console.log("- Token:", info[0]);
  console.log("- Contribution Amount:", ethers.formatUnits(info[1], 6), "USDC");
  console.log("- Stream Rate:", ethers.formatUnits(info[2] * 3600n, 6), "USDC/hour");
  console.log("- Cycle Duration:", Number(info[3]) / (24 * 60 * 60), "days");
  console.log("- Total Participants:", Number(info[4]));
  console.log("- Current Round:", Number(info[5]));
  console.log("- Total Contributed:", ethers.formatUnits(info[6], 6), "USDC");
  console.log("- Is Active:", info[7]);
  console.log("- Participant Count:", Number(info[8]));

  console.log("\n⚠️  IMPORTANT: Save this contract address!");
  console.log("Contract Address:", roscaAddress);
  console.log("\nVerification command:");
  console.log(`npx hardhat verify --network celo ${roscaAddress} "${CELO_USDC}" "${merkleRoot}" "${contributionAmount}" "${streamRate}" "${cycleDuration}" "${totalParticipants}"`);

  console.log("\n📝 Update your .env file:");
  console.log(`STREAMSAVE_POOL_ADDRESS=${roscaAddress}`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
