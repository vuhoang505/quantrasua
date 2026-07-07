const express = require('express');
const mysql = require('mysql2');
const cors = require('cors');
const multer = require('multer');

const app = express();
app.use(cors());
app.use(express.json());

// ================= MYSQL POOL =================
const db = mysql.createPool({
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'quantrasua',
    waitForConnections: true,
    connectionLimit: 10
});

db.getConnection((err, conn) => {
    if (err) {
        console.log("❌ MySQL lỗi:", err.message);
    } else {
        console.log("✅ MySQL Connected");
        conn.release();
    }
});

// ================= MULTER =================
const upload = multer({ storage: multer.memoryStorage() });

// ================= PRODUCTS =================

// 1. Lấy danh sách sản phẩm
app.get('/api/products', (req, res) => {
    db.query('SELECT * FROM products', (err, results) => {
        if (err) return res.status(500).json(err);

        const data = results.map(p => ({
            ...p,
            img: p.image_data
                ? `data:${p.image_type};base64,${p.image_data.toString('base64')}`
                : null
        }));
        res.json(data);
    });
});

// 2. THÊM SẢN PHẨM MỚI (Nút "Thêm mới" gọi đến đây)
app.post('/api/products', upload.single('image'), (req, res) => {
    const { name, price } = req.body;
    const imageData = req.file ? req.file.buffer : null;
    const imageType = req.file ? req.file.mimetype : null;

    if (!name || !price) {
        return res.status(400).json({ ok: false, message: "Thiếu tên hoặc giá sản phẩm" });
    }

    const sql = 'INSERT INTO products (name, price, image_data, image_type) VALUES (?, ?, ?, ?)';
    db.query(sql, [name, price, imageData, imageType], (err, result) => {
        if (err) {
            console.error("Lỗi MySQL khi thêm:", err);
            return res.status(500).json(err);
        }
        res.json({ ok: true, id: result.insertId });
    });
});

// 3. CẬP NHẬT SẢN PHẨM (Nút "Lưu thay đổi" trong Modal gọi đến đây)
app.put('/api/products/:id', upload.single('image'), (req, res) => {
    const { name, price } = req.body;
    const id = req.params.id;

    let sql = 'UPDATE products SET name=?, price=? WHERE id=?';
    let params = [name, price, id];

    // Nếu người dùng có chọn ảnh mới thì cập nhật cả ảnh
    if (req.file) {
        sql = 'UPDATE products SET name=?, price=?, image_data=?, image_type=? WHERE id=?';
        params = [name, price, req.file.buffer, req.file.mimetype, id];
    }

    db.query(sql, params, (err) => {
        if (err) {
            console.error("Lỗi MySQL khi sửa:", err);
            return res.status(500).json(err);
        }
        res.json({ ok: true });
    });
});

// 4. XÓA SẢN PHẨM
app.delete('/api/products/:id', (req, res) => {
    db.query('DELETE FROM products WHERE id=?', [req.params.id], (err) => {
        if (err) return res.status(500).json(err);
        res.json({ ok: true });
    });
});

// ================= ORDERS =================
app.get('/api/orders', (req, res) => {
    const sql = `
        SELECT o.*, oi.qty, oi.price, p.name as product_name
        FROM orders o
        LEFT JOIN order_items oi ON o.id = oi.order_id
        LEFT JOIN products p ON p.id = oi.product_id
        ORDER BY o.created_at DESC
    `;

    db.query(sql, (err, rows) => {
        if (err) return res.status(500).json(err);

        const map = {};

        rows.forEach(r => {
            if (!map[r.id]) {
                map[r.id] = {
                    id: r.id,
                    total: r.total_amount,
                    status: r.status,
                    phone: r.customer_phone,
                    items: []
                };
            }

            if (r.product_name) {
                map[r.id].items.push({
                    name: r.product_name,
                    qty: r.qty,
                    price: r.price
                });
            }
        });

        res.json(Object.values(map));
    });
});

// ================= CREATE ORDER =================
app.post('/api/orders', (req, res) => {
    const { id, total, items } = req.body;

    if (!id || !total || !items?.length) {
        return res.status(400).json({ error: "Thiếu dữ liệu" });
    }

    const sqlOrder = `
        INSERT INTO orders (id, total_amount, status, created_at)
        VALUES (?, ?, 'pending', NOW())
    `;

    db.query(sqlOrder, [id, total], (err) => {
        if (err) return res.status(500).json(err);

        const values = items.map(i => [
            id,
            i.id,
            i.qty,
            i.price
        ]);

        db.query(
            `INSERT INTO order_items (order_id, product_id, qty, price) VALUES ?`,
            [values],
            (err2) => {
                if (err2) return res.status(500).json(err2);

                res.json({ ok: true });
            }
        );
    });
});

// ================= PAYMENT (FIXED) =================
app.put('/api/orders/:id/pay', (req, res) => {
    const id = req.params.id;
    const { phone, name } = req.body;

    db.query(
        'SELECT * FROM customers WHERE phone=?',
        [phone],
        (err, rows) => {

            if (err) return res.status(500).json(err);

            let customer = rows[0];

            if (!customer) {
                db.query(
                    'INSERT INTO customers(name, phone, points) VALUES (?, ?, 0)',
                    [name || 'Khách lẻ', phone],
                    (err2, result) => {
                        if (err2) return res.status(500).json(err2);

                        updateOrder(phone, id, 1);
                    }
                );
            } else {
                updateOrder(phone, id, customer.points + 1);
            }
        }
    );

    function updateOrder(phone, orderId, points) {

        db.query(
            'UPDATE customers SET points=? WHERE phone=?',
            [points, phone]
        );

        db.query(
            `UPDATE orders SET status='completed', customer_phone=? WHERE id=?`,
            [phone, orderId],
            (err, result) => {
                if (err) return res.status(500).json(err);

                res.json({
                    ok: true,
                    points
                });
            }
        );
    }
});

// ================= INVENTORY =================
app.get('/api/inventory', (req, res) => {
    db.query('SELECT * FROM inventory', (err, r) => {
        if (err) return res.status(500).json(err);
        res.json(r);
    });
});

// Cập nhật nguyên liệu kho
app.put('/api/inventory/:id', (req, res) => {
    const { name, qty, unit } = req.body;
    db.query(
        'UPDATE inventory SET name=?, qty=?, unit=? WHERE id=?',
        [name, qty, unit, req.params.id],
        (err) => {
            if (err) return res.status(500).json(err);
            res.json({ ok: true });
        }
    );
});

// Xóa nguyên liệu kho
app.delete('/api/inventory/:id', (req, res) => {
    db.query('DELETE FROM inventory WHERE id=?', [req.params.id], (err) => {
        if (err) return res.status(500).json(err);
        res.json({ ok: true });
    });
});

// Thêm nguyên liệu mới (Nút "Thêm" của Kho)
app.post('/api/inventory', (req, res) => {
    const { name, qty, unit } = req.body;
    db.query(
        'INSERT INTO inventory (name, qty, unit) VALUES (?, ?, ?)',
        [name, qty, unit],
        (err) => {
            if (err) return res.status(500).json(err);
            res.json({ ok: true });
        }
    );
});

// ================= CUSTOMERS =================
app.post('/api/customers', (req, res) => {
    const { name, phone } = req.body;

    db.query(
        'INSERT INTO customers(name, phone) VALUES (?, ?)',
        [name, phone],
        (err) => {
            if (err) return res.status(500).json(err);
            res.json({ ok: true });
        }
    );
});

app.get('/api/customers', (req, res) => {
    const sql = 'SELECT * FROM customers';

    db.query(sql, (err, results) => {
        if (err) {
            console.error("CUSTOMERS ERROR:", err);
            return res.status(500).json({
                ok: false,
                message: err.message
            });
        }

        res.json(results); 
    });
});

// Cập nhật thông tin khách hàng
app.put('/api/customers/:id', (req, res) => {
    const { name, phone } = req.body;
    const customerId = req.params.id;

    // Kiểm tra xem phone có bị trống không
    if (!phone) return res.status(400).json({ message: "Số điện thoại không được để trống" });

    db.query(
        'UPDATE customers SET name=?, phone=? WHERE id=?',
        [name, phone, customerId],
        (err, result) => {
            if (err) {
                // Nếu trùng số điện thoại, MySQL sẽ trả về mã lỗi 1062
                if (err.errno === 1062) {
                    return res.status(400).json({ message: "Số điện thoại này đã tồn tại!" });
                }
                return res.status(500).json(err);
            }
            res.json({ ok: true });
        }
    );
});

// Xóa khách hàng
app.delete('/api/customers/:id', (req, res) => {
    db.query('DELETE FROM customers WHERE id=?', [req.params.id], (err) => {
        if (err) return res.status(500).json(err);
        res.json({ ok: true });
    });
});

// ================= START =================
app.listen(3000, () => {
    console.log("🚀 Server running http://localhost:3000");
});
