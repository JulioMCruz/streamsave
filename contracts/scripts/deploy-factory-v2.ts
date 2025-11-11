import { ethers } from "hardhat";

async function main() {
  console.log("🚀 Deploying StreamSaveFactoryV2 to Celo Mainnet...\n");

  // Celo Mainnet USDC address
  const CELO_USDC = "0xcebA9300f2b948710d2653dD7B07f33A8B32118C";

  // Deploy the factory
  const StreamSaveFactoryV2 = await ethers.getContractFactory("StreamSaveFactoryV2");
  const factory = await StreamSaveFactoryV2.deploy(CELO_USDC);

  await factory.waitForDeployment();

  const factoryAddress = await factory.getAddress();

  console.log("✅ StreamSaveFactoryV2 deployed!");
  console.log("   Factory Address:", factoryAddress);
  console.log("   USDC Token:", CELO_USDC);
  console.log("\n📝 Update your frontend .env.local:");
  console.log(`   NEXT_PUBLIC_FACTORY_V2_ADDRESS=${factoryAddress}\n`);

  // Wait for a few block confirmations
  console.log("⏳ Waiting for block confirmations...");
  await factory.deploymentTransaction()?.wait(5);

  // Verify on CeloScan
  console.log("\n🔍 Verifying contract on CeloScan...");
  try {
    await hre.run("verify:verify", {
      address: factoryAddress,
      constructorArguments: [CELO_USDC],
    });
    console.log("✅ Contract verified on CeloScan!");
  } catch (error: any) {
    if (error.message.includes("Already Verified")) {
      console.log("✅ Contract already verified on CeloScan!");
    } else {
      console.error("❌ Verification failed:", error.message);
    }
  }

  console.log("\n🎉 Deployment complete!");
  console.log(`   View on CeloScan: https://celoscan.io/address/${factoryAddress}\n`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
