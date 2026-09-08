import React from "react";
import { createRoot } from "react-dom/client";
import LifeManager from "./LifeManager.jsx";
import "./index.css";

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <LifeManager />
  </React.StrictMode>
);
