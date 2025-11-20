# backend/app.py
from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
from werkzeug.utils import secure_filename
import os, json, time, hashlib

# Config
UPLOAD_DIR = "uploads"
DATA_DIR = "data"
CHAIN_FILE = os.path.join(DATA_DIR, "chain.json")
ALLOWED_EXT = None  # None = allow all; ajusta si quieres filtrar
POW_DIFFICULTY = 3  # aumenta para hacer PoW más duro

# Ensure dirs
os.makedirs(UPLOAD_DIR, exist_ok=True)
os.makedirs(DATA_DIR, exist_ok=True)
if not os.path.exists(CHAIN_FILE):
    with open(CHAIN_FILE, "w") as f:
        json.dump([], f, indent=2)

app = Flask(__name__)
CORS(app)  # por defecto permite todo; en producción restringe orígenes

# ------------------ Utilities ------------------
def load_chain():
    with open(CHAIN_FILE, "r") as f:
        return json.load(f)

def save_chain(chain):
    with open(CHAIN_FILE, "w") as f:
        json.dump(chain, f, indent=2)

def get_last_block(chain):
    return chain[-1] if len(chain) else None

def calculate_hash(index, previous_hash, timestamp, transactions, nonce):
    payload = f"{index}{previous_hash}{timestamp}{json.dumps(transactions, sort_keys=True)}{nonce}"
    return hashlib.sha256(payload.encode("utf-8")).hexdigest()

def mine_block(transactions, difficulty=POW_DIFFICULTY):
    chain = load_chain()
    last = get_last_block(chain)
    index = last["index"] + 1 if last else 0
    previous_hash = last["hash"] if last else "0"
    timestamp = int(time.time() * 1000)
    nonce = 0
    hash_val = ""
    target = "0" * difficulty
    # PoW loop (ligero)
    while True:
        nonce += 1
        hash_val = calculate_hash(index, previous_hash, timestamp, transactions, nonce)
        if hash_val.startswith(target):
            break
    block = {
        "index": index,
        "previousHash": previous_hash,
        "timestamp": timestamp,
        "transactions": transactions,
        "nonce": nonce,
        "hash": hash_val
    }
    chain.append(block)
    save_chain(chain)
    return block

def add_transaction_and_mine(tx):
    # Aquí cada transacción se mina en su propio bloque (simple)
    block = mine_block([tx])
    return block

def get_balances():
    chain = load_chain()
    balances = {}
    for block in chain:
        for tx in block.get("transactions", []):
            # solo consideramos transacciones que acrediten tokens (MINING, FILE_UPLOAD)
            typ = tx.get("type")
            addr = tx.get("address")
            amt = int(tx.get("amount", 0))
            if typ in ("MINING", "FILE_UPLOAD", "TRANSFER"):
                balances[addr] = balances.get(addr, 0) + amt
    return balances

# ------------------ API Endpoints ------------------

@app.route("/api/health", methods=["GET"])
def health():
    return jsonify({"status":"ok"})

@app.route("/api/mine", methods=["POST"])
def api_mine():
    """
    Body JSON: { address: str, blocksMined: int, score: optional }
    Rewards: 690 * blocksMined (integer)
    """
    try:
        data = request.get_json(force=True)
        address = data.get("address")
        blocks_mined = int(data.get("blocksMined", 0))
        score = data.get("score", 0)
        if not address or blocks_mined <= 0:
            return jsonify({"error":"Parámetros inválidos"}), 400

        amount = 690 * blocks_mined
        tx = {
            "type":"MINING",
            "address": address,
            "amount": amount,
            "blocksMined": blocks_mined,
            "score": score,
            "timestamp": int(time.time() * 1000)
        }
        block = add_transaction_and_mine(tx)
        return jsonify({"success": True, "blockIndex": block["index"], "amount": amount})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route("/api/upload", methods=["POST"])
def api_upload():
    """
    multipart/form-data:
      file -> archivo
      hash -> hash sha256 provisto por cliente
      address -> dirección del usuario
    Recompensa fija por upload: 100 (puedes cambiar)
    """
    try:
        if "file" not in request.files:
            return jsonify({"error":"No file part"}), 400
        file = request.files["file"]
        file_hash = request.form.get("hash")
        address = request.form.get("address")
        if not file_hash or not address:
            return jsonify({"error":"Faltan parámetros hash/address"}), 400

        filename = secure_filename(file.filename) or f"upload-{int(time.time())}"
        save_path = os.path.join(UPLOAD_DIR, filename)
        file.save(save_path)

        # Opcional: verificar hash calculado del archivo (recomendado)
        with open(save_path, "rb") as f:
            blob = f.read()
            calc_hash = hashlib.sha256(blob).hexdigest()
        if calc_hash != file_hash:
            # eliminar archivo si hash no coincide (seguridad)
            os.remove(save_path)
            return jsonify({"error":"Hash del archivo no coincide"}), 400

        tx = {
            "type":"FILE_UPLOAD",
            "address": address,
            "filename": filename,
            "hash": file_hash,
            "amount": 100,
            "timestamp": int(time.time() * 1000)
        }
        block = add_transaction_and_mine(tx)
        return jsonify({"success": True, "blockIndex": block["index"]})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route("/api/balances", methods=["GET"])
def api_balances():
    try:
        balances = get_balances()
        return jsonify(balances)
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route("/api/chain", methods=["GET"])
def api_chain():
    try:
        chain = load_chain()
        return jsonify(chain)
    except Exception as e:
        return jsonify({"error": str(e)}), 500

# Serve uploaded files (optional)
@app.route("/uploads/<path:filename>", methods=["GET"])
def serve_upload(filename):
    return send_from_directory(UPLOAD_DIR, filename, as_attachment=False)

if __name__ == "__main__":
    # Run dev server
    app.run(host="0.0.0.0", port=3001, debug=True)
