export default function Home() {
  return (
    <div>
      <main className="flex flex-col items-center justify-center gap-12 px-4 sm:px-12 py-12">
        {/* Header and Menu */}
        <header className="text-center">
          <h1 className="text-5xl sm:text-7xl font-bold tracking-tight">BatikanoR</h1>
          <p className="text-xl sm:text-2xl text-gray-500 mt-4">Batıkan Bora ORMANCİ</p>
        </header>

        {/* Divider */}
        <hr className="w-full border-t border-gray-300 my-8" />

        {/* Example description content */}
        <p className="text-center max-w-lg text-base sm:text-lg text-gray-700 leading-relaxed">
          The fourth letter of my name &quot;ı&quot; (i without a dot) is pronounced the way &quot;e&quot; is pronounced while saying &quot;folder&quot;.
        </p>
      </main>
    </div>
  );
}
