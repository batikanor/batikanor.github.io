/** @type {import('next').NextConfig} */
const nextConfig = {
  /**
   * Enable static exports for the App Router.
   *
   * @see https://nextjs.org/docs/app/building-your-application/deploying/static-exports
   */
  // output: "export",
  output: process.env.NODE_ENV === "production" ? "export" : undefined,

  /**
   * Set base path. This is the slug of your GitHub repository.
   * When using a custom domain, this can be omitted.
   */
  // basePath: "/batikanor.github.io",
  // basePath: process.env.NODE_ENV === 'production' ? "/batikanor.github.io" : "",
  basePath: process.env.NODE_ENV === "production" ? "" : "",

  /**
   * Disable server-based image optimization. Next.js does not support
   * dynamic features with static exports.
   *
   * @see https://nextjs.org/docs/app/api-reference/components/image#unoptimized
   */
  images: {
    unoptimized: true,
  },

  /**
   * Optional: Set assetPrefix if needed for hosting assets (incase we want to have static assets in public folder)
   */
  assetPrefix:
    process.env.NODE_ENV === "production" ? "https://www.batikanor.com/" : "",

  /**
   * Enable trailing slashes in exported URLs.
   * This ensures that `/cv/` will resolve correctly.
   */
  trailingSlash: true,
  // These redirects dont work on static exports.
  // async redirects() {
  //   return [
  //     {
  //       source: '/google',
  //       destination: 'https://google.com',
  //       permanent: true,  // Use `false` if you want a temporary redirect
  //     },
  //   ];
  // },
  compiler: {
    styledComponents: true,
  },
  experimental: {
    styledJsx: true,
  },
};

export default nextConfig;
