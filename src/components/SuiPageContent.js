"use client";

import {
  useConnectWallet,
  useCurrentAccount,
  useDisconnectWallet,
  useSignTransaction,
  useSuiClient,
  useSuiClientQuery,
  useWallets,
} from "@mysten/dapp-kit";
import { Transaction } from "@mysten/sui/transactions";
import { MIST_PER_SUI } from "@mysten/sui/utils";
import { useState } from "react";

export const NFT_PACKAGE_ID =
  "0x650f80cba49c47fafa4ed605f2afbb683ec960cfe2f16eb9a612a5838a82f159";

export default function SuiPageContent() {
  const account = useCurrentAccount();
  const [showDebug, setShowDebug] = useState(false);

  return (
    <div className="container mx-auto p-4 md:p-8">
      <header className="text-center mb-12">
        <h1 className="text-4xl md:text-5xl font-bold mb-2 text-black dark:text-white">
          Utisui
        </h1>
        <p className="text-lg text-gray-600 dark:text-gray-400">Own a word.</p>
      </header>

      {account ? (
        <div className="w-full max-w-4xl mx-auto">
          {/* top bar */}
          <div className="flex items-center justify-between mb-6 px-4 py-2 bg-gray-100 dark:bg-gray-700 rounded-md">
            <span className="text-sm text-black dark:text-white truncate">
              Logged in as: <span className="font-mono">{account.address}</span>
            </span>
            <button
              onClick={() => setShowDebug(!showDebug)}
              className="px-3 py-1 text-xs font-medium rounded-md bg-indigo-600 hover:bg-indigo-700 text-white dark:bg-indigo-500 dark:hover:bg-indigo-600 transition-colors"
            >
              {showDebug ? "Hide Debug" : "Show Debug"}
            </button>
          </div>

          {showDebug && <AccountDetails account={account} />}
        </div>
      ) : (
        <WalletSelector />
      )}
    </div>
  );
}

function WalletSelector() {
  const wallets = useWallets();
  const { mutate: connect } = useConnectWallet();

  return (
    <div className="w-full max-w-md mx-auto bg-white dark:bg-gray-800 shadow-lg rounded-lg p-8">
      <h2 className="text-2xl font-bold text-center mb-6 text-black dark:text-white">
        Connect a Wallet
      </h2>
      <div className="space-y-4">
        {wallets.map((wallet) => (
          <button
            key={wallet.name}
            onClick={() => connect({ wallet })}
            className="w-full flex items-center justify-center px-4 py-3 border border-transparent text-base font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 dark:bg-indigo-500 dark:hover:bg-indigo-600 transition-colors"
          >
            <img
              src={wallet.icon}
              alt={wallet.name}
              className="w-6 h-6 mr-3 rounded-full"
            />
            Connect to {wallet.name}
          </button>
        ))}
      </div>
    </div>
  );
}

function MintNFT() {
  const { mutateAsync: signTransaction } = useSignTransaction();
  const client = useSuiClient();
  const currentAccount = useCurrentAccount();
  const [isLoading, setIsLoading] = useState(false);
  const [nftName, setNftName] = useState("Awesome NFT");
  const [nftDesc, setNftDesc] = useState("This is an awesome NFT on Sui!");
  const [nftUrl, setNftUrl] = useState("https://picsum.photos/400");

  const handleMint = async () => {
    if (!currentAccount) {
      alert("Please connect your wallet first");
      return;
    }

    setIsLoading(true);
    try {
      const tx = new Transaction();

      // Call the mint function from your NFT contract
      tx.moveCall({
        target: `{NFT_PACKAGE_ID}::my_nft::mint`,
        arguments: [
          tx.pure.string(nftName),
          tx.pure.string(nftDesc),
          tx.pure.string(nftUrl),
        ],
      });

      // Sign the transaction
      const { bytes, signature, reportTransactionEffects } =
        await signTransaction({
          transaction: tx,
          chain: "sui:devnet",
        });

      // Execute the signed transaction
      const executeResult = await client.executeTransactionBlock({
        transactionBlock: bytes,
        signature,
        options: {
          showRawEffects: true,
          showObjectChanges: true,
        },
      });

      // Report transaction effects to the wallet
      if (executeResult.rawEffects) {
        reportTransactionEffects(executeResult.rawEffects);
      }

      console.log("NFT minted successfully:", executeResult);
      alert(
        `NFT minted successfully! Transaction digest: ${executeResult.digest}`
      );
    } catch (error) {
      console.error("Error minting NFT:", error);
      alert("Failed to mint NFT: " + error.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="mt-6 text-center space-y-4">
      <div className="flex flex-col gap-4 items-center">
        <input
          type="text"
          placeholder="NFT Name"
          value={nftName}
          onChange={(e) => setNftName(e.target.value)}
          className="w-full max-w-md px-4 py-2 border rounded-md dark:bg-gray-700 dark:text-white"
        />
        <input
          type="text"
          placeholder="NFT Description"
          value={nftDesc}
          onChange={(e) => setNftDesc(e.target.value)}
          className="w-full max-w-md px-4 py-2 border rounded-md dark:bg-gray-700 dark:text-white"
        />
        <input
          type="text"
          placeholder="Image URL"
          value={nftUrl}
          onChange={(e) => setNftUrl(e.target.value)}
          className="w-full max-w-md px-4 py-2 border rounded-md dark:bg-gray-700 dark:text-white"
        />
      </div>
      <button
        onClick={handleMint}
        disabled={isLoading || !currentAccount}
        className="px-6 py-3 border border-transparent text-base font-medium rounded-md text-white bg-green-600 hover:bg-green-700 dark:bg-green-500 dark:hover:bg-green-600 transition-colors disabled:opacity-50"
      >
        {isLoading ? "Minting..." : "Mint an Awesome NFT"}
      </button>
      {!currentAccount && (
        <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
          Please connect your wallet to mint NFTs
        </p>
      )}
    </div>
  );
}

function AccountDetails({ account }) {
  const { mutate: disconnect } = useDisconnectWallet();

  return (
    <div className="w-full max-w-4xl mx-auto">
      <div className="bg-white dark:bg-gray-800 shadow-lg rounded-lg p-6 mb-8">
        <div className="flex justify-between items-start">
          <div>
            <h2 className="text-2xl font-semibold mb-4 text-black dark:text-white">
              Connected Account
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">
              Address:
            </p>
            <p className="text-lg font-mono break-all text-indigo-600 dark:text-indigo-400 mb-4">
              {account.address}
            </p>

            <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">
              Balance on{" "}
              <span className="capitalize font-semibold">Devnet</span>:
            </p>
            <SuiBalance address={account.address} />
          </div>
          <button
            onClick={() => disconnect()}
            className="px-4 py-2 border border-transparent text-base font-medium rounded-md text-white bg-red-600 hover:bg-red-700 dark:bg-red-500 dark:hover:bg-red-600 transition-colors"
          >
            Disconnect
          </button>
        </div>
      </div>
      <MintNFT />
      <OwnedObjects address={account.address} />
    </div>
  );
}

function ObjectCard({ object }) {
  const objectType = object.data.type;
  const content = object.data.content;
  let friendlyType = objectType.split("::").slice(-1)[0];
  let balance = null;
  let nftDetails = null;

  // Check if it's our AwesomeNFT
  if (objectType === `${NFT_PACKAGE_ID}::my_nft::AwesomeNFT`) {
    friendlyType = "AwesomeNFT";
    if (content?.fields) {
      nftDetails = {
        name: content.fields.name,
        description: content.fields.description,
        url: content.fields.url,
      };
    }
  }
  // Check if it's a coin and extract details
  if (objectType.startsWith("0x2::coin::Coin<")) {
    const innerType = objectType.substring(
      "0x2::coin::Coin<".length,
      objectType.length - 1
    );
    if (innerType === "0x2::sui::SUI") {
      friendlyType = "SUI Coin";
    } else {
      friendlyType = `${innerType.split("::").slice(-1)[0]} Coin`;
    }

    if (content?.fields?.balance) {
      // In a real app, you'd fetch coin metadata for decimals. Assuming 9 for BCN as per the contract.
      const decimals = 9;
      balance = (
        Number(content.fields.balance) / Math.pow(10, decimals)
      ).toLocaleString(undefined, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 9,
      });
    }
  } else if (objectType.includes("::coin::TreasuryCap<")) {
    const innerType = objectType.substring(
      objectType.indexOf("<") + 1,
      objectType.lastIndexOf(">")
    );
    friendlyType = `${innerType.split("::").slice(-1)[0]} TreasuryCap`;
  }

  if (nftDetails) {
    return (
      <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg shadow-inner overflow-hidden">
        <img
          src={nftDetails.url}
          alt={nftDetails.name}
          className="w-full h-48 object-cover rounded-md mb-4"
        />
        <div className="font-mono text-sm">
          <p className="font-bold text-lg text-black dark:text-white mb-1">
            {nftDetails.name}
          </p>
          <p className="text-gray-700 dark:text-gray-300 mb-3">
            {nftDetails.description}
          </p>
          <div className="text-gray-600 dark:text-gray-400">
            <p className="mb-1 break-all">
              <span className="font-semibold">ID: </span>
              <a
                href={`https://suiscan.xyz/devnet/object/${object.data.objectId}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-500 hover:underline"
              >
                {object.data.objectId}
              </a>
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="font-mono text-sm bg-gray-50 dark:bg-gray-700 p-4 rounded-lg shadow-inner">
      <div className="flex justify-between items-center mb-2">
        <p className="font-bold text-base text-black dark:text-white">
          {friendlyType}
        </p>
        {balance !== null && (
          <p className="font-bold text-lg text-indigo-600 dark:text-indigo-400">
            {balance}
          </p>
        )}
      </div>
      <div className="text-gray-600 dark:text-gray-400">
        <p className="mb-1 break-all">
          <span className="font-semibold">ID: </span>
          <a
            href={`https://suiscan.xyz/devnet/object/${object.data.objectId}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-500 hover:underline"
          >
            {object.data.objectId}
          </a>
        </p>
        <p className="break-all">
          <span className="font-semibold">Type: </span>
          {objectType}
        </p>
      </div>
    </div>
  );
}

function OwnedObjects({ address }) {
  const { data, isPending, isError, error } = useSuiClientQuery(
    "getOwnedObjects",
    {
      owner: address,
      options: { showType: true, showContent: true },
    },
    { enabled: !!address }
  );

  return (
    <div className="bg-white dark:bg-gray-800 shadow-lg rounded-lg p-6">
      <h3 className="text-xl font-semibold mb-4 text-black dark:text-white">
        Owned Objects on <span className="capitalize">Devnet</span>
      </h3>

      {isPending && (
        <div className="text-center">
          <p className="text-gray-500 dark:text-gray-400">
            Loading owned objects...
          </p>
        </div>
      )}

      {isError && (
        <div className="text-center">
          <p className="text-red-500">Error loading objects: {error.message}</p>
        </div>
      )}

      {!isPending &&
        !isError &&
        (data && data.data.length > 0 ? (
          <div className="space-y-4">
            {data.data.map((object) => (
              <ObjectCard key={object.data?.objectId} object={object} />
            ))}
          </div>
        ) : (
          <div className="text-center">
            <p className="text-gray-500 dark:text-gray-400">
              No objects found for this account on DevNet.
            </p>
          </div>
        ))}
    </div>
  );
}

function SuiBalance({ address }) {
  const { data, isPending, isError } = useSuiClientQuery(
    "getBalance",
    { owner: address },
    {
      enabled: !!address,
      refetchOnWindowFocus: true,
    }
  );

  if (isPending) {
    return <p className="text-black dark:text-white">Loading balance...</p>;
  }

  if (isError) {
    return <p className="text-red-500">Failed to load balance</p>;
  }

  return (
    <p className="text-xl font-bold text-black dark:text-white">
      {(Number(data.totalBalance) / Number(MIST_PER_SUI)).toLocaleString(
        undefined,
        { minimumFractionDigits: 4, maximumFractionDigits: 4 }
      )}{" "}
      SUI
    </p>
  );
}
