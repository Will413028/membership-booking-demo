import Link from "next/link";

export default function HomePage() {
  return (
    <main>
      <p>Motion Room</p>
      <h1>Make space for movement</h1>
      <p>Find a class that fits your rhythm.</p>
      <Link href="/classes">Book a class</Link>
    </main>
  );
}
