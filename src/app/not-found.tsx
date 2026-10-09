import Link from "@/components/app-link";
export default function NotFound() {
  return (
    <div className="empty">
      <h1>این صفحه را پیدا نکردیم</h1>
      <Link className="button primary" href="/">
        بازگشت به آشپزخانه
      </Link>
    </div>
  );
}
