import crypto from "crypto";
import fs from "fs";
import path from "path";

const CHAIN_FILE = path.join("data", "chain.json");

if (!fs.existsSync("data")) fs.mkdirSync("data");
if (!fs.existsSync(CHAIN_FILE)) fs.writeFileSync(CHAIN_FILE, JSON.stringify([]));

let blockchain = JSON.parse(fs.readFileSync(CHAIN_FILE));

export function getLastBlock() {
  return blockchain.length ? blockchain[blockchain.length - 1] : null;
}

export function calculateHash(index, previousHash, timestamp, transactions, nonce) {
  const data = index + previousHash + timestamp + JSON.stringify(transactions) + nonce;
  return crypto.createHash("sha256").update(data).digest("hex");
}

// Mine block (PoW ligero)
export function mineBlock(transactions, difficulty = 3) {
  const lastBlock = getLastBlock();
  const index = lastBlock ? lastBlock.index + 1 : 0;
  const previousHash = lastBlock ? lastBlock.hash : "0";
  const timestamp = Date.now();
  let nonce = 0;
  let hash = "";

  do {
    nonce++;
    hash = calculateHash(index, previousHash, timestamp, transactions, nonce);
  } while (!hash.startsWith("0".repeat(difficulty)));

  const block = { index, previousHash, timestamp, transactions, nonce, hash };
  blockchain.push(block);
  fs.writeFileSync(CHAIN_FILE, JSON.stringify(blockchain, null, 2));
  return block;
}

// Add transaction to blockchain and mine block
export function addTransactionToBlockchain(transaction) {
  const block = mineBlock([transaction]);
  return block.index;
}

// Get balances
export function getBalances() {
  const balances = {};
  blockchain.forEach(block => {
    block.transactions.forEach(tx => {
      if (tx.type === "MINING" || tx.type === "FILE_UPLOAD") {
        balances[tx.address] = (balances[tx.address] || 0) + tx.amount;
      }
    });
  });
  return balances;
}

// Get full blockchain
export function getBlockchain() {
  return blockchain;
}
