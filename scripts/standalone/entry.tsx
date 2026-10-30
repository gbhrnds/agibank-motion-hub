// Entrada do build estático: renderiza a mesma página do Next.js sem servidor.
import { createRoot } from "react-dom/client";
import Page from "@/app/page";

createRoot(document.getElementById("root")!).render(<Page />);
