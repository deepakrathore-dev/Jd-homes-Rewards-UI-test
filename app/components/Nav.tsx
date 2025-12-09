import ConnectButton from "@/app/components/ConnectButton";

export default function Nav() {
    return (
        <nav className="
      fixed top-0 left-0 w-full
      px-8 py-4
      flex items-center justify-between
      backdrop-blur-xl bg-white/10 dark:bg-white/5
      border-b border-white/20 dark:border-white/10
      shadow-lg shadow-black/5
      z-50
    ">
            <div className="text-lg font-semibold text-black dark:text-white">
                {/* Add Logo or Brand Name here */}
                MyApp
            </div>

            <ConnectButton />
        </nav>
    );
}
