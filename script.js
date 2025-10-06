import { initializeApp } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-app.js";
import {
  getFirestore, collection, getDocs, setDoc, doc, addDoc,
  query, orderBy, updateDoc, increment, serverTimestamp,
  getDoc, deleteDoc
} from "https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js";

/* ---------- Firebase Config ---------- */
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
  if (!status) return `<span class="badge bg-secondary">Unknown</span>`;
  return status.toLowerCase().includes('low')
    ? `<span class="badge bg-danger">Low Stock</span>`
    : `<span class="badge bg-success">In Stock</span>`;
}

function fmtDate(ts) {
  if (!ts) return "";
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleString();
}

/* ---------- Inventory Page ---------- */
export async function loadInventory() {
  const tbody = document.getElementById('inventoryTable');
  if (!tbody) return;

  tbody.innerHTML = '';
  const q = query(collection(db, 'items'), orderBy('sku'));
  const snap = await getDocs(q);

  let total = 0, count = 0, rows = [];

  snap.forEach(docSnap => {
    const data = docSnap.data();
    const qty = Number(data.qty || 0);
    total += qty;
    count++;
    rows.push(`
      <tr>
        <td>${data.sku || docSnap.id}</td>
        <td><strong>${data.name || ''}</strong></td>
        <td>${data.category || ''}</td>
        <td>${qty}</td>
        <td>${createBadge(data.status || (qty <= 5 ? 'Low Stock' : 'In Stock'))}</td>
      </tr>
    `);
  });

  tbody.innerHTML = rows.join('');
  document.getElementById('totalItems').innerText = total;
  document.getElementById('productCount').innerText = `Across ${count} products`;

  const s = document.getElementById('searchInventory');
  if (s) {
    s.addEventListener('input', () => {
      const term = s.value.toLowerCase();
      Array.from(tbody.getElementsByTagName('tr')).forEach(r => {
        r.style.display = r.textContent.toLowerCase().includes(term) ? '' : 'none';
      });
    });
  }
}

/* ---------- Items Page ---------- */
export async function initItemsPage() {
  const tableBody = document.querySelector('#allItemsTable tbody');
  if (!tableBody) return;

  tableBody.innerHTML = '';
  const q = query(collection(db, 'items'), orderBy('sku'));
  const snap = await getDocs(q);

  snap.forEach(d => {
    const data = d.data();
    tableBody.innerHTML += `
      <tr>
        <td>${data.sku || d.id}</td>
        <td>${data.name || ''}</td>
        <td>${data.category || ''}</td>
        <td>${data.qty || 0}</td>
        <td>
          <button class="btn btn-sm btn-warning edit-item" data-sku="${data.sku || d.id}">✏️ Edit</button>
          <button class="btn btn-sm btn-danger delete-item" data-sku="${data.sku || d.id}">🗑 Delete</button>
        </td>
      </tr>`;
  });

  // --- Delete Item ---
  tableBody.querySelectorAll('.delete-item').forEach(btn => {
    btn.addEventListener('click', async () => {
      const sku = btn.getAttribute('data-sku');
      if (confirm(`Delete item "${sku}"?`)) {
        await deleteDoc(doc(db, 'items', sku));
        alert(`Item "${sku}" deleted successfully.`);
        window.location.reload();
      }
    });
  });

  // --- Edit Item ---
  const editModal = new bootstrap.Modal(document.getElementById('editItemModal'));
  let currentSKU = null;

  tableBody.querySelectorAll('.edit-item').forEach(btn => {
    btn.addEventListener('click', async () => {
      currentSKU = btn.getAttribute('data-sku');
      const itemSnap = await getDoc(doc(db, 'items', currentSKU));
      const item = itemSnap.data();
      if (!item) return alert('Item not found.');

      document.getElementById('editSku').value = item.sku;
      document.getElementById('editName').value = item.name;
      document.getElementById('editCategory').value = item.category;
      document.getElementById('editQty').value = item.qty;

      editModal.show();
    });
  });

  // --- Save Edit ---
  const editForm = document.getElementById('editItemForm');
  editForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const sku = document.getElementById('editSku').value;
    const name = document.getElementById('editName').value.trim();
    const category = document.getElementById('editCategory').value.trim();
    const qty = parseInt(document.getElementById('editQty').value, 10);

    await updateDoc(doc(db, 'items', sku), {
      name,
      category,
      qty,
      status: qty <= 5 ? 'Low Stock' : 'In Stock'
    });

    alert('Item updated successfully!');
    editModal.hide();
    window.location.reload();
  });

  // --- Search Filter ---
  const s = document.getElementById('searchItems');
  if (s) {
    s.addEventListener('input', () => {
      const term = s.value.toLowerCase();
      Array.from(tableBody.getElementsByTagName('tr')).forEach(r => {
        r.style.display = r.textContent.toLowerCase().includes(term) ? '' : 'none';
      });
    });
  }
}

/* ---------- Transactions Page ---------- */
export async function initTransactionsPage() {
  const tbody = document.getElementById('transactionsTable');
  if (!tbody) return;

  tbody.innerHTML = '';
  const q = query(collection(db, 'transactions'), orderBy('timestamp', 'desc'));
  const snap = await getDocs(q);

  const rows = [];
  snap.forEach(d => {
    const data = d.data();
    rows.push(`
      <tr>
        <td>${fmtDate(data.timestamp)}</td>
        <td>${data.type || ''}</td>
        <td>${data.sku || ''}</td>
        <td>${data.itemName || ''}</td>
        <td>${(data.qtyChange > 0 ? '+' : '') + data.qtyChange} ${data.notes || ''}</td>
      </tr>`);
  });

  tbody.innerHTML = rows.join('');

  const s = document.getElementById('searchTransactions');
  if (s) {
    s.addEventListener('input', () => {
      const term = s.value.toLowerCase();
      Array.from(tbody.getElementsByTagName('tr')).forEach(r => {
        r.style.display = r.textContent.toLowerCase().includes(term) ? '' : 'none';
      });
    });
  }
}

/* ---------- Auto Init Based on Page ---------- */
(function runPageInit() {
  if (document.getElementById('inventoryTable')) loadInventory();
  if (document.getElementById('allItemsTable')) initItemsPage();
  if (document.getElementById('addTransactionForm')) initTransactionsPage();
})();

/* ---------- Export ---------- */
function exportTableToExcel(tableId, filename) {
  const table = document.getElementById(tableId);
  if (!table) return alert('No table found to export.');
  const wb = XLSX.utils.table_to_book(table, { sheet: "Sheet1" });
  XLSX.writeFile(wb, `${filename}.xlsx`);
}

document.addEventListener('DOMContentLoaded', () => {
  const exportItems = document.getElementById('exportItems');
  if (exportItems) exportItems.addEventListener('click', () => exportTableToExcel('allItemsTable', 'Items'));
});
