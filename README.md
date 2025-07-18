# Batıkan Bora Ormancı's Portfolio

Welcome to my portfolio website's repository! I'm Batıkan, a software engineer with a track record of winning hackathons and building innovative solutions. Feel free to check my portfolio out at [batikanor.com](https://batikanor.com)

## Features

- Good stuff

## Tech Stack

- Next.js 14
- React
- Three.js / React Three Fiber
- TailwindCSS
- WebSocket Integration
- AWS Lambda (for serverless functions)

## Getting Started

1. Install dependencies:

   pnpm install

2. Run the development server:

   pnpm dev

For mobile testing:

    pnpm dev --hostname 0.0.0.0

or

    pnpm dev --hostname 0.0.0.0 --port 3001

and

    ngrok http 3001

Other useful commands:

    # Remove built files
    rm -rf .next

    # Build for production
    pnpm build

    # Run linter
    pnpm lint

## Project Structure

The project follows a standard Next.js 14 structure with App Router:

- `/src/app`: Main application pages and layouts
- `/src/components`: Reusable React components
- `/src/data`: Project and content data
- `/public`: Static assets

## Sui Development

This project includes custom Sui smart contracts located in the `/sui` directory. To publish these contracts to the Devnet, you need to set up the Sui CLI. This is a one-time setup.

### 1. Install Sui CLI

If you don't have it installed, use Homebrew on macOS:

```bash
brew install sui
```

### 2. First-Time Configuration

First, you need some gas. Run `sui client faucet` to get the devnet coins.

The first time you run a command like `publish`, the CLI will prompt you to configure it:

```bash
# From the batikanor.github.io directory
sui client publish --gas-budget 50000000 ./sui/sui-nft
```

Follow the on-screen prompts:

1. **Connect to a Sui Full node server?**: Press `y`
2. **Sui Full node server URL**: It will prompt `Sui Full node server URL (Defaults to Sui Testnet if not specified) :`. Enter the Devnet RPC URL:
   ```
   https://fullnode.devnet.sui.io:443
   ```
3. **Alias for the new environment**: It will prompt `Environment alias for [https://fullnode.devnet.sui.io:443] :`. Enter `devnet`.
4. **Select a key scheme**: It will prompt `Select key scheme to generate keypair (0 for ed25519, 1 for secp256k1, 2: for secp256r1):`. Enter `0` or press Enter to accept the default, ed25519.
5. **Request SUI from faucet?**: Press `y` to get gas tokens for publishing.

After this initial setup, the CLI will remember the configuration, and you can run publish commands directly.

## Contact

- GitHub: [@batikanor](https://github.com/batikanor)
- LinkedIn: [batikanor](https://linkedin.com/in/batikanor)
- Email: batikanor@gmail.com

## License

All rights reserved © 2024 Batıkan Bora Ormancı
