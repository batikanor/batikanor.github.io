"use client";
// pages/index.js

import React, { useState } from "react";
import { Connection, PublicKey } from "@solana/web3.js";
import {
  useWallet,
  WalletProvider,
  ConnectionProvider,
} from "@solana/wallet-adapter-react";
import { PhantomWalletAdapter } from "@solana/wallet-adapter-wallets";
import {
  WalletModalProvider,
  WalletMultiButton,
} from "@solana/wallet-adapter-react-ui";
import { MapContainer, TileLayer, Marker, useMapEvents } from "react-leaflet";

import "@solana/wallet-adapter-react-ui/styles.css";
import "leaflet/dist/leaflet.css";
import L from "leaflet";

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

// Fix for default marker icon issues in Leaflet
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: require("leaflet/dist/images/marker-icon-2x.png"),
  iconUrl: require("leaflet/dist/images/marker-icon.png"),
  shadowUrl: require("leaflet/dist/images/marker-shadow.png"),
});

const wallets = [new PhantomWalletAdapter()];
const network = "https://api.devnet.solana.com";

const theme = createTheme({
  palette: {
    primary: { main: "#1976d2" },
    secondary: { main: "#dc004e" },
  },
});

const App = () => {
  const [pdfFile, setPdfFile] = useState(null);
  const [pdfHash, setPdfHash] = useState("");
  const [latitude, setLatitude] = useState("");
  const [longitude, setLongitude] = useState("");
  const [price, setPrice] = useState("");
  const [logs, setLogs] = useState("");
  const [selectedLocation, setSelectedLocation] = useState({
    lat: 51.505,
    lng: -0.09,
  });

  const wallet = useWallet();
  const connection = new Connection(network, "processed");

  const handleFileUpload = async (event) => {
    const file = event.target.files[0];
    if (file) {
      setPdfFile(file);
      try {
        const arrayBuffer = await file.arrayBuffer();
        const hashBuffer = await crypto.subtle.digest("SHA-256", arrayBuffer);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        const hashHex = hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
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

  const handleSubmit = (event) => {
    event.preventDefault();

    if (!pdfHash || !latitude || !longitude || !price) {
      alert("All fields are required.");
      return;
    }

    setLogs("Data submitted successfully.");
    console.log({
      pdfHash,
      latitude,
      longitude,
      price,
    });
  };

  const LocationMarker = () => {
    useMapEvents({
      click(e) {
        const { lat, lng } = e.latlng;
        setSelectedLocation({ lat, lng });
        setLatitude(lat.toString());
        setLongitude(lng.toString());
      },
    });

    return selectedLocation ? (
      <Marker position={selectedLocation}></Marker>
    ) : null;
  };

  return (
    <Container maxWidth="md" style={{ marginTop: "20px" }}>
      <WalletModalProvider>
        <WalletMultiButton />
      </WalletModalProvider>

      {wallet.connected ? (
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
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    variant="outlined"
                    value={`Lat: ${latitude}, Lng: ${longitude}`}
                    label="Selected Location"
                    InputProps={{ readOnly: true }}
                  />
                  <div style={{ height: "400px", width: "100%", marginTop: "10px" }}>
                    <MapContainer
                      center={selectedLocation}
                      zoom={13}
                      style={{ height: "100%", width: "100%" }}
                    >
                      <TileLayer
                        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                      />
                      <LocationMarker />
                    </MapContainer>
                  </div>
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
            {logs && <Typography style={{ marginTop: "10px" }}>{logs}</Typography>}
          </CardContent>
        </Card>
      ) : (
        <Typography variant="body1" style={{ marginTop: "20px" }}>
          Please connect your wallet to submit data.
        </Typography>
      )}
    </Container>
  );
};

const Home = () => (
  <ThemeProvider theme={theme}>
    <ConnectionProvider endpoint={network}>
      <WalletProvider wallets={wallets} autoConnect>
        <App />
      </WalletProvider>
    </ConnectionProvider>
  </ThemeProvider>
);

export default Home;
