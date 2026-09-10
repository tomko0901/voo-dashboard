import express from "express";

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.static("public"));

async function fetchJson(url) {
  const response = await fetch(url, {
    headers: {
      "User-Agent": "VOO-Dashboard/1.0"
    }
  });

  if (!response.ok) {
    throw new Error(`Request failed with status ${response.status}`);
  }

  return response.json();
}

app.get("/api/stock", async (req, res) => {
  try {
    const data = await fetchJson(
      "https://query1.finance.yahoo.com/v8/finance/chart/VOO?range=5d&interval=1d"
    );

    const result = data.chart.result?.[0];

    if (!result) {
      throw new Error("No stock data returned");
    }

    const timestamps = result.timestamp || [];
    const quote = result.indicators?.quote?.[0] || {};
    const closes = quote.close || [];
    const latestIndex = closes.length - 1;
    const previousIndex = latestIndex - 1;

    const price = closes[latestIndex];
    const previousClose = closes[previousIndex];
    const change = price - previousClose;
    const changePercent = (change / previousClose) * 100;

    res.json({
      symbol: "VOO",
      price,
      change,
      changePercent,
      currency: result.meta?.currency || "USD",
      exchange: result.meta?.exchangeName || "",
      timestamp: timestamps[latestIndex] || null
    });
  } catch (error) {
    console.error("Stock proxy error:", error.message);
    res.status(502).json({
      error: "Unable to retrieve stock data"
    });
  }
});

app.get("/api/news", async (req, res) => {
  try {
    const url =
      "https://feeds.finance.yahoo.com/rss/2.0/headline?s=VOO&region=US&lang=en-US";

    const response = await fetch(url, {
      headers: {
        "User-Agent": "VOO-Dashboard/1.0"
      }
    });

    if (!response.ok) {
      throw new Error(`News request failed with status ${response.status}`);
    }

    const xml = await response.text();

    const items = [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)]
      .slice(0, 10)
      .map((match) => {
        const item = match[1];

        const getTag = (tag) => {
          const cdata = item.match(
            new RegExp(`<${tag}><!\\[CDATA\\[(.*?)\\]\\]><\\/${tag}>`)
          );

          if (cdata) return cdata[1];

          const plain = item.match(
            new RegExp(`<${tag}>(.*?)<\\/${tag}>`)
          );

          return plain ? plain[1] : "";
        };

        return {
          title: getTag("title"),
          link: getTag("link"),
          pubDate: getTag("pubDate"),
          source: getTag("source")
        };
      });

    res.json({ articles: items });
  } catch (error) {
    console.error("News proxy error:", error.message);
    res.status(502).json({
      error: "Unable to retrieve news data",
      articles: []
    });
  }
});

app.get("*", (req, res) => {
  res.sendFile("index.html", { root: "public" });
});

app.listen(PORT, () => {
  console.log(`VOO Dashboard running on port ${PORT}`);
});
