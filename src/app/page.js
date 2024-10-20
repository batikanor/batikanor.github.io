export default function Home() {
  return (
    <main className="flex flex-col items-center justify-center gap-8 px-4 sm:px-8">
      {/* Header and Menu */}
      <header className="text-center">
        <h1 className="text-4xl sm:text-6xl font-bold">BatikanoR</h1>
        <p className="text-lg sm:text-xl text-gray-500">Batıkan Bora ORMANCİ</p>
      </header>

      {/* Navigation */}
      <nav className="flex flex-col sm:flex-row flex-wrap justify-center sm:space-x-8 space-y-4 sm:space-y-0 text-md sm:text-lg">
        <a href="#" className="text-purple-700 font-bold" aria-label="Go to homepage">Home</a>
        <a href="#" aria-label="Go to blog">Blog</a>
        <a href="#" aria-label="Go to about page">About</a>
        <a href="#" aria-label="View CV">CV</a>
        <a href="#" aria-label="Go to contact page">Contact</a>
        <a href="#" aria-label="Go to projects page">Projects</a>
        <a href="#" aria-label="View demo">Demo</a>
      </nav>

      {/* Divider */}
      <hr className="w-full border-t border-gray-300 my-4" />

      {/* Example description content */}
      <p className="text-center max-w-lg text-sm sm:text-base">
        The fourth letter of my name &quot;ı&quot; (i without a dot) is pronounced the way &quot;e&quot; is pronounced while saying &quot;folder&quot;.
      </p>
    </main>
  );
}
