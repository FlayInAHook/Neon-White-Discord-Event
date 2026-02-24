import { serve } from "bun";
import { addEntry, getBestTimes, getLeaderboard } from "./db";
import index from "./index.html";
import levelData from "./levelDataExport.json";

const API_PASSWORD = process.env.API_PASSWORD || "default_password";
const CURRENT_CHAPTER = process.env.CURRENT_CHAPTER || "Wiedergeburt";

const currentChapterLevels = levelData.allLevels.filter(l => l.chapterName === CURRENT_CHAPTER);
const currentChapterLevelIds = new Set(currentChapterLevels.map(l => l.id));

const server = serve({
  port: 3456,
  routes: {
    // Serve index.html for all unmatched routes.
    "/*": index,

    "/api/config": {
      async GET() {
        return Response.json({
          currentChapter: CURRENT_CHAPTER,
          levels: currentChapterLevels
        });
      }
    },

    "/api": {
      async GET(req) {
        const url = new URL(req.url);
        const levelId = url.searchParams.get("levelId");
        const bestOnly = url.searchParams.get("bestOnly") === "true";
        
        let data;
        if (bestOnly) {
          data = getBestTimes();
          if (levelId) {
            data = data.filter(entry => entry.levelId === levelId);
          }
        } else {
          data = getLeaderboard(levelId || undefined);
        }
        
        // Filter data to only include levels from the current chapter
        data = data.filter(entry => currentChapterLevelIds.has(entry.levelId));
        
        return Response.json(data);
      },
      async POST(req) {
        try {
          const body = await req.json();
          const { name, levelId, time, password } = body;

          if (password !== API_PASSWORD) {
            return new Response("Unauthorized", { status: 401 });
          }

          if (!name || !levelId || typeof time !== "number") {
            return new Response("Bad Request", { status: 400 });
          }

          if (!currentChapterLevelIds.has(levelId)) {
            return new Response("Level not in current chapter", { status: 400 });
          }

          addEntry(name, levelId, time);
          return Response.json({ success: true });
        } catch (e) {
          return new Response("Internal Server Error", { status: 500 });
        }
      },
    },
  },

  development: process.env.NODE_ENV !== "production" && {
    // Enable browser hot reloading in development
    hmr: true,

    // Echo console logs from the browser to the server
    console: true,
  },
});

console.log(`🚀 Server running at ${server.url}`);
