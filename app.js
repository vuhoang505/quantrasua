let products = [];
let cart = [];

const API_URL = 'http://localhost:3000/api';

const formatMoney = (a) =>
    new Intl.NumberFormat('vi-VN', {
        style: 'currency',
        currency: 'VND'
    }).format(a);

// ================= LOAD PRODUCTS =================
async function fetchProducts() {
    try {
        const res = await fetch(`${API_URL}/products`);
        products = await res.json();

        const grid = document.getElementById('productGrid');

        grid.innerHTML = products.map(p => `
            <div class="product-card">
                <img src="${p.img || 'https://placehold.co/150'}">
                <h3>${p.name}</h3>
                <div class="price">${formatMoney(p.price)}</div>

                <button onclick="addToCart(${p.id})">
                    Thêm vào giỏ
                </button>
            </div>
        `).join('');

    } catch (err) {
        console.error("Lỗi load sản phẩm:", err);
    }
}

// ================= GIỎ HÀNG =================
function addToCart(id) {
    const product = products.find(p => p.id == id);
    if (!product) return;

    const item = cart.find(i => i.id == id);

    if (item) {
        item.qty++;
    } else {
        cart.push({
            id: product.id,
            name: product.name,
            price: Number(product.price),
            qty: 1
        });
    }

    updateCart();
    openCart();
}

// ================= UPDATE QTY =================
function updateQty(id, delta) {
    const item = cart.find(i => i.id == id);
    if (!item) return;

    item.qty += delta;

    if (item.qty <= 0) {
        cart = cart.filter(i => i.id != id);
    }

    updateCart();
}

// ================= RENDER CART =================
function updateCart() {
    const box = document.getElementById('cartItems');
    const totalBox = document.getElementById('cartTotal');
    const countBox = document.getElementById('cartCount');

    if (!box || !totalBox || !countBox) return;

    let total = 0;

    box.innerHTML = cart.map(item => {
        total += item.price * item.qty;

        return `
            <div class="cart-item" style="display:flex;justify-content:space-between;align-items:center;margin:10px 0;">
                <div>
                    <b>${item.name}</b><br>
                    <small>${formatMoney(item.price)}</small>
                </div>

                <div>
                    <button onclick="updateQty(${item.id}, -1)">-</button>
                    <span>${item.qty}</span>
                    <button onclick="updateQty(${item.id}, 1)">+</button>
                </div>
            </div>
        `;
    }).join('');

    totalBox.innerText = formatMoney(total);
    countBox.innerText = cart.reduce((s, i) => s + i.qty, 0);
}

// ================= CART UI =================
function openCart() {
    document.getElementById('cartSidebar').classList.add('active');
    document.getElementById('overlay').classList.add('active');
}

function closeCart() {
    document.getElementById('cartSidebar').classList.remove('active');
    document.getElementById('overlay').classList.remove('active');
}

// ================= CLEAR CART =================
function clearCart() {
    if (cart.length === 0) return;

    if (!confirm("Bạn có chắc muốn xóa giỏ hàng?")) return;

    cart = [];
    updateCart();
    closeCart();
}

// ================= CHECKOUT =================
async function checkout() {
    if (cart.length === 0) return alert("Giỏ hàng trống!");

    const total = cart.reduce((s, i) => s + i.price * i.qty, 0);

    const orderData = {
        id: 'HK' + Date.now().toString().slice(-6),
        total,
        items: cart.map(i => ({
            id: i.id,
            qty: i.qty,
            price: i.price
        }))
    };

    try {
        const res = await fetch(`${API_URL}/orders`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(orderData)
        });

        const data = await res.json();

        if (data.ok) {
            alert("Đặt hàng thành công!");
            cart = [];
            updateCart();
            closeCart();
        } else {
            alert("Lỗi lưu đơn!");
        }

    } catch (err) {
        console.error(err);
        alert("Không kết nối server!");
    }
}

// ================= INIT =================
fetchProducts();