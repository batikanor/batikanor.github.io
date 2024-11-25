"use client";

import React, { useState, useEffect } from "react";
import dynamic from "next/dynamic";
import { Connection } from "@solana/web3.js";
import {
  WalletProvider,
  ConnectionProvider,
} from "@solana/wallet-adapter-react";
import { PhantomWalletAdapter } from "@solana/wallet-adapter-wallets";
import {
  WalletModalProvider,
  WalletMultiButton,
} from "@solana/wallet-adapter-react-ui";

import "@solana/wallet-adapter-react-ui/styles.css";

// Material-UI Imports
import { ThemeProvider, createTheme } from "@mui/material/styles";
import {
  Container,
  Card,
  CardContent,
  Typography,
  TextField,
  Button,
  Grid,
} from "@mui/material";

const theme = createTheme({
  palette: {
    primary: { main: "#1976d2" },
    secondary: { main: "#dc004e" },
  },
});

const wallets = [new PhantomWalletAdapter()];
const network = "https://api.devnet.solana.com";

const SolanaPage = () => {
  const [pdfFile, setPdfFile] = useState(null);
  const [pdfHash, setPdfHash] = useState("");
  const [latitude, setLatitude] = useState("");
  const [longitude, setLongitude] = useState("");
  const [price, setPrice] = useState("");
  const [logs, setLogs] = useState("");
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    // Ensure component renders only on the client
    setIsClient(true);
  }, []);

  const handleFileUpload = async (event) => {
    const file = event.target.files[0];
    if (file) {
      setPdfFile(file);
      try {
        const arrayBuffer = await file.arrayBuffer();
        const hashBuffer = await crypto.subtle.digest("SHA-256", arrayBuffer);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        const hashHex = hashArray
          .map((b) => b.toString(16).padStart(2, "0"))
          .join("");
        setPdfHash(hashHex);
        console.log("PDF Hash:", hashHex);
      } catch (error) {
        console.error("Error hashing PDF file:", error);
        alert("Failed to hash the PDF file. Please try again.");
      }
    } else {
      setPdfFile(null);
      setPdfHash("");
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (!pdfHash || !latitude || !longitude || !price) {
      alert("All fields are required.");
      return;
    }

    try {
      console.log("Submitting Data:", { pdfHash, latitude, longitude, price });
      setLogs("Data submitted successfully.");
    } catch (error) {
      console.error("Error submitting data:", error);
      setLogs("Failed to submit data. See console for details.");
    }
  };

  // Render only on the client
  if (!isClient) return null;

  return (
    <ThemeProvider theme={theme}>
      <Container maxWidth="md" style={{ marginTop: "20px" }}>
        <WalletModalProvider>
          <WalletMultiButton />
        </WalletModalProvider>

        <Card variant="outlined" style={{ marginTop: "20px" }}>
          <CardContent>
            <Typography variant="h5" gutterBottom>
              Submit Data
            </Typography>
            <form onSubmit={handleSubmit}>
              <Grid container spacing={2}>
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    variant="outlined"
                    type="file"
                    label="Upload PDF"
                    InputLabelProps={{ shrink: true }}
                    onChange={handleFileUpload}
                  />
                </Grid>
                <Grid item xs={6}>
                  <TextField
                    fullWidth
                    variant="outlined"
                    label="Latitude"
                    value={latitude}
                    onChange={(e) => setLatitude(e.target.value)}
                  />
                </Grid>
                <Grid item xs={6}>
                  <TextField
                    fullWidth
                    variant="outlined"
                    label="Longitude"
                    value={longitude}
                    onChange={(e) => setLongitude(e.target.value)}
                  />
                </Grid>
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    variant="outlined"
                    type="number"
                    label="Price (in SOL)"
                    value={price}
                    onChange={(e) => setPrice(e.target.value)}
                  />
                </Grid>
                <Grid item xs={12}>
                  <Button
                    type="submit"
                    variant="contained"
                    color="primary"
                    fullWidth
                  >
                    Submit
                  </Button>
                </Grid>
              </Grid>
            </form>
            {logs && (
              <Typography style={{ marginTop: "10px" }}>{logs}</Typography>
            )}
          </CardContent>
        </Card>
      </Container>
    </ThemeProvider>
  );
};

const SolanaApp = () => (
  <ConnectionProvider endpoint={network}>
    <WalletProvider wallets={wallets} autoConnect>
      <SolanaPage />
    </WalletProvider>
  </ConnectionProvider>
);

export default SolanaApp;
