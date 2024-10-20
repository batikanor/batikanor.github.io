export default function CV() {
  return (
    <main className="flex flex-col items-center justify-center min-h-screen p-8">
      <h1 className="text-4xl font-bold mb-4">My CV</h1>

      {/* Responsive iframe container */}
      <div className="w-full max-w-screen-lg">
        <iframe
          src="https://docs.google.com/document/d/e/2PACX-1vTI_n0Epv5KdWd5cO9d_78Lbvzvpb2gN7IqtrOPrYEpLHBd9islycKCqAk3BoDcH0fEOMzypmLvVQan/pub?embedded=true"
          className="w-full h-screen border-2 border-gray-300 rounded-lg"
          style={{ zoom: 1.5, overflow: 'hidden' }}
          allowFullScreen
          loading="lazy"
          title="My CV"
        ></iframe>
      </div>
    </main>
  );
}
