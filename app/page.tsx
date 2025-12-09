import Nav from "./components/Nav";

export default function Home() {
  return (
    <div className="relative min-h-screen flex flex-col items-center justify-center bg-zinc-50 font-sans dark:bg-black pt-24">
      <Nav />

      <div className="text-center">
        <h1 className="text-3xl font-bold text-black dark:text-white">
          Welcome
        </h1>
      </div>
    </div>
  );
}
