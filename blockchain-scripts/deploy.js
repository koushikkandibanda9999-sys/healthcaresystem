/**
 * Hardhat deployment script for MedicalRecords.sol
 *
 * Usage:
 *   npx hardhat run blockchain-scripts/deploy.js --network localhost
 *   npx hardhat run blockchain-scripts/deploy.js --network hardhat
 *
 * After deployment, copy the contract address into your .env:
 *   CONTRACT_ADDRESS=0x...
 */

const { ethers } = require("hardhat");
const fs         = require("fs");
const path       = require("path");

async function main() {
  const [deployer] = await ethers.getSigners();

  console.log("=".repeat(60));
  console.log("Deploying MedicalRecords.sol");
  console.log("Deployer:", deployer.address);
  console.log(
    "Balance:",
    ethers.formatEther(await ethers.provider.getBalance(deployer.address)),
    "ETH"
  );
  console.log("=".repeat(60));

  const Factory  = await ethers.getContractFactory("MedicalRecords");
  const contract = await Factory.deploy();
  await contract.waitForDeployment();

  const address = await contract.getAddress();
  console.log("✓ MedicalRecords deployed to:", address);
  console.log("  Owner:", await contract.owner());

  // ----------------------------------------------------------
  // Persist deployment info for other scripts and the backend
  // ----------------------------------------------------------
  const network     = await ethers.provider.getNetwork();
  const deployInfo  = {
    network:         network.name,
    chainId:         network.chainId.toString(),
    contractAddress: address,
    deployerAddress: deployer.address,
    deployedAt:      new Date().toISOString(),
  };

  const outDir  = path.join(__dirname, "..", "artifacts", "deployments");
  const outFile = path.join(outDir, `${network.name}-${network.chainId}.json`);
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(outFile, JSON.stringify(deployInfo, null, 2));
  console.log("✓ Deployment info saved to:", outFile);

  // Also write a simple .env fragment for convenience
  console.log("\nAdd to your .env:\n");
  console.log(`CONTRACT_ADDRESS=${address}`);
  console.log("=".repeat(60));
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Deployment failed:", err);
    process.exit(1);
  });
