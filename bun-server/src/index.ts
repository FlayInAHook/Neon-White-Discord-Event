import { serve } from "bun";
import { addEntry, getBestTimes, getLeaderboard, getTeams, getUserDiscordId } from "./db";
import { initDiscordBot } from "./discordBot";
import index from "./index.html";
import levelData from "./levelDataExport.json";

const API_PASSWORD = process.env.API_PASSWORD || "default_password";
const CURRENT_CHAPTER = process.env.CURRENT_CHAPTER || "Wiedergeburt";
const DISCORD_WEBHOOK_URL = process.env.DISCORD_WEBHOOK_URL || "";

function formatTime(microseconds: number) {
  const ms = Math.floor(microseconds / 1000);
  const minutes = Math.floor(ms / 60000);
  const seconds = Math.floor((ms % 60000) / 1000);
  const milliseconds = ms % 1000;

  if (minutes > 0) {
    return `${minutes}:${seconds.toString().padStart(2, '0')}.${milliseconds.toString().padStart(3, '0')}`;
  }
  return `${seconds}.${milliseconds.toString().padStart(3, '0')}`;
}

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

    "/api/teams": {
      async GET() {
        return Response.json(getTeams());
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
          const { name, levelId, time, password, status } = body;

          if (password !== API_PASSWORD) {
            return new Response("Unauthorized", { status: 401 });
          }

          if (!name || !levelId || typeof time !== "number") {
            return new Response("Bad Request", { status: 400 });
          }

          if (!currentChapterLevelIds.has(levelId)) {
            return new Response("Level not in current chapter", { status: 400 });
          }

          console.log("Received time", time, "with status", status);

          const { isPB, isWR, previousBestTime, previousRecordHolder } = addEntry(name, levelId, time, status || 'completed');

          if (isWR && status === 'completed' && previousBestTime !== undefined && DISCORD_WEBHOOK_URL) {
            const levelInfo = currentChapterLevels.find(l => l.id === levelId);
            const levelName = levelInfo ? levelInfo.name : levelId;

            const timeDiffStr = previousBestTime
              ? ` (-${formatTime(previousBestTime - time)})`
              : '';

            let contentStr = "";
            if (previousRecordHolder && name !== previousRecordHolder) {
              const previousUserDiscordId = getUserDiscordId(previousRecordHolder);
              if (previousUserDiscordId) {
                contentStr = `Yo <@${previousUserDiscordId}> dein Rekord auf ${levelName} wurde von ${name} geschlagen!`;
              }
            }

            const embed: any = {
              title: "🏆 New Record!",
              color: 16766720, // Gold color
              fields: [
                { name: "Player", value: name, inline: true },
                { name: "Level", value: levelName, inline: true },
                { name: "Time", value: `${formatTime(time)}${timeDiffStr}`, inline: false }
              ],
              timestamp: new Date().toISOString()
            };

            fetch(DISCORD_WEBHOOK_URL, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ content: contentStr, embeds: [embed] })
            }).catch(err => console.error("Discord webhook failed:", err));
          }

          return Response.json({ success: true, isPB, isWR });
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

// Initialize the Discord Bot functionality
initDiscordBot();
