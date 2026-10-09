"use client";
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <div className="empty">
      <h1>این صفحه بارگذاری نشد</h1>
      <p>دوباره تلاش کنید؛ اطلاعات ذخیره‌شده شما حفظ شده است.</p>
      <button className="button primary" onClick={reset}>
        تلاش دوباره
      </button>
    </div>
  );
}
