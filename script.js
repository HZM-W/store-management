// script.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-app.js";
import {
  getFirestore, collection, getDocs, setDoc, doc, addDoc, deleteDoc,
  query, orderBy, updateDoc, increment, serverTimestamp, getDoc
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
  const rows = [];

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

  // 🔍 Search Filter
  const s = document.getElementById('searchInventory');
  if (s) {
    s.addEventListener('input', () => {
      const term = s.value.toLowerCase();
      const tr = tbody.getElementsByTagName('tr');
      Array.from(tr).forEach(r => {
        const text = r.textContent.toLowerCase();
        r.style.display = text.includes(term) ? '' : 'none';
      });
    });
  }
}

/* ---------- Items page ---------- */
export async function initItemsPage() {
  const form = document.getElementById('addItemForm');
  const cancelEditBtn = document.getElementById('cancelEditBtn');
  const editModeInput = document.getElementById('editMode');
  const submitBtn = document.getElementById('submitItemBtn');
  const tableBody = document.getElementById('allItemsTable');

  let editSKU = null;

  // Load Items
  async function loadItems() {
    tableBody.innerHTML = '';
    const q = query(collection(db, 'items'), orderBy('sku'));
    const snap = await getDocs(q);
    snap.forEach(d => {
      const data = d.data();
      tableBody.innerHTML += `
        <tr>
          <td>${data.sku}</td>
          <td>${data.name}</td>
          <td>${data.category}</td>
          <td>${data.qty || 0}</td>
          <td>
            <button class="btn btn-sm btn-warning edit-btn" data-sku="${data.sku}">✏️ Edit</button>
            <button class="btn btn-sm btn-danger delete-btn" data-sku="${data.sku}">🗑️ Delete</button>
          </td>
        </tr>`;
    });
    attachActionHandlers();
  }

  // Attach Edit/Delete handlers
  function attachActionHandlers() {
    document.querySelectorAll('.edit-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        const sku = btn.dataset.sku;
        const docRef = doc(db, 'items', sku);
        const snap = await getDoc(docRef);
        if (!snap.exists()) return alert('Item not found!');
        const data = snap.data();
        editModeInput.value = "true";
        editSKU = sku;
        submitBtn.textContent = "Update Item";
        cancelEditBtn.classList.remove('d-none');

        // Fill form
        document.getElementById('sku').value = data.sku;
        document.getElementById('name').value = data.name;
        document.getElementById('category').value = data.category;
        document.getElementById('currentStock').value = data.qty || 0;

        // Disable SKU when editing
        document.getElementById('sku').disabled = true;
      });
    });

    document.querySelectorAll('.delete-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        const sku = btn.dataset.sku;
        if (!confirm(`Are you sure you want to delete ${sku}?`)) return;
        await deleteDoc(doc(db, 'items', sku));
        alert('Item deleted successfully.');
        loadItems();
      });
    });
  }

  // Cancel Edit
  cancelEditBtn.addEventListener('click', () => {
    form.reset();
    editModeInput.value = "false";
    editSKU = null;
    submitBtn.textContent = "Add Item";
    cancelEditBtn.classList.add('d-none');
    document.getElementById('sku').disabled = false;
  });

  // Add / Update Item
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

    const itemData = {
      sku,
      name,
      category,
      qty: currentStock,
      status: currentStock <= 5 ? 'Low Stock' : 'In Stock'
    };

    if (editModeInput.value === "true" && editSKU) {
      await updateDoc(doc(db, 'items', editSKU), itemData);
      alert('Item updated successfully!');
    } else {
      await setDoc(doc(db, 'items', sku), itemData);
      alert('Item added successfully!');
    }

    form.reset();
    editModeInput.value = "false";
    editSKU = null;
    submitBtn.textContent = "Add Item";
    cancelEditBtn.classList.add('d-none');
    document.getElementById('sku').disabled = false;

    loadItems();
  });

  // Load items initially
  loadItems();
}

/* ---------- Transactions page ---------- */
export async function initTransactionsPage() {
  const form = document.getElementById('addTransactionForm');
  const skuInput = document.getElementById('txSku');
  const itemNameInput = document.getElementById('txItemName');
  const categoryInput = document.getElementById('txCategory');

  // 🔹 Auto-fill Item Name + Category when SKU is typed
  if (skuInput) {
    skuInput.addEventListener('input', async () => {
      const sku = skuInput.value.trim();
      if (!sku) {
        itemNameInput.value = '';
        categoryInput.value = '';
        return;
      }

      try {
        const itemRef = doc(db, 'items', sku);
        const snap = await getDoc(itemRef);
        if (snap.exists()) {
          const data = snap.data();
          itemNameInput.value = data.name || '';
          categoryInput.value = data.category || '';
        } else {
          itemNameInput.value = 'Not found';
          categoryInput.value = '';
        }
      } catch (error) {
        console.error('Error fetching item details:', error);
        itemNameInput.value = '';
        categoryInput.value = '';
      }
    });
  }

  // 🔹 Add new transaction
  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const sku = skuInput.value.trim();
      const type = document.getElementById('txType').value;
      const qty = Math.max(0, parseInt(document.getElementById('txQty').value || '0', 10));
      const notes = document.getElementById('txNotes').value || '';
      const itemName = itemNameInput.value.trim();
      const category = categoryInput.value.trim();

      if (!sku || qty <= 0) {
        alert('Please provide SKU and a quantity > 0');
        return;
      }

      const change = type === 'in' ? qty : -qty;
      const itemRef = doc(db, 'items', sku);

      try {
        // Update item quantity
        await updateDoc(itemRef, { qty: increment(change) });
      } catch (err) {
        alert('Failed to update item. Make sure item (SKU) exists.');
        console.error(err);
        return;
      }

      try {
        // Update stock status after update
        const snap = await getDoc(itemRef);
        const newQty = (snap.data()?.qty ?? 0);
        const newStatus = newQty <= 5 ? 'Low Stock' : 'In Stock';
        await updateDoc(itemRef, { status: newStatus });
      } catch (err) {
        console.warn('Could not update computed status', err);
      }

      // Save transaction details
      await addDoc(collection(db, 'transactions'), {
        sku,
        itemName,
        category,
        type: type === 'in' ? 'Stock In' : 'Stock Out',
        qtyChange: change,
        notes,
        timestamp: serverTimestamp()
      });

      alert('Transaction recorded successfully.');
      window.location.reload();
    });
  }

  // 🔹 Load transactions table
  const tbody = document.getElementById('transactionsTable');
  if (tbody) {
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
          <td>${data.category || ''}</td>
          <td>${(data.qtyChange > 0 ? '+' : '') + data.qtyChange} ${data.notes || ''}</td>
        </tr>
      `);
    });

    tbody.innerHTML = rows.join('');

    // 🔍 Search Filter
    const s = document.getElementById('searchTransactions');
    if (s) {
      s.addEventListener('input', () => {
        const term = s.value.toLowerCase();
        Array.from(tbody.getElementsByTagName('tr')).forEach(r => {
          const text = r.textContent.toLowerCase();
          r.style.display = text.includes(term) ? '' : 'none';
        });
      });
    }
  }
}

/* ---------- Export to Excel ---------- */
function exportTableToExcel(tableId, filename) {
  const table = document.getElementById(tableId);
  if (!table) return alert('No table found to export.');
  const wb = XLSX.utils.table_to_book(table, { sheet: "Sheet1" });
  XLSX.writeFile(wb, `${filename}.xlsx`);
}

/* ---------- Bind export buttons ---------- */
document.addEventListener('DOMContentLoaded', () => {
  const exportInventory = document.getElementById('exportInventory');
  if (exportInventory) exportInventory.addEventListener('click', () => exportTableToExcel('inventoryTableContainer', 'Inventory'));

  const exportItems = document.getElementById('exportItems');
  if (exportItems) exportItems.addEventListener('click', () => exportTableToExcel('allItemsTableContainer', 'Items'));

  const exportTransactions = document.getElementById('exportTransactions');
  if (exportTransactions) exportTransactions.addEventListener('click', () => exportTableToExcel('transactionsTableContainer', 'Transactions'));
});

/* ---------- Upload Items from Excel ---------- */
document.addEventListener('DOMContentLoaded', () => {
  const uploadBtn = document.getElementById('uploadItems');
  const fileInput = document.getElementById('fileInput');

  if (uploadBtn && fileInput) {
    uploadBtn.addEventListener('click', () => fileInput.click());

    fileInput.addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = async (evt) => {
        const data = new Uint8Array(evt.target.result);
        const workbook = XLSX.read(data, { type: 'array' });
        const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
        const items = XLSX.utils.sheet_to_json(firstSheet);

        let count = 0;
        for (const item of items) {
          const sku = item.SKU || item.sku;
          if (!sku) continue;

          const docRef = doc(db, 'items', sku);
          await setDoc(docRef, {
            sku,
            name: item['Item Name'] || item.name || '',
            category: item['Category'] || item.category || '',
            qty: Number(item['Current Stock'] || item['Quantity'] || 0),
            status: Number(item['Current Stock'] || item['Quantity'] || 0) <= 5
              ? 'Low Stock'
              : 'In Stock'
          });
          count++;
        }

        alert(`${count} items uploaded successfully!`);
        window.location.reload();
      };

      reader.readAsArrayBuffer(file);
    });
  }
});

/* ---------- Auto-run ---------- */
(function runPageInit() {
  if (document.getElementById('inventoryTable')) loadInventory();
  if (document.getElementById('addItemForm')) initItemsPage();
  if (document.getElementById('addTransactionForm')) initTransactionsPage();
})();
