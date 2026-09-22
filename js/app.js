let products=[];
let cart=JSON.parse(localStorage.getItem("medicart")||"[]");

const save=()=>{localStorage.setItem("medicart",JSON.stringify(cart));updateCount()};
const updateCount=()=>{const el=document.getElementById("cartCount");if(el)el.textContent=cart.reduce((s,i)=>s+i.qty,0)};

async function loadProducts(){
  const q=document.getElementById("search")?.value||"";
  const c=document.getElementById("category")?.value||"all";
  const r=await fetch(`/api/products?search=${encodeURIComponent(q)}&category=${encodeURIComponent(c)}`);
  products=await r.json();
  renderProducts();
}
function add(id){const x=cart.find(i=>i.id===id);x?x.qty++:cart.push({id,qty:1});save();alert("Product added to cart!")}
function renderProducts(){
 const grid=document.getElementById("productsGrid");if(!grid)return;
 grid.innerHTML=products.map(p=>`<article class="card"><div class="product-img">${p.icon}</div><span class="category">${p.category}</span><h3>${p.name}</h3><div class="price">₹${p.price}</div><small>Stock: ${p.stock}</small><br><br><button class="btn" onclick="add(${p.id})" ${p.stock<1?"disabled":""}>Add to Cart</button></article>`).join("")||"<p>No products found.</p>";
}
async function renderCart(){
 const box=document.getElementById("cartItems"),sum=document.getElementById("cartSummary");if(!box)return;
 if(!cart.length){box.innerHTML="<p>Your cart is empty.</p>";sum.innerHTML='<a class="btn" href="index.html#products">Continue Shopping</a>';return}
 const detailed=[];
 for(const i of cart){const r=await fetch(`/api/products/${i.id}`);if(r.ok)detailed.push({i,p:await r.json()})}
 cart=cart.filter(i=>detailed.some(x=>x.i.id===i.id));save();
 box.innerHTML=detailed.map(({i,p})=>`<div class="cart-item"><div><strong>${p.name}</strong><br>₹${p.price} × ${i.qty}</div><div class="qty"><button onclick="change(${p.id},-1)">−</button><span>${i.qty}</span><button onclick="change(${p.id},1)">+</button><button onclick="removeItem(${p.id})">Remove</button></div></div>`).join("");
 const total=detailed.reduce((s,{i,p})=>s+p.price*i.qty,0);
 sum.innerHTML=`<h2>Total: ₹${total.toFixed(2)}</h2><a class="btn" href="checkout.html">Proceed to Checkout</a>`;
}
function change(id,n){let x=cart.find(i=>i.id===id);if(x){x.qty+=n;if(x.qty<=0)cart=cart.filter(i=>i.id!==id)}save();renderCart()}
function removeItem(id){cart=cart.filter(i=>i.id!==id);save();renderCart()}

async function renderCheckout(){
 const box=document.getElementById("checkoutSummary");if(!box)return;
 if(!cart.length){box.innerHTML="<p>Your cart is empty. <a href='index.html#products'>Shop now</a></p>";return}
 let total=0;
 for(const i of cart){const r=await fetch(`/api/products/${i.id}`);if(r.ok){const p=await r.json();total+=p.price*i.qty}}
 box.innerHTML=`<h2>Order Summary</h2><p>Items: ${cart.reduce((s,i)=>s+i.qty,0)}</p><h3>Total: ₹${total.toFixed(2)}</h3>`;
 document.getElementById("checkoutForm")?.addEventListener("submit",async e=>{
   e.preventDefault();
   const fd=new FormData(e.target);
   const customer={name:fd.get("name"),email:fd.get("email"),phone:fd.get("phone"),address:fd.get("address"),payment:fd.get("payment")};
   const r=await fetch("/api/orders",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({customer,items:cart.map(i=>({product_id:i.id,quantity:i.qty}))})});
   const data=await r.json();
   if(!r.ok){alert(data.error||"Order failed");return}
   alert(`Order placed successfully! Order ID: ${data.order_id}`);
   cart=[];save();location.href="index.html";
 });
}

document.addEventListener("DOMContentLoaded",()=>{
 updateCount();
 loadProducts();
 renderCart();
 renderCheckout();
 document.getElementById("search")?.addEventListener("input",loadProducts);
 document.getElementById("category")?.addEventListener("change",loadProducts);
});
