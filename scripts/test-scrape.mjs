import * as cheerio from "cheerio";

const DATE_RE = /(\d{1,2})月(\d{1,2})日/;

function parse(html) {
  const $ = cheerio.load(html);
  const name = $(".boy_name").first().clone().children().remove().end().text().trim();
  const shop = $("#shift_shop").text().replace(/[()]/g, "").trim();
  const dateNodes = $("#profile_shift .shift_date ul > li").toArray();
  const valueNodes = $("#profile_shift .shift_boy > ul")
    .toArray()
    .filter((ul) => $(ul).find("li.label").length === 0);

  const shifts = [];
  const count = Math.min(dateNodes.length, valueNodes.length);
  for (let i = 0; i < count; i++) {
    const dateText = $(dateNodes[i]).text().trim();
    const m = dateText.match(DATE_RE);
    const items = $(valueNodes[i])
      .children("li")
      .toArray()
      .map((li) => $(li).text().trim())
      .filter(Boolean);
    const isOff = items.some((item) => item.includes("休"));
    const times = items.filter((item) => /^\d{1,2}:\d{2}$/.test(item));
    shifts.push({
      dateText,
      isoHint: m ? `${m[1]}-${m[2]}` : null,
      isOff,
      start: times[0] ?? null,
      end: times[1] ?? null,
      night: items.includes("○"),
    });
  }
  return { name, shop, shifts };
}

const url = "https://www.dgdgdg.com/boy/detail.php?shop_id=4&boy_id=10235";
const res = await fetch(url, {
  headers: {
    "User-Agent": "Mozilla/5.0 (compatible; EX-ShiftCalendar/1.0)",
    "Accept-Language": "ja,en;q=0.8",
  },
});
if (!res.ok) throw new Error(`HTTP ${res.status}`);
const html = await res.text();
const result = parse(html);
console.log(JSON.stringify(result, null, 2));
