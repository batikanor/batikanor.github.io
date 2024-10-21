import React from 'react';
import Link from 'next/link';

const NotFoundPage = () => {
  return (
    <div className="max-w-6xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
      <h2 className="text-3xl font-bold tracking-tight text-center mb-12 text-white">
        Page Not Found
      </h2>

      <div className="p-8 bg-gray-800 rounded-lg shadow-lg border border-gray-600 text-center">
        <h1 className="text-4xl font-semibold text-white mb-4">
          Oops! This page doesn’t exist.
        </h1>

        <p className="text-lg text-gray-300 mb-4">
          It looks like the URL you were trying to access doesn’t exist, or the page has been moved.
        </p>

        <p className="text-lg text-gray-300 mb-4">
          Some older redirects may no longer be valid. Please check the list of older redirects{" "}
          <a
            href="https://github.com/batikanor/website-gatsby-src/blob/master/static/_redirects"
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-400 hover:underline"
          >
            here
          </a>.
        </p>

        {/* Link without <a> tag */}
        <Link href="/" passHref>
          <button className="bg-gray-700 text-white px-6 py-3 rounded hover:bg-gray-600">
            Go to Homepage
          </button>
        </Link>


      </div>
    </div>
  );
};

export default NotFoundPage;
