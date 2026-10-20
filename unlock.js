const FILES = ["seasons", "home", "draft", "records", "hall_of_shame",
               "finals", "trades", "adds", "site_trades", "people", "extra"];
const ITER = 200000;   // must match encrypt_site.py

const nav = document.getElementById("nav");
if (nav) nav.style.display = "none";

function b64ToBytes(s) {
  return Uint8Array.from(atob(s.trim()), c => c.charCodeAt(0));
}

async function decryptFile(name, password) {
  const text = await (await fetch(`${name}.enc`)).text();
  const raw = b64ToBytes(text);
  const salt = raw.slice(0, 16), nonce = raw.slice(16, 28), ct = raw.slice(28);
  const base = await crypto.subtle.importKey(
    "raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveKey"]);
  const key = await crypto.subtle.deriveKey(
    { name: "PBKDF2", salt, iterations: ITER, hash: "SHA-256" },
    base, { name: "AES-GCM", length: 256 }, false, ["decrypt"]);
  const plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv: nonce }, key, ct);
  return JSON.parse(new TextDecoder().decode(plain));
}

async function unlock(password) {
  const data = {};
  for (const name of FILES) data[name] = await decryptFile(name, password);
  return data;
}

function showGate(message) {
  const app = document.getElementById("app");
  app.innerHTML = `
    <div class="card" style="max-width:360px;margin:40px auto;">
      <h1>Trinity Goobers</h1>
      <p class="note">Enter the league password to view the site.</p>
      <form id="gate">
        <input class="search" id="pw" type="password" autocomplete="current-password" placeholder="Password" required>
        <button class="toggle" type="submit"><span class="tag">Enter</span></button>
        <p class="note" id="msg">${message || ""}</p>
      </form>
    </div>`;
  document.getElementById("gate").addEventListener("submit", async e => {
    e.preventDefault();
    const pw = document.getElementById("pw").value;
    document.getElementById("msg").textContent = "Unlocking…";
    try {
      window.DATA = await unlock(pw);
      if (nav) nav.style.display = "";
      const s = document.createElement("script");
      s.src = "app.js";
      document.body.appendChild(s);
    } catch (err) {
      showGate("Wrong password, or the data files are missing. Try again.");
    }
  });
}

showGate("");