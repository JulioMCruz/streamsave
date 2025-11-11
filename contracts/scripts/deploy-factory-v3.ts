import { ethers } from "hardhat";
import hre from "hardhat";

async function main() {
  console.log("Deploying StreamSaveFactoryV3 to Celo Mainnet...");

  const CELO_USDC = "0xcebA9300f2b948710d2653dD7B07f33A8B32118C";

  // Deploy StreamSaveFactoryV3
  const StreamSaveFactoryV3 = await ethers.getContractFactory("StreamSaveFactoryV3");
  console.log("Deploying factory contract...");

  const factory = await StreamSaveFactoryV3.deploy(CELO_USDC);
  await factory.waitForDeployment();

  const factoryAddress = await factory.getAddress();
  console.log("✅ StreamSaveFactoryV3 deployed to:", factoryAddress);

  // Wait for a few block confirmations
  console.log("Waiting for block confirmations...");
  await factory.deploymentTransaction()?.wait(5);

  // Verify on CeloScan
  console.log("Verifying contract on CeloScan...");
  try {
    await hre.run("verify:verify", {
      address: factoryAddress,
      constructorArguments: [CELO_USDC],
    });
    console.log("✅ Contract verified on CeloScan");
  } catch (error: any) {
    if (error.message.includes("Already Verified")) {
      console.log("✅ Contract already verified on CeloScan");
    } else {
      console.error("❌ Verification failed:", error.message);
    }
  }

  console.log("\n📋 Deployment Summary:");
  console.log("Factory V3 Address:", factoryAddress);
  console.log("USDC Token:", CELO_USDC);
  console.log("Network: Celo Mainnet");
  console.log("\nUpdate frontend with:");
  console.log(`export const FACTORY_V3_ADDRESS: Address = '${factoryAddress}';`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
