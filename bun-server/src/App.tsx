import "./index.css";
import { Leaderboard } from "./Leaderboard";
import { ThemeProvider } from "@/components/theme-provider";
import { ModeToggle } from "@/components/mode-toggle";

export function App() {
  return (
    <ThemeProvider defaultTheme="system" storageKey="vite-ui-theme">
      <div className="container mx-auto p-8 relative z-10">
        <div className="absolute top-4 right-4">
          <ModeToggle />
        </div>
        <Leaderboard />
      </div>
    </ThemeProvider>
  );
}

export default App;
