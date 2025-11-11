import { ethers } from "hardhat";
import * as dotenv from "dotenv";

dotenv.config();

async function main() {
  const [deployer] = await ethers.getSigners();
  const network = await ethers.provider.getNetwork();

  console.log("=".repeat(60));
  console.log("StreamSave Pool Deployment");
  console.log("=".repeat(60));
  console.log(`Network: ${network.name} (Chain ID: ${network.chainId})`);
  console.log(`Deployer: ${deployer.address}`);
  console.log(`Balance: ${ethers.formatEther(await ethers.provider.getBalance(deployer.address))} CELO`);
  console.log("=".repeat(60));

  // Get x402 facilitator address from environment
  const facilitatorAddress = process.env.X402_FACILITATOR_ADDRESS || ethers.ZeroAddress;

  if (facilitatorAddress === ethers.ZeroAddress) {
    console.warn("⚠️  WARNING: No X402_FACILITATOR_ADDRESS set in .env");
    console.warn("⚠️  Using zero address - update after deployment");
  }

  console.log("\n📝 Deploying StreamSavePool contract...");
  console.log(`X402 Facilitator: ${facilitatorAddress}`);

  const StreamSavePool = await ethers.getContractFactory("StreamSavePool");
  const pool = await StreamSavePool.deploy(facilitatorAddress);

  await pool.waitForDeployment();
  const poolAddress = await pool.getAddress();

  console.log("\n✅ StreamSavePool deployed!");
  console.log(`Contract Address: ${poolAddress}`);
  console.log("=".repeat(60));

  // Save deployment info
  const deploymentInfo = {
    network: network.name,
    chainId: network.chainId.toString(),
    contract: "StreamSavePool",
    address: poolAddress,
    deployer: deployer.address,
    facilitator: facilitatorAddress,
    timestamp: new Date().toISOString(),
    blockNumber: await ethers.provider.getBlockNumber(),
  };

  console.log("\n📋 Deployment Info:");
  console.log(JSON.stringify(deploymentInfo, null, 2));

  // Verify we're on Celo Mainnet (only network with EIP-3009 USDC support)
  if (network.chainId !== 42220n) {
    throw new Error(`❌ Must deploy on Celo Mainnet (chainId: 42220). Current network: ${network.chainId}\n` +
                    `   Alfajores testnet does NOT support EIP-3009.`);
  }

  // Celo Mainnet USDC (EIP-3009 compatible)
  const usdcAddress = process.env.CELO_USDC_ADDRESS || "0xcebA9300f2b948710d2653dD7B07f33A8B32118C";
  console.log(`\n💵 Celo Mainnet USDC (EIP-3009): ${usdcAddress}`);
  console.log(`   View on Celoscan: https://celoscan.io/token/${usdcAddress}`);

  console.log("\n📌 Next Steps:");
  console.log("1. Verify contract on CeloScan:");
  console.log(`   npx hardhat verify --network ${network.name} ${poolAddress} "${facilitatorAddress}"`);
  console.log("2. Update X402_FACILITATOR_ADDRESS in .env if needed");
  console.log("3. Test with 3 wallets and 0.001 USDC deposits");
  console.log("=".repeat(60));
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Deployment failed:");
    console.error(error);
    process.exit(1);
  });
