import express from "express";
import cors from "cors";
import multer from "multer";
import fs from "fs";
import path from "path";
import { addTransactionToBlockchain, getBalances, getBlockchain } from "./blockchain.js";

const app = express();
app.use(cors());
app.use(express.json());

const upload = multer({ dest: "uploads/" });
if (!fs.existsSync("uploads")) fs.mkdirSync("uploads");

// Endpoint minado desde juego
app.post("/api/mine", (req, res) => {
  try {
    const { address, blocksMined, score } = req.body;
    if (!address || typeof blocksMined !== "number") return res.status(400).json({ error: "Datos inválidos" });

    const transaction = {
      type: "MINING",
      address,
      amount: 690 * blocksMined,
      score,
      timestamp: Date.now()
    };
    const blockIndex = addTransactionToBlockchain(transaction);
    res.json({ success: true, blockIndex, amount: transaction.amount });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Endpoint para subir archivo
app.post("/api/upload", upload.single("file"), (req, res) => {
  try {
    const { hash, address } = req.body;
    const file = req.file;
    if (!file || !hash || !address) return res.status(400).json({ error: "Faltan datos" });

    const destPath = path.join("uploads", file.originalname);
    fs.renameSync(file.path, destPath);

    const transaction = {
      type: "FILE_UPLOAD",
      address,
      filename: file.originalname,
      hash,
      amount: 100, // recompensa por subir archivo
      timestamp: Date.now()
    };
    const blockIndex = addTransactionToBlockchain(transaction);
    res.json({ success: true, blockIndex });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Consultar balances
app.get("/api/balances", (req, res) => {
  res.json(getBalances());
});

// Consultar blockchain
app.get("/api/chain", (req, res) => {
  res.json(getBlockchain());
});

app.listen(3001, () => console.log("COGNITECHAIN node corriendo en puerto 3001"));
