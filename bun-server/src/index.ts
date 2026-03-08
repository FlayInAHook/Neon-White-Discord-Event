import { serve } from "bun";
import { addEntry, getActivePlayers, getBestTimes, getLeaderboard, getTeams, getUserDiscordId, getUserLevelHistory } from "./db";
import { initDiscordBot } from "./discordBot";
import index from "./index.html";
import levelData from "./levelDataExport.json";

const API_PASSWORD = process.env.API_PASSWORD || "default_password";
const CURRENT_CHAPTER = process.env.CURRENT_CHAPTER || "32reasdf";
const ACCEPTED_CHAPTER = process.env.ACCEPTED_CHAPTER || "adf";
const DISCORD_WEBHOOK_URL = process.env.DISCORD_WEBHOOK_URL || "";
const ACTIVE_PLAYER_GLOBAL_THRESHOLD_SECONDS = parseInt(process.env.ACTIVE_PLAYER_GLOBAL_THRESHOLD_SECONDS || "180", 10);
const ACTIVE_PLAYER_LEVEL_THRESHOLD_SECONDS = parseInt(process.env.ACTIVE_PLAYER_LEVEL_THRESHOLD_SECONDS || "60", 10);
const DISCORD_BOT_ACTIVE = process.env.DISCORD_BOT_ACTIVE !== "false";

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

const currentChapterLevels = levelData.allLevels.filter(l => l.chapterName === ACCEPTED_CHAPTER);
const currentChapterLevelIds = new Set(currentChapterLevels.map(l => l.id));

const server = serve({
  port: 3340,
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

    "/api/active-players": {
      async GET() {
        const globalActive = getActivePlayers(ACTIVE_PLAYER_GLOBAL_THRESHOLD_SECONDS);
        const levelActive = getActivePlayers(ACTIVE_PLAYER_LEVEL_THRESHOLD_SECONDS);
        return Response.json({ global: globalActive, level: levelActive });
      }
    },

    "/api/user-history": {
      async GET(req) {
        const url = new URL(req.url);
        const name = url.searchParams.get("name");
        const levelId = url.searchParams.get("levelId");

        if (!name || !levelId) {
          return new Response("Missing name or levelId", { status: 400 });
        }

        const history = getUserLevelHistory(name, levelId);
        return Response.json(history);
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

          const { isPB, isWR, previousBestTime, previousWRTime, previousRecordHolder } = addEntry(name, levelId, time, status || 'completed');

          if (isWR && status === 'completed' && previousWRTime !== undefined && DISCORD_WEBHOOK_URL) {
            const levelInfo = currentChapterLevels.find(l => l.id === levelId);
            const levelName = levelInfo ? levelInfo.name : levelId;

            const timeDiffStr = previousWRTime
              ? ` (-${formatTime(previousWRTime - time)})`
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
if (DISCORD_BOT_ACTIVE) {
  initDiscordBot();
} else {
  console.log("🤖 Discord Bot is disabled via DISCORD_BOT_ACTIVE env variable.");
}
