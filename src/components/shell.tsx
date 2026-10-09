"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Bell,
  Home,
  Package,
  UtensilsCrossed,
  CalendarDays,
  ShoppingBasket,
  Settings,
  LogOut,
  Search,
  X,
  ChevronLeft,
  BookOpen,
  Menu,
  RefreshCw,
} from "lucide-react";
import { useState, type ReactNode } from "react";
import { useWorkspace } from "@/features/workspace/provider";
import { AuthScreen } from "@/features/auth/auth-screen";
import { faDate, localDate, number } from "@/lib/dates";
import { Modal, Button } from "./ui";
const navigation = [
  { href: "/", title: "خانه", icon: Home },
  { href: "/pantry", title: "موجودی آشپزخانه", icon: Package },
  { href: "/recipes", title: "چی بپزم؟", icon: UtensilsCrossed },
  { href: "/plan", title: "برنامه غذایی", icon: CalendarDays },
  { href: "/shopping", title: "فهرست خرید", icon: ShoppingBasket },
];
export function Shell({ children }: { children: ReactNode }) {
  const path = usePathname(),
    {
      state,
      demo,
      isAdmin,
      loading,
      busy,
      error,
      message,
      setError,
      reload,
      logout,
      act,
    } = useWorkspace();
  const [notifications, setNotifications] = useState(false),
    [mobile, setMobile] = useState(false),
    [search, setSearch] = useState("");
  const unread = state?.notices.filter((n) => !n.read).length || 0;
  if (loading)
    return (
      <div className="loading-screen">
        <img src="/icon.svg" alt="کابینت" />
        <p>آشپزخانه‌تان را آماده می‌کنیم…</p>
      </div>
    );
  const alerts = (
    <>
      {error && (
        <div className="error-banner" role="alert">
          <span>{error}</span>
          <button onClick={() => setError("")} aria-label="بستن پیام">
            <X size={16} />
          </button>
          <button onClick={() => void reload()}>تلاش دوباره</button>
        </div>
      )}
      {message && (
        <div className="toast" role="status">
          {message}
        </div>
      )}
    </>
  );
  if (!state)
    return (
      <>
        {alerts}
        <AuthScreen />
      </>
    );
  return (
    <div className="app-shell">
      {alerts}
      <aside className={`sidebar ${mobile ? "mobile-open" : ""}`}>
        <Link className="brand" href="/">
          <img src="/icon.svg" alt="" />
          <strong>
            کابینت<span>دستیار آشپزخانه شما</span>
          </strong>
        </Link>
        <div className="household-switch">
          <div className="avatar">{state.household.name.slice(0, 1)}</div>
          <div>
            <b>{state.household.name}</b>
            <small>
              {number(state.household.members.length)} نفر در این آشپزخانه
            </small>
          </div>
          <ChevronLeft size={15} />
        </div>
        <span className="nav-label">آشپزخانه من</span>
        <nav aria-label="منوی اصلی">
          {navigation.map(({ href, title, icon: Icon }) => (
            <Link
              onClick={() => setMobile(false)}
              key={href}
              href={href}
              className={`nav-item ${path === href ? "active" : ""}`}
            >
              <Icon size={21} />
              <span>{title}</span>
              {href === "/shopping" &&
                state.shopping.some((x) => !x.purchased) && (
                  <small className="nav-count">
                    {number(state.shopping.filter((x) => !x.purchased).length)}
                  </small>
                )}
            </Link>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <Link
            className={`nav-item ${path === "/settings" ? "active" : ""}`}
            href="/settings"
            onClick={() => setMobile(false)}
          >
            <Settings size={20} />
            تنظیمات خانوار
          </Link>
          {isAdmin && (
            <Link
              className={`nav-item ${path === "/admin" ? "active" : ""}`}
              href="/admin"
              onClick={() => setMobile(false)}
            >
              <BookOpen size={20} />
              مدیریت غذاها
            </Link>
          )}
          <div className="sidebar-note">
            <span>
              یک عادت کوچک،
              <br />
              <b>یک آشپزخانه بهتر.</b>
            </span>
            <span className="leaf-drawing">🌱</span>
          </div>
          <button className="nav-item logout" onClick={() => void logout()}>
            <LogOut size={18} />
            {demo ? "خروج از حالت آزمایشی" : "خروج از حساب"}
          </button>
        </div>
      </aside>
      <div className="main-area">
        <header className="topbar">
          <button
            className="icon-button mobile-toggle"
            onClick={() => setMobile(!mobile)}
            aria-label="باز کردن منو"
          >
            <Menu size={22} />
          </button>
          <div className="breadcrumb">
            آشپزخانه من
            <ChevronLeft size={14} />
            <b>
              {navigation.find((n) => n.href === path)?.title ||
                (path === "/admin" ? "مدیریت غذاها" : "تنظیمات")}
            </b>
          </div>
          <form className="global-search" action="/recipes">
            <Search size={18} />
            <input
              name="q"
              aria-label="جستجوی غذا"
              placeholder="دنبال چه غذایی می‌گردید؟"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </form>
          <div className="topbar-actions">
            <span className="date-label">
              {faDate(localDate(state.household.timezone), {
                weekday: "long",
                month: "long",
                day: "numeric",
                year: undefined,
              })}
            </span>
            <button
              className="icon-button notification-button"
              aria-label="اعلان‌ها"
              onClick={() => setNotifications(true)}
            >
              <Bell size={21} />
              {unread > 0 && <i />}
            </button>
            <Link
              href="/settings"
              className="avatar avatar-small"
              aria-label="پروفایل خانوار"
            >
              {state.household.members[0].name.slice(0, 1)}
            </Link>
          </div>
        </header>
        {demo && (
          <div className="demo-banner">
            <span>
              <i />
              آشپزخانه آزمایشی · اطلاعات فقط در همین مرورگر ذخیره می‌شود.
            </span>
            <Link href="/settings">
              تنظیمات و شروع تازه
              <ChevronLeft size={13} />
            </Link>
          </div>
        )}
        <main className="page-content" aria-busy={busy}>
          {children}
        </main>
        <footer className="page-footer">
          <span>کابینت · برای روزهای ساده‌تر</span>
          <button onClick={() => void reload()}>
            <RefreshCw size={13} />
            تازه‌سازی اطلاعات
          </button>
        </footer>
      </div>
      <nav className="mobile-nav" aria-label="ناوبری موبایل">
        {navigation.map(({ href, title, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className={path === href ? "active" : ""}
          >
            <Icon size={20} />
            <span>
              {title === "موجودی آشپزخانه"
                ? "موجودی"
                : title === "برنامه غذایی"
                  ? "برنامه"
                  : title === "فهرست خرید"
                    ? "خرید"
                    : title}
            </span>
          </Link>
        ))}
      </nav>
      <Modal
        open={notifications}
        onOpenChange={setNotifications}
        title="اعلان‌های آشپزخانه"
        description="یادآوری‌ها و نیازهای خرید شما"
      >
        {state.notices.length ? (
          <div className="notice-list">
            {[...state.notices].reverse().map((n) => (
              <div key={n.id} className={`notice ${n.read ? "read" : ""}`}>
                <Bell size={20} />
                <div>
                  <b>{n.title}</b>
                  <p>{n.body}</p>
                  <small>
                    {new Intl.DateTimeFormat("fa-IR", {
                      dateStyle: "short",
                      timeStyle: "short",
                      timeZone: state.household.timezone,
                    }).format(new Date(n.at))}
                  </small>
                </div>
                {!n.read && (
                  <Button
                    variant="ghost"
                    onClick={() => void act({ type: "notice.read", id: n.id })}
                  >
                    خواندم
                  </Button>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="empty">
            <Bell size={28} />
            <h3>فعلاً اعلانی ندارید</h3>
            <p>یادآوری خرید را در تنظیمات فعال کنید.</p>
          </div>
        )}
        <Link
          className="button secondary"
          href="/shopping"
          onClick={() => setNotifications(false)}
        >
          باز کردن فهرست خرید
        </Link>
      </Modal>
    </div>
  );
}
