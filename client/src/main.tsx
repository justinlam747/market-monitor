import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { HeroUIProvider } from "@heroui/react";
import { App } from "./App.js";
import { Analyze } from "./pages/Analyze.js";
import { LiveAgent } from "./pages/LiveAgent.js";
import { Summary } from "./pages/Summary.js";
import { Runs } from "./pages/Runs.js";
import { About } from "./pages/About.js";
import "./tailwind.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <BrowserRouter>
      <HeroUIProvider>
        <Routes>
          <Route element={<App />}>
            <Route path="/" element={<Analyze />} />
            <Route path="/run/:id" element={<LiveAgent />} />
            <Route path="/run/:id/summary" element={<Summary />} />
            <Route path="/runs" element={<Runs />} />
            <Route path="/about" element={<About />} />
          </Route>
        </Routes>
      </HeroUIProvider>
    </BrowserRouter>
  </React.StrictMode>
);
