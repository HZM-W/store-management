// script.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-app.js";
import {
  getFirestore, collection, getDocs, setDoc, doc, addDoc,
  query, orderBy, updateDoc, increment, serverTimestamp, getDoc
} from "https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js";

/*
  Replace the object below with your Firebase project config.
  You get this from Firebase Console -> Project Settings -> Your apps -> Config
*/
const firebaseConfig = {
  apiKey: "AIzaSyD8-AhyflwKBlLaQg0kPgTRs9b8xH5bfgM",
  authDomain: "store-management-84948.firebaseapp.com",
  projectId: "store-management-84948",
  storageBucket: "store-management-84948.firebasestorage.app",
  messagingSenderId: "97089595999",
  appId: "1:97089595999:web:41774b502573e3462c49ea"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

/* ---------- Utility ---------- */
function createBadge(status) {
  if (!status) return `<span class="badge badge-in">Unknown</span>`;
  return status.toLowerCase().includes('low')
    ? `<span class="badge badge-low">Low Stock</span>`
    : `<span class="badge badge-in">In Stock</span>`;
}

function fmtDate(ts) {
  if (!ts) return "";
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleString();
}

/* ---------- Inventory page ---------- */
export async function loadInventory() {
  const tbody = document.getElementById('inventoryTable');
  if (!tbody) return;
  tbody.innerHTML = '';
  const itemsRef = collection(db, 'items');
  const q = query(itemsRef, orderBy('sku'));
  const snap = await getDocs(q);
  let total = 0, count = 0;
  snap.forEach(docSnap => {
    const data = docSnap.data();
    const qty = Number(data.qty || 0);
    total += qty;
    count++;
    const row = `
      <tr>
        <td>${data.sku || docSnap.id}</td>
        <td><strong>${data.name || ''}</strong></td>
        <td>${data.category || ''}</td>
        <td>${qty}</td>
        <td>${createBadge(data.status || (qty <= 5 ? 'Low Stock' : 'In Stock'))}</td>
      </tr>`;
    tbody.innerHTML += row;
  });
  document.getElementById('totalItems').innerText = total;
  document.getElementById('productCount').innerText = `Across ${count} products`;
}

/* ---------- Items page ---------- */
export async function initItemsPage() {
  const form = document.getElementById('addItemForm');
  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const sku = document.getElementById('sku').value.trim();
      const name = document.getElementById('name').value.trim();
      const category = document.getElementById('category').value.trim();
      const currentStock = parseInt(document.getElementById('currentStock').value || '0', 10);

      if (!sku || !name || !category) {
        alert('Please fill SKU, Item Name and Category.');
        return;
      }

      // Use SKU as document ID for convenience
      await setDoc(doc(db, 'items', sku), {
        sku, name, category,
        qty: currentStock,
        status: currentStock <= 5 ? 'Low Stock' : 'In Stock'
      });

      alert('Item added');
      window.location.href = 'index.html'; // go to inventory
    });
  }

  // Load all items into table
  const table = document.getElementById('allItemsTable');
  if (table) {
    table.innerHTML = '';
    const q = query(collection(db, 'items'), orderBy('sku'));
    const snap = await getDocs(q);
    snap.forEach(d => {
      const data = d.data();
      table.innerHTML += `<tr><td>${data.sku || d.id}</td><td>${data.name || ''}</td><td>${data.category || ''}</td><td>${data.qty || 0}</td></tr>`;
    });
  }
}

/* ---------- Transactions page ---------- */
export async function initTransactionsPage() {
  // Submit form
  const form = document.getElementById('addTransactionForm');
  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const sku = document.getElementById('txSku').value.trim();
      const type = document.getElementById('txType').value; // 'in' or 'out'
      const qty = Math.max(0, parseInt(document.getElementById('txQty').value || '0', 10));
      const notes = document.getElementById('txNotes').value || '';

      if (!sku || qty <= 0) {
        alert('Please provide SKU and a quantity > 0');
        return;
      }

      const change = type === 'in' ? qty : -qty;
      const itemRef = doc(db, 'items', sku);

      // Update item quantity
      try {
        await updateDoc(itemRef, { qty: increment(change) });
      } catch (err) {
        // If it does not exist, show error
        alert('Failed to update item. Make sure item (SKU) exists.');
        console.error(err);
        return;
      }

      // Update status based on new qty
      try {
        const snap = await getDoc(itemRef);
        const newQty = (snap.data()?.qty ?? 0);
        const newStatus = newQty <= 5 ? 'Low Stock' : 'In Stock';
        await updateDoc(itemRef, { status: newStatus });
      } catch (err) {
        console.warn('Could not update computed status', err);
      }

      // Add transaction record
      await addDoc(collection(db, 'transactions'), {
        sku, type: type === 'in' ? 'Stock In' : 'Stock Out',
        qtyChange: change,
        notes,
        timestamp: serverTimestamp()
      });

      alert('Transaction recorded');
      window.location.reload();
    });
  }

  // Load transactions table
  const tbody = document.getElementById('transactionsTable');
  if (tbody) {
    tbody.innerHTML = '';
    const q = query(collection(db, 'transactions'), orderBy('timestamp', 'desc'));
    const snap = await getDocs(q);
    snap.forEach(d => {
      const data = d.data();
      tbody.innerHTML += `<tr>
        <td>${fmtDate(data.timestamp)}</td>
        <td>${data.type || ''}</td>
        <td>${data.sku || ''}</td>
        <td>${data.itemName || ''}</td>
        <td>${(data.qtyChange > 0 ? '+' : '') + data.qtyChange } ${data.notes || ''}</td>
      </tr>`;
    });
  }
}

/* ---------- Auto-run depending on page ---------- */
(function runPageInit() {
  if (document.getElementById('inventoryTable')) {
    loadInventory();
    // search
    const s = document.getElementById('searchInventory');
    if (s) s.addEventListener('input', () => { /* small: add client-side filter if you want */ });
  }
  if (document.getElementById('addItemForm')) {
    initItemsPage();
  }
  if (document.getElementById('addTransactionForm')) {
    initTransactionsPage();
  }
})();
