export default function Home() {
  return (
    <div className="flex flex-col items-center justify-center gap-8">
      {/* Header and Menu */}
      <header className="text-center">
        <h1 className="text-6xl font-bold">BatikanoR</h1>
        <p className="text-xl text-gray-500">Batıkan Bora ORMANCİ</p>
      </header>
      
      {/* Navigation */}
      <nav className="flex space-x-8 text-lg">
        <a href="#" className="text-purple-700 font-bold">Home</a>
        <a href="#">Blog</a>
        <a href="#">About</a>
        <a href="#">CV</a>
        <a href="#">Contact</a>
        <a href="#">Projects</a>
        <a href="#">Demo</a>
      </nav>

      {/* Divider */}
      <div className="w-full border-t border-gray-300 my-4"></div>

      {/* Example description content */}
      <p className="text-center max-w-lg">
        The fourth letter of my name "ı" (i without a dot) is pronounced the way "e" is pronounced while saying "folder".
      </p>
    </div>
  );
}
