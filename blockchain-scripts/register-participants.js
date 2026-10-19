require("dotenv").config();
const { ethers } = require("ethers");

async function main() {
  const provider = new ethers.JsonRpcProvider(process.env.HARDHAT_RPC_URL || "http://127.0.0.1:8545");
  const signer   = new ethers.Wallet(process.env.BACKEND_SIGNER_PRIVATE_KEY, provider);
  const ABI = [
    "function registerHospital(address, string) external",
    "function registerDoctor(address, address) external",
  ];
  const c = new ethers.Contract(process.env.CONTRACT_ADDRESS, ABI, signer);

  const hA = "0x70997970C51812dc3A010C7d01b50e0d17dc79C8";
  const hB = "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC";
  const dA = "0x90F79bf6EB2c4f870365E785982E1f101E93b906";
  const dB = "0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65";

  let tx;
  tx = await c.registerHospital(hA, "City General Hospital (Hospital A)"); await tx.wait();
  console.log("Hospital A registered:", tx.hash);

  tx = await c.registerHospital(hB, "Metro Health Centre (Hospital B)"); await tx.wait();
  console.log("Hospital B registered:", tx.hash);

  tx = await c.registerDoctor(dA, hA); await tx.wait();
  console.log("Doctor A registered:", tx.hash);

  tx = await c.registerDoctor(dB, hB); await tx.wait();
  console.log("Doctor B registered:", tx.hash);

  console.log("\nAll participants registered on-chain!");
  process.exit(0);
}

main().catch(e => { console.error("Error:", e.message); process.exit(1); });
