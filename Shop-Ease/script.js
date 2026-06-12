//  ShopEase – script.js


//  Product data
const products = [
  {
    id: 1,
    title: "Wireless Noise-Cancelling Headphones",
    category: "electronics",
    price: 129.99,
    oldPrice: 199.99,
    rating: 4.5,
    reviews: 284,
    badge: "Best Seller",
    image: "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=400&h=300&fit=crop"
  },
  {
    id: 2,
    title: "Men's Slim Fit Oxford Shirt",
    category: "fashion",
    price: 39.99,
    oldPrice: 59.99,
    rating: 4.2,
    reviews: 157,
    badge: "Sale",
    image: "https://images.unsplash.com/photo-1602810318383-e386cc2a3ccf?w=400&h=300&fit=crop"
  },
  {
    id: 3,
    title: "Nike Air Max 270 Sneakers",
    category: "shoes",
    price: 94.99,
    oldPrice: 130.00,
    rating: 4.8,
    reviews: 412,
    badge: "Hot",
    image: "https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=400&h=300&fit=crop"
  },
  {
    id: 4,
    title: "Stainless Steel Smart Watch",
    category: "electronics",
    price: 179.99,
    oldPrice: 249.99,
    rating: 4.6,
    reviews: 339,
    badge: "New",
    image: "https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=400&h=300&fit=crop"
  },
  {
    id: 5,
    title: "Genuine Leather Tote Bag",
    category: "accessories",
    price: 74.99,
    oldPrice: 110.00,
    rating: 4.4,
    reviews: 198,
    badge: null,
    image: "https://images.unsplash.com/photo-1548036328-c9fa89d128fa?w=400&h=300&fit=crop"
  },
  {
    id: 6,
    title: "Women's Floral Summer Dress",
    category: "fashion",
    price: 49.99,
    oldPrice: 79.99,
    rating: 4.3,
    reviews: 223,
    badge: "Popular",
    image: "https://images.unsplash.com/photo-1515372039744-b8f02a3ae446?w=400&h=300&fit=crop"
  },
  {
    id: 7,
    title: "Running Trail Shoes",
    category: "shoes",
    price: 84.99,
    oldPrice: 119.99,
    rating: 4.7,
    reviews: 305,
    badge: null,
    image: "https://images.unsplash.com/photo-1606107557195-0e29a4b5b4aa?w=400&h=300&fit=crop"
  },
  {
    id: 8,
    title: "Polarized Aviator Sunglasses",
    category: "accessories",
    price: 34.99,
    oldPrice: 55.00,
    rating: 4.1,
    reviews: 87,
    badge: "Sale",
    image: "https://images.unsplash.com/photo-1572635196237-14b3f281503f?w=400&h=300&fit=crop"
  }
];


//  State
let cart = JSON.parse(localStorage.getItem("shopease_cart")) || [];
let currentFilter = "all";
let searchQuery = "";


//  Helpers – star rendering
function renderStars(rating) {
  let stars = "";
  for (let i = 1; i <= 5; i++) {
    if (i <= Math.floor(rating)) {
      stars += '<i class="fa fa-star"></i>';
    } else if (i - rating < 1) {
      stars += '<i class="fa fa-star-half-alt"></i>';
    } else {
      stars += '<i class="fa fa-star" style="opacity:0.25"></i>';
    }
  }
  return stars;
}

//  Render product cards
function renderProducts(list) {
  const grid = document.getElementById("productGrid");
  const noResults = document.getElementById("noResults");

  if (list.length === 0) {
    grid.innerHTML = "";
    noResults.style.display = "block";
    return;
  }

  noResults.style.display = "none";

  grid.innerHTML = list.map(p => `
    <div class="product-card" data-id="${p.id}">
      ${p.badge ? `<span class="product-badge">${p.badge}</span>` : ""}
      <div class="product-img-wrap">
        <img src="${p.image}" alt="${p.title}" loading="lazy" />
      </div>
      <div class="product-body">
        <p class="product-cat">${p.category}</p>
        <h3 class="product-title">${p.title}</h3>
        <div class="product-stars">
          ${renderStars(p.rating)}
          <span>(${p.reviews})</span>
        </div>
        <div class="product-footer">
          <div class="product-price">
            $${p.price.toFixed(2)}
            ${p.oldPrice ? `<small>$${p.oldPrice.toFixed(2)}</small>` : ""}
          </div>
          <button class="add-cart-btn" onclick="addToCart(${p.id})">
            <i class="fa fa-plus"></i> Add
          </button>
        </div>
      </div>
    </div>
  `).join("");
}


//  Filter products (category + search)
function filterProducts() {
  let result = products;

  if (currentFilter !== "all") {
    result = result.filter(p => p.category === currentFilter);
  }

  if (searchQuery.trim()) {
    const q = searchQuery.toLowerCase();
    result = result.filter(p =>
      p.title.toLowerCase().includes(q) ||
      p.category.toLowerCase().includes(q)
    );
  }

  renderProducts(result);
}


//  Category filter buttons
document.getElementById("filterButtons").addEventListener("click", function(e) {
  const btn = e.target.closest(".filter-btn");
  if (!btn) return;

  document.querySelectorAll(".filter-btn").forEach(b => b.classList.remove("active"));
  btn.classList.add("active");
  currentFilter = btn.dataset.cat;
  filterProducts();
});


//  Search bar
document.getElementById("searchInput").addEventListener("input", function() {
  searchQuery = this.value;
  filterProducts();
});


//  Cart – add item
function addToCart(id) {
  const product = products.find(p => p.id === id);
  const existing = cart.find(item => item.id === id);

  if (existing) {
    existing.qty++;
  } else {
    cart.push({ ...product, qty: 1 });
  }

  saveCart();
  updateCartCount();
  renderCartItems();
  showToast(`✅ "${product.title}" added to cart`, "success");
}

//  Cart – change quantity
function changeQty(id, delta) {
  const item = cart.find(i => i.id === id);
  if (!item) return;

  item.qty += delta;
  if (item.qty < 1) {
    removeFromCart(id);
    return;
  }

  saveCart();
  renderCartItems();
}


//  Cart – remove item
function removeFromCart(id) {
  const item = cart.find(i => i.id === id);
  if (item) showToast(`🗑️ "${item.title}" removed from cart`, "error");

  cart = cart.filter(i => i.id !== id);
  saveCart();
  updateCartCount();
  renderCartItems();
}

//  Cart – clear all
document.getElementById("clearCart").addEventListener("click", function() {
  cart = [];
  saveCart();
  updateCartCount();
  renderCartItems();
  showToast("Cart cleared", "error");
});


//  Render cart sidebar items
function renderCartItems() {
  const itemsEl = document.getElementById("cartItems");
  const footerEl = document.getElementById("cartFooter");
  const emptyEl = document.getElementById("cartEmpty");
  const totalEl = document.getElementById("cartTotal");

  if (cart.length === 0) {
    itemsEl.innerHTML = "";
    footerEl.style.display = "none";
    emptyEl.style.display = "flex";
    return;
  }

  emptyEl.style.display = "none";
  footerEl.style.display = "block";

  const total = cart.reduce((sum, item) => sum + item.price * item.qty, 0);
  totalEl.textContent = `$${total.toFixed(2)}`;

  itemsEl.innerHTML = cart.map(item => `
    <div class="cart-item">
      <img src="${item.image}" alt="${item.title}" />
      <div class="cart-item-info">
        <h4>${item.title}</h4>
        <div class="cart-item-price">$${(item.price * item.qty).toFixed(2)}</div>
        <div class="cart-qty">
          <button class="qty-btn" onclick="changeQty(${item.id}, -1)"><i class="fa fa-minus"></i></button>
          <span class="qty-num">${item.qty}</span>
          <button class="qty-btn" onclick="changeQty(${item.id}, 1)"><i class="fa fa-plus"></i></button>
        </div>
      </div>
      <button class="remove-btn" onclick="removeFromCart(${item.id})" title="Remove">
        <i class="fa fa-trash"></i>
      </button>
    </div>
  `).join("");
}


//  Cart count badge
function updateCartCount() {
  const count = cart.reduce((sum, item) => sum + item.qty, 0);
  const badge = document.getElementById("cartCount");
  badge.textContent = count;

  // Little bump animation
  badge.classList.remove("bump");
  void badge.offsetWidth;
  badge.classList.add("bump");
  setTimeout(() => badge.classList.remove("bump"), 300);
}


//  Persist cart to localStorage
function saveCart() {
  localStorage.setItem("shopease_cart", JSON.stringify(cart));
}


//  Open / close cart sidebar
function openCart() {
  document.getElementById("cartSidebar").classList.add("open");
  document.getElementById("cartOverlay").classList.add("show");
  document.body.style.overflow = "hidden";
}

function closeCart() {
  document.getElementById("cartSidebar").classList.remove("open");
  document.getElementById("cartOverlay").classList.remove("show");
  document.body.style.overflow = "";
}

document.getElementById("cartBtn").addEventListener("click", openCart);
document.getElementById("navCart").addEventListener("click", function(e) {
  e.preventDefault();
  openCart();
});
document.getElementById("closeCart").addEventListener("click", closeCart);
document.getElementById("cartOverlay").addEventListener("click", closeCart);

document.getElementById("startShoppingBtn").addEventListener("click", function(e) {
  e.preventDefault();
  closeCart();
  document.getElementById("products").scrollIntoView({ behavior: "smooth" });
});


//  Toast notifications
let toastTimeout;
function showToast(message, type = "success") {
  const toast = document.getElementById("toast");
  toast.textContent = message;
  toast.className = `toast ${type} show`;

  clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => {
    toast.classList.remove("show");
  }, 3000);
}


//  Dark / Light mode toggle
const themeBtn = document.getElementById("themeToggle");
const savedTheme = localStorage.getItem("shopease_theme") || "light";
document.documentElement.setAttribute("data-theme", savedTheme);
themeBtn.innerHTML = savedTheme === "dark" ? '<i class="fa fa-sun"></i>' : '<i class="fa fa-moon"></i>';

themeBtn.addEventListener("click", function() {
  const current = document.documentElement.getAttribute("data-theme");
  const next = current === "dark" ? "light" : "dark";
  document.documentElement.setAttribute("data-theme", next);
  localStorage.setItem("shopease_theme", next);
  this.innerHTML = next === "dark" ? '<i class="fa fa-sun"></i>' : '<i class="fa fa-moon"></i>';
});


//  Sticky navbar shadow on scroll
window.addEventListener("scroll", function() {
  const navbar = document.getElementById("navbar");
  if (window.scrollY > 10) {
    navbar.classList.add("scrolled");
  } else {
    navbar.classList.remove("scrolled");
  }

  const backTop = document.getElementById("backTop");
  if (window.scrollY > 400) {
    backTop.classList.add("show");
  } else {
    backTop.classList.remove("show");
  }
});


//  Back to top button
document.getElementById("backTop").addEventListener("click", function() {
  window.scrollTo({ top: 0, behavior: "smooth" });
});


//  Mobile hamburger menu
const hamburger = document.getElementById("hamburger");
const navLinks = document.getElementById("navLinks");

hamburger.addEventListener("click", function() {
  this.classList.toggle("open");
  navLinks.classList.toggle("open");
});

navLinks.querySelectorAll("a").forEach(link => {
  link.addEventListener("click", function() {
    hamburger.classList.remove("open");
    navLinks.classList.remove("open");
  });
});


//  Newsletter subscribe
function subscribeNewsletter() {
  const input = document.getElementById("newsletterEmail");
  const val = input.value.trim();
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  if (!val || !emailRegex.test(val)) {
    showToast("Please enter a valid email address.", "error");
    return;
  }

  showToast("🎉 You're subscribed! Welcome to ShopEase.", "success");
  input.value = "";
}


//  Page loader – hide after load
window.addEventListener("load", function() {
  setTimeout(function() {
    document.getElementById("loader").classList.add("hide");
  }, 1800);
});


//  Initial render
renderProducts(products);
updateCartCount();
renderCartItems();