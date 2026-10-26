"use client";

import { startTransition, useDeferredValue, useEffect, useMemo, useState } from "react";
import Image from "next/image";
import logo from "../../logo.jpg";
import { useRouter } from "next/navigation";
import {
  Activity, Banknote, Check, CircleUserRound, ClipboardList, Copy, FilePlus2, Mail, MapPin,
  MessageCircle, Package, PackageCheck, Pencil, Phone, Plus, Search, Settings2, Trash2,
  ShoppingBag, Truck, Users, X,
} from "lucide-react";

type OrderStatus = "PENDING" | "CONFIRMED" | "PROCESSING" | "SHIPPED" | "OUT_FOR_DELIVERY" | "DELIVERED" | "CANCELLED" | "RETURNED" | "FAILED_DELIVERY";
type Order = {
  number: string;
  status: OrderStatus;
  fullName: string;
  phone: string;
  email: string;
  wilaya: string;
  commune: string;
  address: string;
  note: string;
  product: string;
  size: string;
  color: string;
  quantity: number;
  subtotal: number;
  shippingFee: number;
  delivery: string;
  payment: string;
  createdAt: string;
};
type Product = {
  id: string;
  nameAr: string;
  nameFr: string;
  descAr: string | null;
  descFr: string | null;
  category: string;
  categoryFr: string;
  price: number;
  comparePrice: number | null;
  isActive: boolean;
  stock: number;
  images: { id: string; url: string; alt: string | null }[];
  variants: { size: string; colorName: string; colorHex: string | null; stock: number; reserved: number }[];
};
type ProductColor = { name: string; hex: string };
type Customer = {
  id: string;
  fullName: string;
  phone: string;
  email: string | null;
  isBlacklisted: boolean;
  blacklistReason: string | null;
  totalOrders: number;
  deliveredOrders: number;
  returnedOrders: number;
  createdAt: string;
  latestOrder: { number: string; status: string; total: number; createdAt: string } | null;
};

const colorPresets: ProductColor[] = [
  { name: "أسود", hex: "#222222" },
  { name: "أبيض", hex: "#f8f7f2" },
  { name: "أحمر", hex: "#c62828" },
  { name: "كحلي", hex: "#24334d" },
  { name: "أزرق", hex: "#3975b7" },
  { name: "وردي", hex: "#e8a0b5" },
  { name: "بيج", hex: "#d8c3a5" },
  { name: "أخضر", hex: "#527a5a" },
];

const statusLabels: Record<OrderStatus, string> = {
  PENDING: "بانتظار التأكيد", CONFIRMED: "مؤكد", PROCESSING: "قيد التجهيز",
  SHIPPED: "تم الشحن", OUT_FOR_DELIVERY: "خرج للتسليم", DELIVERED: "تم التسليم",
  CANCELLED: "ملغى", RETURNED: "مرتجع", FAILED_DELIVERY: "تعذر التسليم",
};
const statusClasses: Record<OrderStatus, string> = {
  PENDING: "status-pending", CONFIRMED: "status-confirmed", PROCESSING: "status-processing",
  SHIPPED: "status-shipped", OUT_FOR_DELIVERY: "status-shipped", DELIVERED: "status-delivered",
  CANCELLED: "status-cancelled", RETURNED: "status-cancelled", FAILED_DELIVERY: "status-cancelled",
};
const statusFlow: OrderStatus[] = ["PENDING", "CONFIRMED", "PROCESSING", "SHIPPED", "OUT_FOR_DELIVERY", "DELIVERED", "CANCELLED", "RETURNED", "FAILED_DELIVERY"];
const availableSizes = ["XS", "S", "M", "L", "XL", "XXL", "36", "38", "40", "42", "44"];

const money = (amount: number) => `${new Intl.NumberFormat("fr-DZ").format(amount)} د.ج`;

export default function AdminDashboard() {
  const router = useRouter();
  const [section, setSection] = useState<"orders" | "products" | "customers">("orders");
  const [orders, setOrders] = useState<Order[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [editingStatus, setEditingStatus] = useState<OrderStatus>("PENDING");
  const [detailOpen, setDetailOpen] = useState(false);
  const [productModalOpen, setProductModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [toast, setToast] = useState("");
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [ordersError, setOrdersError] = useState("");
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [customerQuery, setCustomerQuery] = useState("");
  const deferredCustomerQuery = useDeferredValue(customerQuery);
  const [customerPage, setCustomerPage] = useState(1);
  const [customerPages, setCustomerPages] = useState(1);
  const [customerTotal, setCustomerTotal] = useState(0);
  const [customerLoading, setCustomerLoading] = useState(false);
  const [customerError, setCustomerError] = useState("");
  const [productsLoading, setProductsLoading] = useState(false);
  const [productsError, setProductsError] = useState("");

  useEffect(() => {
    if (section !== "orders") return;
    let active = true;
    startTransition(() => {
      setOrdersLoading(true);
      setOrdersError("");
    });
    fetch("/api/admin/orders")
      .then(async (response) => {
        if (response.status === 401) {
          router.replace("/admin/login");
          throw new Error("Authentication required");
        }
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || "تعذر تحميل الطلبات.");
        return result as { orders: Order[] };
      })
      .then((result) => {
        if (!active) return;
        startTransition(() => {
          setOrders(result.orders);
          setOrdersLoading(false);
        });
      })
      .catch((error: unknown) => {
        if (!active || (error instanceof Error && error.message === "Authentication required")) return;
        startTransition(() => {
          setOrdersError(error instanceof Error ? error.message : "تعذر تحميل الطلبات.");
          setOrdersLoading(false);
        });
      });
    return () => { active = false; };
  }, [section, router]);

  useEffect(() => {
    if (section !== "products") return;
    let active = true;
    startTransition(() => {
      setProductsLoading(true);
      setProductsError("");
    });
    fetch("/api/admin/products")
      .then(async (response) => {
        if (response.status === 401) {
          router.replace("/admin/login");
          throw new Error("Authentication required");
        }
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || "تعذر تحميل المنتجات.");
        return result as { products: Product[] };
      })
      .then((result) => {
        if (!active) return;
        startTransition(() => {
          setProducts(result.products);
          setProductsLoading(false);
        });
      })
      .catch((error: unknown) => {
        if (!active || (error instanceof Error && error.message === "Authentication required")) return;
        startTransition(() => {
          setProductsError(error instanceof Error ? error.message : "تعذر تحميل المنتجات.");
          setProductsLoading(false);
        });
      });
    return () => { active = false; };
  }, [section, router]);

  useEffect(() => {
    if (section !== "customers") return;
    let active = true;
    startTransition(() => {
      setCustomerLoading(true);
      setCustomerError("");
    });
    const params = new URLSearchParams({ page: String(customerPage), search: deferredCustomerQuery });

    fetch(`/api/admin/customers?${params}`)
      .then(async (response) => {
        if (response.status === 401) {
          router.replace("/admin/login");
          throw new Error("Authentication required");
        }
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || "تعذر تحميل العملاء.");
        return result as { customers: Customer[]; pagination: { pages: number; total: number } };
      })
      .then((result) => {
        if (!active) return;
        startTransition(() => {
          setCustomers(result.customers);
          setCustomerPages(result.pagination.pages);
          setCustomerTotal(result.pagination.total);
          setCustomerLoading(false);
        });
      })
      .catch((error: unknown) => {
        if (!active || (error instanceof Error && error.message === "Authentication required")) return;
        startTransition(() => {
          setCustomerError(error instanceof Error ? error.message : "تعذر تحميل العملاء.");
          setCustomerLoading(false);
        });
      });

    return () => { active = false; };
  }, [section, customerPage, deferredCustomerQuery, router]);

  const filteredOrders = useMemo(() => orders.filter((order) => {
    const searchText = `${order.number} ${order.fullName} ${order.phone} ${order.wilaya} ${order.commune}`.toLowerCase();
    return (statusFilter === "ALL" || order.status === statusFilter) && searchText.includes(query.toLowerCase().trim());
  }), [orders, query, statusFilter]);

  const pendingCount = orders.filter((order) => order.status === "PENDING").length;
  const deliveredRevenue = orders.filter((order) => order.status === "DELIVERED").reduce((sum, order) => sum + order.subtotal, 0);
  const customerCount = new Set(orders.map((order) => order.phone)).size;

  function showToast(message: string) {
    setToast(message);
    window.setTimeout(() => setToast(""), 2400);
  }

  function openOrder(order: Order) {
    setSelectedOrder(order);
    setEditingStatus(order.status);
    setDetailOpen(true);
  }

  function updateOrderStatus() {
    if (!selectedOrder) return;
    setOrders((current) => current.map((order) => order.number === selectedOrder.number ? { ...order, status: editingStatus } : order));
    setSelectedOrder({ ...selectedOrder, status: editingStatus });
    showToast("تم تحديث حالة الطلب");
  }

  async function saveProduct(form: FormData) {
    const editing = Boolean(form.get("productId"));
    const response = await fetch("/api/admin/products", { method: editing ? "PUT" : "POST", body: form });
    if (response.status === 401) {
      router.replace("/admin/login");
      throw new Error("انتهت جلسة الإدارة. سجّلي الدخول مجددًا.");
    }
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || "تعذر حفظ المنتج.");
    setProducts((current) => editing
      ? current.map((product) => product.id === result.product.id ? result.product as Product : product)
      : [result.product as Product, ...current]);
    const productName = result.product.nameAr as string;
    setEditingProduct(null);
    setProductModalOpen(false);
    showToast(editing ? `تم تحديث ${productName}` : `تم نشر ${productName} في المتجر`);
  }

  async function duplicateProduct(product: Product) {
    const response = await fetch("/api/admin/products", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ duplicateProductId: product.id }),
    });
    if (response.status === 401) {
      router.replace("/admin/login");
      throw new Error("انتهت جلسة الإدارة. سجّلي الدخول مجددًا.");
    }
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || "تعذر نسخ المنتج.");
    setProducts((current) => [result.product as Product, ...current]);
    showToast(`تم نسخ ${product.nameAr}. حدّثي مخزون النسخة قبل بيعها.`);
  }

  async function deleteProduct(product: Product) {
    if (!window.confirm(`سيُخفى «${product.nameAr}» من المتجر مع الاحتفاظ ببيانات الطلبات السابقة. هل تريدين المتابعة؟`)) return;
    const response = await fetch(`/api/admin/products?id=${encodeURIComponent(product.id)}`, { method: "DELETE" });
    if (response.status === 401) {
      router.replace("/admin/login");
      throw new Error("انتهت جلسة الإدارة. سجّلي الدخول مجددًا.");
    }
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || "تعذر حذف المنتج.");
    setProducts((current) => current.map((entry) => entry.id === product.id ? { ...entry, isActive: false } : entry));
    showToast(`تم إخفاء ${product.nameAr} من المتجر`);
  }

  async function logOut() {
    await fetch("/api/admin/session", { method: "DELETE" });
    router.replace("/admin/login");
    router.refresh();
  }

  function showSection(nextSection: "orders" | "products" | "customers") {
    setSection(nextSection);
    if (nextSection === "customers") setCustomerPage(1);
  }

  return (
    <div className="admin-shell">
      <aside className="admin-sidebar">
        <div className="admin-brand"><span className="brand-mark"><Image src={logo} alt="" fill sizes="32px" /></span><span>AURABELLE<span className="brand-caption">STORE MANAGEMENT</span></span></div>
        <p className="admin-nav-label">مساحة العمل</p>
        <nav className="admin-nav" aria-label="القائمة الإدارية">
          <button className={section === "orders" ? "active" : ""} onClick={() => showSection("orders")}><ClipboardList />الطلبات</button>
          <button className={section === "products" ? "active" : ""} onClick={() => showSection("products")}><Package />المنتجات والمخزون</button>
          <button className={section === "customers" ? "active" : ""} onClick={() => showSection("customers")}><Users />العملاء</button>
          <button onClick={() => showToast("سيتم ربط الشحنات بمزود التوصيل") }><Truck />الشحنات</button>
          <button onClick={() => showToast("إعدادات المتجر غير مهيأة بعد") }><Settings2 />الإعدادات</button>
        </nav>
        <div className="sidebar-foot">Aurabelle Algeria<br />لوحة المتجر · 2026</div>
      </aside>

      <main className="admin-content">
        <div className="admin-topbar"><span className="admin-crumb">الإدارة / {section === "orders" ? "الطلبات" : section === "products" ? "المنتجات" : "العملاء"}</span><div className="admin-user"><span className="demo-label"><Activity size={12} />{section === "orders" ? "بيانات تجريبية" : "قاعدة البيانات"}</span><span className="admin-avatar">م</span><span>مديرة المتجر</span><button className="icon-action" aria-label="تسجيل الخروج" title="تسجيل الخروج" onClick={logOut}><X /></button></div></div>

        <div className="page-heading"><div><h1>{section === "orders" ? "الطلبات" : section === "products" ? "المنتجات والمخزون" : "العملاء"}</h1><p>{section === "orders" ? "تابعي الطلبات وراجعي بيانات الزبائن وتفاصيل التوصيل." : section === "products" ? "أديري الكتالوج والمتغيرات المتوفرة لكل منتج." : "بيانات العملاء وسجل طلباتهم من قاعدة البيانات."}</p></div>{section === "products" && <button className="primary-action" onClick={() => { setEditingProduct(null); setProductModalOpen(true); }}><Plus />منتج جديد</button>}</div>

        {section !== "customers" && <section className="stats-grid" aria-label="ملخص المتجر">
          <div className="stat"><span className="stat-label"><ShoppingBag />إجمالي الطلبات</span><strong className="stat-value">{orders.length.toLocaleString("ar-DZ")}</strong><small className="stat-trend">هذا الأسبوع</small></div>
          <div className="stat"><span className="stat-label"><Activity />بانتظار التأكيد</span><strong className="stat-value">{pendingCount.toLocaleString("ar-DZ")}</strong><small className="stat-trend">تحتاج متابعة</small></div>
          <div className="stat"><span className="stat-label"><Banknote />مبيعات الطلبات المسلّمة</span><strong className="stat-value">{money(deliveredRevenue)}</strong><small className="stat-trend">الدفع عند الاستلام</small></div>
          <div className="stat"><span className="stat-label"><Users />الزبائن</span><strong className="stat-value">{customerCount.toLocaleString("ar-DZ")}</strong><small className="stat-trend">زبون مسجل</small></div>
        </section>}

        {section === "orders" ? <>
          <div className="admin-toolbar"><div className="toolbar-title"><h2>كل الطلبات</h2><span>{filteredOrders.length} طلب</span></div><div className="toolbar-controls"><label className="admin-search"><Search /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="ابحثي بالاسم أو الهاتف أو الرقم" /></label><select className="admin-select" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} aria-label="تصفية حسب الحالة"><option value="ALL">كل الحالات</option>{statusFlow.map((status) => <option key={status} value={status}>{statusLabels[status]}</option>)}</select></div></div>
          <div className="table-wrap"><table className="orders-table"><thead><tr><th>رقم الطلب</th><th>الزبون</th><th>الولاية / البلدية</th><th>المنتج</th><th>التاريخ</th><th>الإجمالي</th><th>الحالة</th></tr></thead><tbody>{ordersLoading ? <tr><td className="table-empty" colSpan={7}>جارٍ تحميل الطلبات...</td></tr> : ordersError ? <tr><td className="table-empty" colSpan={7}>{ordersError}</td></tr> : filteredOrders.map((order) => <tr key={order.number} onClick={() => openOrder(order)} tabIndex={0} onKeyDown={(event) => { if (event.key === "Enter") openOrder(order); }}><td><span className="order-ref">{order.number}</span></td><td className="customer-cell"><strong>{order.fullName}</strong><small>{order.phone}</small></td><td>{order.wilaya}<span className="sub-cell">{order.commune}</span></td><td>{order.product}<span className="sub-cell">{order.color} · {order.size}</span></td><td>{new Date(order.createdAt).toLocaleString("ar-DZ")}</td><td>{money(order.subtotal + order.shippingFee)}</td><td><span className={`status-pill ${statusClasses[order.status]}`}>{statusLabels[order.status]}</span></td></tr>)}{!ordersLoading && !ordersError && !filteredOrders.length && <tr><td className="table-empty" colSpan={7}>{orders.length ? "لا توجد طلبات مطابقة." : "لا توجد طلبات في قاعدة البيانات بعد."}</td></tr>}</tbody></table></div>
        </> : section === "products" ? <div className="admin-toolbar"><div className="toolbar-title"><h2>الكتالوج</h2><span>{products.length} منتجات</span></div><label className="admin-search"><Search /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="ابحثي عن منتج" /></label></div> : null}

        {section === "products" && <div className="table-wrap"><table className="products-table"><thead><tr><th>المنتج</th><th>السعر</th><th>المخزون</th><th>الألوان</th><th>المقاسات</th><th>المتغيرات</th><th>النشر</th><th>إجراءات</th></tr></thead><tbody>{productsLoading ? <tr><td className="table-empty" colSpan={8}>جارٍ تحميل المنتجات...</td></tr> : productsError ? <tr><td className="table-empty" colSpan={8}>{productsError}</td></tr> : products.filter((product) => `${product.nameAr} ${product.nameFr} ${product.category}`.toLowerCase().includes(query.toLowerCase())).map((product) => {
          const colors = [...new Map(product.variants.map((variant) => [variant.colorName, variant.colorHex])).entries()];
          const sizes = [...new Set(product.variants.map((variant) => variant.size))];
          return <tr key={product.id}><td><div className="product-admin-name">{product.images[0] ? <Image className="product-admin-thumb" src={product.images[0].url} alt={product.images[0].alt || product.nameAr} width={34} height={42} /> : <span className="product-admin-thumb" />}<span><strong>{product.nameAr}</strong><small>{product.category}</small></span></div></td><td><strong>{money(product.price)}</strong>{product.comparePrice && <del className="admin-compare-price">{money(product.comparePrice)}</del>}</td><td className={product.stock < 6 ? "stock-low" : ""}>{product.stock} قطعة</td><td><span className="variant-swatches">{colors.map(([name, hex]) => <i className="variant-swatch" key={name} style={{ background: hex || "#ddd" }} title={name} />)}<small>{colors.length}</small></span></td><td>{sizes.join("، ")}</td><td>{product.variants.length}</td><td><span className={product.isActive ? "customer-flag" : "customer-flag blocked"}>{product.isActive ? "منشور" : "محذوف"}</span></td><td><div className="product-actions"><button type="button" className="icon-action" title="تعديل المنتج" aria-label={`تعديل ${product.nameAr}`} onClick={() => { setEditingProduct(product); setProductModalOpen(true); }}><Pencil /></button><button type="button" className="icon-action" title="نسخ المنتج" aria-label={`نسخ ${product.nameAr}`} onClick={() => void duplicateProduct(product).catch((error: unknown) => showToast(error instanceof Error ? error.message : "تعذر نسخ المنتج."))}><Copy /></button><button type="button" className="icon-action product-delete-action" title="حذف المنتج" aria-label={`حذف ${product.nameAr}`} onClick={() => void deleteProduct(product).catch((error: unknown) => showToast(error instanceof Error ? error.message : "تعذر حذف المنتج."))}><Trash2 /></button></div></td></tr>;
        })}{!productsLoading && !productsError && !products.length && <tr><td className="table-empty" colSpan={8}>لا توجد منتجات بعد. أضيفي منتجًا لنشره مباشرة في المتجر.</td></tr>}</tbody></table></div>}

        {section === "customers" && <section className="customers-section"><div className="admin-toolbar"><div className="toolbar-title"><h2>سجل العملاء</h2><span>{customerTotal} عميل</span></div><div className="toolbar-controls"><label className="admin-search"><Search /><input value={customerQuery} onChange={(event) => { setCustomerQuery(event.target.value); setCustomerPage(1); }} placeholder="ابحثي بالاسم أو الهاتف أو البريد" /></label></div></div><div className="table-wrap"><table className="customers-table"><thead><tr><th>العميل</th><th>الهاتف</th><th>البريد الإلكتروني</th><th>الطلبات</th><th>تم التسليم</th><th>المرتجعات</th><th>آخر طلب</th><th>القائمة السوداء</th></tr></thead><tbody>{customerLoading ? <tr><td className="table-empty" colSpan={8}>جارٍ تحميل العملاء...</td></tr> : customerError ? <tr><td className="table-empty" colSpan={8}>{customerError}</td></tr> : customers.map((customer) => <tr key={customer.id}><td><strong>{customer.fullName}</strong><small className="customer-date">منذ {new Date(customer.createdAt).toLocaleDateString("ar-DZ")}</small></td><td dir="ltr">{customer.phone}</td><td>{customer.email || "—"}</td><td>{customer.totalOrders}</td><td>{customer.deliveredOrders}</td><td>{customer.returnedOrders}</td><td>{customer.latestOrder ? <><strong>{customer.latestOrder.number}</strong><small className="customer-date">{money(customer.latestOrder.total)} · {statusLabels[customer.latestOrder.status as OrderStatus] || customer.latestOrder.status}</small></> : "لا توجد طلبات"}</td><td><span className={customer.isBlacklisted ? "customer-flag blocked" : "customer-flag"}>{customer.isBlacklisted ? customer.blacklistReason || "محظور" : "نشط"}</span></td></tr>)}{!customerLoading && !customerError && !customers.length && <tr><td className="table-empty" colSpan={8}>{customerQuery ? "لا توجد نتائج مطابقة." : "لا يوجد عملاء في قاعدة البيانات بعد."}</td></tr>}</tbody></table></div><div className="customer-pagination"><span>صفحة {customerPage} من {Math.max(customerPages, 1)}</span><div><button className="outline-action" disabled={customerPage <= 1} onClick={() => setCustomerPage((page) => page - 1)}>السابق</button><button className="outline-action" disabled={customerPage >= customerPages} onClick={() => setCustomerPage((page) => page + 1)}>التالي</button></div></div></section>}
      </main>

      <button className={`overlay-admin ${detailOpen || productModalOpen ? "open" : ""}`} aria-label="إغلاق النافذة" onClick={() => { setDetailOpen(false); setProductModalOpen(false); setEditingProduct(null); }} />
      {selectedOrder && <aside className={`detail-panel ${detailOpen ? "open" : ""}`} aria-hidden={!detailOpen}><div className="panel-header"><div><h2>تفاصيل الطلب</h2><small>{selectedOrder.number}</small></div><button className="icon-action" aria-label="إغلاق" onClick={() => setDetailOpen(false)}><X /></button></div><div className="panel-body">
        <section className="detail-section"><h3><CircleUserRound />معلومات الزبون</h3><div className="detail-grid"><div className="detail-item"><small>الاسم الكامل</small><strong>{selectedOrder.fullName}</strong></div><div className="detail-item"><small>رقم الهاتف</small><a dir="ltr" href={`tel:${selectedOrder.phone.replaceAll(" ", "")}`}>{selectedOrder.phone}</a></div><div className="detail-item"><small>البريد الإلكتروني</small><a href={`mailto:${selectedOrder.email}`}>{selectedOrder.email}</a></div><div className="detail-item"><small>الطلبات السابقة</small><strong>{orders.filter((order) => order.phone === selectedOrder.phone).length} طلب</strong></div></div><div className="customer-actions"><a className="small-action" href={`https://wa.me/213${selectedOrder.phone.replace(/\D/g, "").replace(/^0/, "")}`} target="_blank" rel="noreferrer"><MessageCircle />واتساب</a><a className="small-action" href={`tel:${selectedOrder.phone.replaceAll(" ", "")}`}><Phone />اتصال</a><a className="small-action" href={`mailto:${selectedOrder.email}`}><Mail />بريد إلكتروني</a></div></section>
        <section className="detail-section"><h3><MapPin />عنوان التوصيل</h3><div className="detail-grid"><div className="detail-item"><small>الولاية</small><strong>{selectedOrder.wilaya}</strong></div><div className="detail-item"><small>البلدية</small><strong>{selectedOrder.commune}</strong></div><div className="detail-item" style={{ gridColumn: "1 / -1" }}><small>العنوان</small><strong>{selectedOrder.address}</strong></div><div className="detail-item"><small>نوع التوصيل</small><strong>{selectedOrder.delivery}</strong></div><div className="detail-item"><small>ملاحظة الزبون</small><strong>{selectedOrder.note || "لا توجد ملاحظات"}</strong></div></div></section>
        <section className="detail-section"><h3><PackageCheck />المنتجات والمبالغ</h3><div className="order-line"><strong>{selectedOrder.product}</strong><span>{selectedOrder.color} · مقاس {selectedOrder.size} · ×{selectedOrder.quantity}</span></div><div className="order-line"><span>قيمة المنتجات</span><strong>{money(selectedOrder.subtotal)}</strong></div><div className="order-line"><span>التوصيل</span><strong>{money(selectedOrder.shippingFee)}</strong></div><div className="order-line"><strong>الإجمالي</strong><strong>{money(selectedOrder.subtotal + selectedOrder.shippingFee)}</strong></div><div className="order-line"><span>طريقة الدفع</span><strong>{selectedOrder.payment}</strong></div></section>
        <section className="detail-section"><h3><Activity />حالة الطلب</h3><div className="status-editor"><select value={editingStatus} onChange={(event) => setEditingStatus(event.target.value as OrderStatus)} aria-label="حالة الطلب">{statusFlow.map((status) => <option key={status} value={status}>{statusLabels[status]}</option>)}</select><button onClick={updateOrderStatus}>حفظ الحالة</button></div></section>
      </div></aside>}
      <ProductModal key={editingProduct?.id ?? "new-product"} open={productModalOpen} product={editingProduct} onClose={() => { setProductModalOpen(false); setEditingProduct(null); }} onSave={saveProduct} />
      {toast && <div className="toast-admin" role="status">{toast}</div>}
    </div>
  );
}

function ProductModal({ open, product, onClose, onSave }: { open: boolean; product: Product | null; onClose: () => void; onSave: (form: FormData) => Promise<void> }) {
  const [colors, setColors] = useState<ProductColor[]>(() => product
    ? [...new Map(product.variants.map((variant) => [variant.colorName, { name: variant.colorName, hex: variant.colorHex || "#763c47" }])).values()]
    : []);
  const [sizes, setSizes] = useState<string[]>(() => product ? [...new Set(product.variants.map((variant) => variant.size))] : []);
  const [keptImages, setKeptImages] = useState(() => product?.images ?? []);
  const [selectedImages, setSelectedImages] = useState<File[]>([]);
  const [variantStocks, setVariantStocks] = useState<Record<string, string>>(() => Object.fromEntries(
    product?.variants.map((variant) => [`${variant.size}\u0000${variant.colorName}`, String(variant.stock)]) ?? [],
  ));
  const [colorName, setColorName] = useState("");
  const [colorHex, setColorHex] = useState("#763c47");
  const [stock, setStock] = useState(() => String(product?.variants[0]?.stock ?? 5));
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const variantCount = colors.length * sizes.length;

  function addColor(preset?: ProductColor) {
    const name = preset?.name ?? colorName.trim();
    const hex = preset?.hex ?? colorHex;
    if (!name) { setError("اكتبي اسم اللون أولًا."); return; }
    if (colors.some((color) => color.name === name)) { setError("هذا اللون مضاف بالفعل."); return; }
    setColors((current) => [...current, { name, hex }]);
    setColorName("");
    setError("");
  }

  function addImages(event: React.ChangeEvent<HTMLInputElement>) {
    const added = Array.from(event.target.files || []);
    event.target.value = "";
    if (keptImages.length + selectedImages.length + added.length > 8) { setError("يمكن إضافة 8 صور كحد أقصى."); return; }
    if (added.some((file) => !["image/jpeg", "image/png", "image/webp", "image/avif"].includes(file.type) || file.size > 5 * 1024 * 1024)) {
      setError("تُقبل صور JPEG أو PNG أو WebP أو AVIF حتى 5 ميغابايت للصورة.");
      return;
    }
    setSelectedImages((current) => [...current, ...added]);
    setError("");
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    if (!colors.length || !sizes.length) { setError("أضيفي لونًا واحدًا ومقاسًا واحدًا على الأقل."); return; }
    if (variantCount > 100) { setError("لا يمكن أن يتجاوز عدد متغيرات المنتج 100."); return; }
    if (!keptImages.length && !selectedImages.length) { setError("أضيفي صورة واحدة على الأقل للمنتج."); return; }
    const price = Number(form.get("basePrice"));
    if (!Number.isInteger(price) || price < 1) { setError("تحققي من السعر الحالي."); return; }
    const comparePrice = Number(form.get("comparePrice"));
    if (comparePrice && comparePrice <= price) { setError("السعر السابق يجب أن يكون أعلى من السعر الحالي."); return; }

    form.set("variants", JSON.stringify(colors.flatMap((color) => sizes.map((size) => {
      const key = `${size}\u0000${color.name}`;
      const existingVariant = product?.variants.find((variant) => variant.size === size && variant.colorName === color.name);
      return {
        size,
        colorName: color.name,
        colorHex: color.hex,
        stock: Number(variantStocks[key] ?? existingVariant?.stock ?? stock) || 0,
      };
    }))));
    form.set("keepImageIds", JSON.stringify(keptImages.map((image) => image.id)));
    if (product) form.set("productId", product.id);
    selectedImages.forEach((file) => form.append("images", file));
    setSaving(true);
    setError("");
    try {
      await onSave(form);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "تعذر حفظ المنتج.");
    } finally {
      setSaving(false);
    }
  }

  return <div className={`modal ${open ? "open" : ""}`} aria-hidden={!open} role="dialog" aria-modal="true" aria-labelledby="product-modal-title"><div className="panel-header"><div><h2 id="product-modal-title">{product ? "تعديل المنتج" : "إضافة منتج جديد"}</h2><small>المنتجات · متغيرات المنتج</small></div><button className="icon-action" type="button" aria-label="إغلاق" onClick={onClose}><X /></button></div><form className="modal-form" onSubmit={submit}>
    <div className="form-grid"><label className="admin-field">اسم المنتج بالعربية<input name="nameAr" defaultValue={product?.nameAr ?? ""} required placeholder="مثال: فستان ليان" /></label><label className="admin-field">اسم المنتج بالفرنسية<input name="nameFr" defaultValue={product?.nameFr ?? ""} required placeholder="Ex. Robe Liane" /></label><label className="admin-field">الفئة<select name="category" defaultValue={product?.category ?? "فساتين سهرة"}><option>فساتين سهرة</option><option>قفاطين</option><option>فساتين يومية</option></select></label><label className="admin-field">السعر الحالي بالدينار الجزائري<input name="basePrice" type="number" min="1" step="1" defaultValue={product?.price ?? ""} required placeholder="12800" /></label><label className="admin-field">السعر السابق (اختياري)<input name="comparePrice" type="number" min="1" step="1" defaultValue={product?.comparePrice ?? ""} placeholder="15900" /></label></div>
    <div className="form-grid"><label className="admin-field">الوصف بالعربية<textarea name="descAr" defaultValue={product?.descAr ?? ""} placeholder="تفاصيل القماش والقصة والمناسبة" /></label><label className="admin-field">الوصف بالفرنسية<textarea name="descFr" defaultValue={product?.descFr ?? ""} placeholder="Tissu, coupe et occasion" /></label></div>
    <div className="image-upload-section"><div className="variant-heading"><strong>صور المنتج</strong><span>{keptImages.length + selectedImages.length} / 8 صور</span></div><label className="admin-field image-picker">اختاري صورة واحدة أو عدة صور<input type="file" accept="image/jpeg,image/png,image/webp,image/avif" multiple onChange={addImages} /></label><div className="selected-image-list">{keptImages.map((image) => <div className="selected-image" key={image.id}><span>{image.alt || image.url}</span><button type="button" aria-label="حذف الصورة الحالية" onClick={() => setKeptImages((current) => current.filter((entry) => entry.id !== image.id))}>×</button></div>)}{selectedImages.map((file, index) => <div className="selected-image" key={`${file.name}-${index}`}><span>{file.name}</span><small>{(file.size / 1024 / 1024).toFixed(1)} MB</small><button type="button" aria-label={`حذف الصورة ${file.name}`} onClick={() => setSelectedImages((current) => current.filter((_, imageIndex) => imageIndex !== index))}>×</button></div>)}</div><small className="upload-hint">JPEG أو PNG أو WebP أو AVIF · 5 ميغابايت كحد أقصى للصورة</small></div>
    <div className="variant-config"><div className="variant-heading"><strong>الألوان المتوفرة</strong><span>{colors.length} لون</span></div><div className="color-add-row"><input type="text" value={colorName} onChange={(event) => setColorName(event.target.value)} placeholder="اسم اللون" aria-label="اسم اللون" /><input type="color" value={colorHex} onChange={(event) => setColorHex(event.target.value)} aria-label="اختيار لون" /><button className="outline-action" type="button" onClick={() => addColor()}>إضافة اللون</button></div><div className="color-presets" aria-label="ألوان جاهزة">{colorPresets.map((preset) => <button className="color-preset" type="button" key={preset.name} disabled={colors.some((color) => color.name === preset.name)} onClick={() => addColor(preset)}><i className="variant-swatch" style={{ background: preset.hex }} />{preset.name}</button>)}</div><div className="color-list">{colors.map((color) => <span className="color-chip" key={color.name}><i className="variant-swatch" style={{ background: color.hex }} />{color.name}<button type="button" aria-label={`حذف لون ${color.name}`} onClick={() => setColors((current) => current.filter((entry) => entry.name !== color.name))}>×</button></span>)}</div>
      <div className="variant-heading"><strong>المقاسات المتوفرة</strong><span>{sizes.length} مقاس</span></div><div className="size-list">{availableSizes.map((size) => <label className="size-option" key={size}><input type="checkbox" checked={sizes.includes(size)} onChange={() => setSizes((current) => current.includes(size) ? current.filter((item) => item !== size) : [...current, size])} /><span>{size}</span></label>)}</div>
      <label className="variant-stock">{product ? "المخزون الافتراضي للمتغيرات الجديدة" : "كمية المخزون لكل متغير"}<input type="number" min="0" step="1" value={stock} onChange={(event) => setStock(event.target.value)} /><span>متغيرات مطلوبة: {variantCount}</span></label>
      {product && <div className="variant-stock-list">{colors.flatMap((color) => sizes.map((size) => {
        const key = `${size}\u0000${color.name}`;
        const variant = product.variants.find((entry) => entry.size === size && entry.colorName === color.name);
        if (!variant) return null;
        return <label key={key}>{color.name} · {size}<input type="number" min={variant.reserved} step="1" value={variantStocks[key] ?? String(variant.stock)} onChange={(event) => setVariantStocks((current) => ({ ...current, [key]: event.target.value }))} /></label>;
      }))}</div>}
      <p className="variant-preview">{colors.length && sizes.length ? `${colors.length} ألوان × ${sizes.length} مقاسات = ${variantCount} متغيرًا` : "اختاري الألوان والمقاسات لتكوين المتغيرات"}</p>
    </div>
    <p className="publish-notice"><Check size={14} />{product ? "سيُحدّث المنتج في المتجر مع الحفاظ على مخزون المتغيرات الحالية." : "سيُنشر المنتج تلقائيًا في صفحة المتجر بعد الحفظ."}</p>
    {error && <p className="form-error" role="alert">{error}</p>}<div className="modal-footer"><button className="cancel-action" type="button" onClick={onClose}>إلغاء</button><button className="primary-action" type="submit" disabled={saving}>{saving ? "جارٍ الحفظ..." : <><FilePlus2 />{product ? "حفظ التعديلات" : "حفظ ونشر المنتج"}</>}</button></div>
  </form></div>;
}