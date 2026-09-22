const express = require("express");
const cors = require("cors");
const Database = require("better-sqlite3");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;
const db = new Database("medicart.db");

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

db.exec(`
CREATE TABLE IF NOT EXISTS products (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  price REAL NOT NULL,
  icon TEXT DEFAULT '💊',
  stock INTEGER DEFAULT 100
);
CREATE TABLE IF NOT EXISTS orders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT NOT NULL,
  address TEXT NOT NULL,
  payment TEXT NOT NULL,
  total REAL NOT NULL,
  status TEXT DEFAULT 'Placed',
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS order_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id INTEGER NOT NULL,
  product_id INTEGER NOT NULL,
  quantity INTEGER NOT NULL,
  price REAL NOT NULL,
  FOREIGN KEY(order_id) REFERENCES orders(id),
  FOREIGN KEY(product_id) REFERENCES products(id)
);
`);

const count = db.prepare("SELECT COUNT(*) AS c FROM products").get().c;
if (count === 0) {
  const insert = db.prepare("INSERT INTO products (name,category,price,icon,stock) VALUES (?,?,?,?,?)");
  const products = [
    ["Paracetamol","Pain Relief",30,"💊",100],
    ["Vitamin B Complex","Vitamins",85,"🧴",100],
    ["Antacid Tablets","Gastrointestinal",55,"💊",100],
    ["Digital Thermometer","Devices",220,"🌡️",50],
    ["First Aid Bandage","First Aid",40,"🩹",100],
    ["ORS Sachets","Gastrointestinal",35,"🥤",100],
    ["Vitamin C","Vitamins",120,"🍊",100],
    ["Hand Sanitizer","First Aid",75,"🧴",100]
  ];
  const insertMany = db.transaction(rows => rows.forEach(r => insert.run(...r)));
  insertMany(products);
}

// Products
app.get("/api/products", (req,res) => {
  const { search="", category="all" } = req.query;
  let sql = "SELECT * FROM products WHERE 1=1";
  const params = [];
  if (search) {
    sql += " AND (name LIKE ? OR category LIKE ?)";
    params.push(`%${search}%`, `%${search}%`);
  }
  if (category !== "all") {
    sql += " AND category = ?";
    params.push(category);
  }
  sql += " ORDER BY id DESC";
  res.json(db.prepare(sql).all(...params));
});

app.get("/api/products/:id", (req,res) => {
  const product = db.prepare("SELECT * FROM products WHERE id=?").get(req.params.id);
  if (!product) return res.status(404).json({error:"Product not found"});
  res.json(product);
});

// Admin product CRUD
app.post("/api/products", (req,res) => {
  const {name, category, price, icon="💊", stock=100} = req.body;
  if (!name || !category || price == null) return res.status(400).json({error:"name, category and price are required"});
  const result = db.prepare("INSERT INTO products (name,category,price,icon,stock) VALUES (?,?,?,?,?)")
    .run(name, category, Number(price), icon, Number(stock));
  res.status(201).json(db.prepare("SELECT * FROM products WHERE id=?").get(result.lastInsertRowid));
});

app.put("/api/products/:id", (req,res) => {
  const old = db.prepare("SELECT * FROM products WHERE id=?").get(req.params.id);
  if (!old) return res.status(404).json({error:"Product not found"});
  const p = {...old, ...req.body};
  db.prepare("UPDATE products SET name=?,category=?,price=?,icon=?,stock=? WHERE id=?")
    .run(p.name,p.category,Number(p.price),p.icon,Number(p.stock),req.params.id);
  res.json(db.prepare("SELECT * FROM products WHERE id=?").get(req.params.id));
});

app.delete("/api/products/:id", (req,res) => {
  const result = db.prepare("DELETE FROM products WHERE id=?").run(req.params.id);
  if (!result.changes) return res.status(404).json({error:"Product not found"});
  res.json({message:"Product deleted"});
});

// Orders
app.post("/api/orders", (req,res) => {
  const {customer, items} = req.body;
  if (!customer || !customer.name || !customer.email || !customer.phone || !customer.address || !customer.payment)
    return res.status(400).json({error:"Complete customer details are required"});
  if (!Array.isArray(items) || items.length === 0)
    return res.status(400).json({error:"Cart is empty"});

  const getProduct = db.prepare("SELECT * FROM products WHERE id=?");
  let total = 0;
  const validated = [];

  for (const item of items) {
    const p = getProduct.get(item.product_id);
    const qty = Number(item.quantity);
    if (!p || !Number.isInteger(qty) || qty < 1) return res.status(400).json({error:"Invalid product or quantity"});
    if (p.stock < qty) return res.status(400).json({error:`Insufficient stock for ${p.name}`});
    total += p.price * qty;
    validated.push({p, qty});
  }

  const createOrder = db.transaction(() => {
    const order = db.prepare(
      "INSERT INTO orders (name,email,phone,address,payment,total) VALUES (?,?,?,?,?,?)"
    ).run(customer.name,customer.email,customer.phone,customer.address,customer.payment,total);

    const addItem = db.prepare(
      "INSERT INTO order_items (order_id,product_id,quantity,price) VALUES (?,?,?,?)"
    );
    const reduceStock = db.prepare("UPDATE products SET stock=stock-? WHERE id=?");
    for (const {p,qty} of validated) {
      addItem.run(order.lastInsertRowid,p.id,qty,p.price);
      reduceStock.run(qty,p.id);
    }
    return order.lastInsertRowid;
  });

  const orderId = createOrder();
  res.status(201).json({message:"Order placed successfully", order_id:orderId, total});
});

app.get("/api/orders", (req,res) => {
  const orders = db.prepare("SELECT * FROM orders ORDER BY id DESC").all();
  const items = db.prepare(`
    SELECT oi.*, p.name, p.category FROM order_items oi
    JOIN products p ON p.id=oi.product_id
    WHERE oi.order_id=?
  `);
  res.json(orders.map(o => ({...o, items:items.all(o.id)})));
});

app.get("/api/orders/:id", (req,res) => {
  const order = db.prepare("SELECT * FROM orders WHERE id=?").get(req.params.id);
  if (!order) return res.status(404).json({error:"Order not found"});
  const items = db.prepare(`
    SELECT oi.*, p.name, p.category FROM order_items oi
    JOIN products p ON p.id=oi.product_id WHERE oi.order_id=?
  `).all(req.params.id);
  res.json({...order,items});
});

app.patch("/api/orders/:id/status", (req,res) => {
  const allowed = ["Placed","Processing","Shipped","Delivered","Cancelled"];
  if (!allowed.includes(req.body.status)) return res.status(400).json({error:"Invalid status"});
  const result = db.prepare("UPDATE orders SET status=? WHERE id=?").run(req.body.status,req.params.id);
  if (!result.changes) return res.status(404).json({error:"Order not found"});
  res.json({message:"Status updated"});
});

app.get("/api/health", (req,res) => res.json({status:"OK",database:"SQLite connected"}));

app.listen(PORT, () => {
  console.log(`MediCart running at http://localhost:${PORT}`);
});
