const canvas = document.getElementById("c");
const ctx = canvas.getContext("2d");
canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

let score = 0;
let blocksMined = 0;
let mining = false;
let particles = [];

// Clave privada local para simular dirección
let privateKeyHex = localStorage.getItem("cognitechain_key");
if (!privateKeyHex) {
  const arr = new Uint8Array(32);
  crypto.getRandomValues(arr);
  privateKeyHex = Array.from(arr, b => b.toString(16).padStart(2,'0')).join('');
  localStorage.setItem("cognitechain_key", privateKeyHex);
}
const myAddress = privateKeyHex.substring(0,16) + "..." + privateKeyHex.slice(-8);
document.getElementById("addr").textContent = myAddress;

let jaula = { x: canvas.width/2, y: canvas.height/2, hp: 1000, maxHp: 1000, radius: 150 };

function createParticles(x,y){
  for(let i=0;i<30;i++){
    particles.push({x,y,vx:Math.random()*10-5,vy:Math.random()*10-5,life:60,color:`hsl(${Math.random()*60+80},100%,50%)`});
  }
}

async function golpear(){
  if(mining) return;
  mining=true;
  jaula.hp -= 69 + Math.random()*30;
  createParticles(jaula.x+Math.random()*200-100, jaula.y+Math.random()*200-100);
  showMessage("¡GOLPE CRÍTICO!");

  if(jaula.hp<=0){
    blocksMined++;
    score += 690;
    document.getElementById("blocks").textContent = blocksMined;
    // enviar transacción al nodo COGNITECHAIN
    try {
      const resp = await fetch("http://localhost:3001/api/mine", {
        method:"POST",
        headers:{"Content-Type":"application/json"},
        body:JSON.stringify({address:myAddress,blocksMined,score})
      });
      const data = await resp.json();
      if(data.success) updateBalance();
    } catch(err){console.error(err);}
    jaula.hp = jaula.maxHp + blocksMined*200;
  }
  setTimeout(()=>mining=false,200);
}

function showMessage(text){
  const msg=document.getElementById("msg");
  msg.textContent=text;
  msg.style.opacity=1;
  setTimeout(()=>msg.style.opacity=0,1500);
}

function draw(){
  ctx.fillStyle="rgba(0,0,0,0.1)";
  ctx.fillRect(0,0,canvas.width,canvas.height);
  const ratio=jaula.hp/jaula.maxHp;
  ctx.strokeStyle=ratio>0.3?"#0f0":"#f00";
  ctx.lineWidth=20;
  ctx.beginPath();
  ctx.arc(jaula.x,jaula.y,jaula.radius,0,Math.PI*2*ratio);
  ctx.stroke();
  ctx.font="40px Courier";
  ctx.fillStyle="#0f0";
  ctx.textAlign="center";
  ctx.fillText("JAULA", jaula.x, jaula.y-200);
  particles.forEach((p,i)=>{
    p.x+=p.vx; p.y+=p.vy; p.life--;
    ctx.fillStyle=p.color;
    ctx.globalAlpha=p.life/60;
    ctx.fillRect(p.x,p.y,10,10);
    if(p.life<=0) particles.splice(i,1);
  });
  ctx.globalAlpha=1;
  requestAnimationFrame(draw);
}

async function updateBalance(){
  try{
    const resp = await fetch("http://localhost:3001/api/balances");
    const balances = await resp.json();
    document.getElementById("balance").textContent = balances[myAddress]||0;
  } catch(err){console.error(err);}
}

// Subir archivo
async function subirArchivo(){
  const input = document.getElementById("fileInput");
  if(!input.files.length) return alert("Selecciona un archivo");
  const file = input.files[0];
  const arrayBuffer = await file.arrayBuffer();
  const hashBuffer = await crypto.subtle.digest("SHA-256", arrayBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map(b=>b.toString(16).padStart(2,"0")).join("");
  const formData = new FormData();
  formData.append("file",file);
  formData.append("hash",hashHex);
  formData.append("address",myAddress);
  try{
    const resp = await fetch("http://localhost:3001/api/upload",{method:"POST",body:formData});
    const data = await resp.json();
    if(data.success) document.getElementById("uploadStatus").textContent = `Archivo registrado en bloque ${data.blockIndex}`;
    else document.getElementById("uploadStatus").textContent = `Error: ${data.error}`;
    updateBalance();
  } catch(err){console.error(err);}
}

window.onclick = golpear;
window.onkeydown = e => e.key===" "&&golpear();
draw();
updateBalance();
showMessage("¡Dale a la jaula y sube archivos en COGNITECHAIN!");
