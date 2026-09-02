import React from "react";
import { createRoot } from "react-dom/client";
import LifeRPG from "./LifeRPG.jsx";
import "./index.css";

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <LifeRPG />
  </React.StrictMode>
);
