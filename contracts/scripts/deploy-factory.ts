import { ethers } from "hardhat";

async function main() {
  console.log("\n🚀 Deploying StreamSave Factory to Celo Mainnet...\n");

  const [deployer] = await ethers.getSigners();
  console.log("Deploying with account:", deployer.address);
  console.log("Account balance:", ethers.formatEther(await ethers.provider.getBalance(deployer.address)), "CELO");

  // Celo Mainnet USDC address
  const CELO_USDC = "0xcebA9300f2b948710d2653dD7B07f33A8B32118C";

  // Deploy StreamSaveFactory
  console.log("\n📦 Deploying StreamSaveFactory...");
  const StreamSaveFactory = await ethers.getContractFactory("StreamSaveFactory");
  const factory = await StreamSaveFactory.deploy(CELO_USDC);

  await factory.waitForDeployment();
  const factoryAddress = await factory.getAddress();

  console.log("\n✅ StreamSaveFactory deployed!");
  console.log("   Factory Address:", factoryAddress);
  console.log("   USDC Token:", CELO_USDC);

  // Wait for a few block confirmations before verification
  console.log("\n⏳ Waiting for block confirmations...");
  await factory.deploymentTransaction()?.wait(5);

  // Verify on Celoscan
  console.log("\n🔍 Verifying contract on Celoscan...");
  try {
    await hre.run("verify:verify", {
      address: factoryAddress,
      constructorArguments: [CELO_USDC],
    });
    console.log("✅ Contract verified on Celoscan!");
  } catch (error: any) {
    if (error.message.includes("Already Verified")) {
      console.log("✅ Contract already verified!");
    } else {
      console.log("⚠️  Verification failed:", error.message);
      console.log("   You can verify manually later with:");
      console.log(`   npx hardhat verify --network celo ${factoryAddress} ${CELO_USDC}`);
    }
  }

  console.log("\n📋 Deployment Summary:");
  console.log("==================================================");
  console.log("Network:         Celo Mainnet");
  console.log("Factory Address:", factoryAddress);
  console.log("USDC Token:     ", CELO_USDC);
  console.log("Deployer:       ", deployer.address);
  console.log("==================================================");

  console.log("\n📝 Next Steps:");
  console.log("1. Update frontend .env.local with factory address:");
  console.log(`   NEXT_PUBLIC_FACTORY_ADDRESS=${factoryAddress}`);
  console.log("\n2. Update frontend/lib/contracts/StreamSaveFactory.ts");
  console.log("\n3. Test group creation through the UI");

  console.log("\n✨ Deployment complete!");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
