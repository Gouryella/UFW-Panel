export default function Footer() {
  return (
    <footer className="mt-10 border-t border-white/10 bg-white/5 py-6 text-slate-300/75 shadow-[0_-10px_40px_rgba(8,15,40,0.35)] backdrop-blur">
      <div className="container mx-auto flex flex-col items-center justify-center gap-3 px-4 text-xs sm:flex-row sm:text-sm">
        <p>
          Powered by{" "} ·
          <a
            href="https://github.com/Gouryella/UFW-Panel"
            target="_blank"
            rel="noopener noreferrer"
            className="ml-2 underline decoration-dotted underline-offset-4 transition hover:text-slate-100"
          >
            @Gouryella
          </a>
        </p>
      </div>
    </footer>
  );
}
