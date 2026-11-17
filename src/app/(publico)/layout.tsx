import Link from "next/link";

export default function LayoutPublico({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-[440px] flex-col px-4 pb-10">
      <header className="flex items-center justify-center border-b border-line py-4">
        <Link href="/" className="brand">
          Odonto <span>4K</span>
        </Link>
      </header>
      <main className="entra flex flex-1 flex-col gap-5 pt-6">{children}</main>
    </div>
  );
}
