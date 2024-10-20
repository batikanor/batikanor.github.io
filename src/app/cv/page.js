export default function CV() {
  return (
    <div>
      
      <main className="flex flex-col items-center justify-center min-h-screen p-8">
        <h1 className="text-4xl font-bold mb-8">My CV</h1>
        <iframe
          src="https://docs.google.com/document/d/e/2PACX-1vTI_n0Epv5KdWd5cO9d_78Lbvzvpb2gN7IqtrOPrYEpLHBd9islycKCqAk3BoDcH0fEOMzypmLvVQan/pub?embedded=true"
          width="100%"
          height="800px"
          className="border-2 border-gray-300 rounded-lg"
          allowFullScreen
          loading="lazy"
          title="My CV"
        ></iframe>
      </main>
    </div>
  );
}
